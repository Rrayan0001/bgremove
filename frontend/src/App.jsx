import { useCallback, useEffect, useState } from 'react';
import Hero from './components/Hero';
import ProcessingState from './components/ProcessingState';
import ResultSection from './components/ResultSection';
import UploadSection from './components/UploadSection';
import {
  API_BASE_URL,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  buildApiUrl,
} from './lib/api';

const THEME_STORAGE_KEY = 'ai-background-remover-theme';
const DEFAULT_API_CONFIG = {
  deploymentTarget: API_BASE_URL ? 'render' : 'local',
  maxFileSizeMb: MAX_UPLOAD_SIZE_MB,
};
const REQUEST_TIMEOUT_MS = 90000;

async function readErrorMessage(response) {
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return payload.detail || payload.message || 'Something went wrong.';
    }

    const text = await response.text();
    return text || 'Something went wrong.';
  } catch {
    return 'Something went wrong.';
  }
}

function getInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

async function compressImage(file, maxUploadBytes) {
  if (file.size <= maxUploadBytes) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result || '';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleFactor = Math.min(1, Math.sqrt(maxUploadBytes / file.size) * 0.9);
        const width = Math.max(1, Math.floor(img.width * scaleFactor));
        const height = Math.max(1, Math.floor(img.height * scaleFactor));

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.85
        );
      };
    };
  });
}

function getUploadErrorMessage(error) {
  if (error?.name === 'AbortError') {
    if (API_BASE_URL) {
      return 'The API took too long to respond. If the Render free service is waking up, wait a moment and try again.';
    }

    return 'The local API took too long to respond. Confirm the backend is running on 127.0.0.1:8000 and try again.';
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    if (API_BASE_URL) {
      return 'Could not reach the Render API. If the free service is waking up, wait a moment and try again.';
    }

    return 'Could not reach the local API on http://127.0.0.1:8000.';
  }

  return error?.message || 'Failed to process the image.';
}

export default function App() {
  const [state, setState] = useState('idle');
  const [theme, setTheme] = useState(getInitialTheme);
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [error, setError] = useState('');
  const [apiConfig, setApiConfig] = useState(DEFAULT_API_CONFIG);

  useEffect(() => {
    return () => {
      if (processedImage) {
        URL.revokeObjectURL(processedImage);
      }
    };
  }, [processedImage]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (!API_BASE_URL) {
      setApiConfig(DEFAULT_API_CONFIG);
      return undefined;
    }

    let ignore = false;

    async function warmBackend() {
      try {
        const response = await fetch(buildApiUrl('/config'));
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (ignore) {
          return;
        }

        setApiConfig({
          deploymentTarget: payload.deploymentTarget || DEFAULT_API_CONFIG.deploymentTarget,
          maxFileSizeMb: payload.maxFileSizeMb || MAX_UPLOAD_SIZE_MB,
        });
      } catch {
        if (!ignore) {
          setApiConfig(DEFAULT_API_CONFIG);
        }
      }
    }

    warmBackend();

    return () => {
      ignore = true;
    };
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const handleUpload = useCallback(
    async (file, options) => {
      const reader = new FileReader();
      reader.onload = (event) => setOriginalImage(event.target?.result || null);
      reader.readAsDataURL(file);

      setState('processing');
      setError('');
      setProcessedImage((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });

      try {
        const maxUploadBytes = Math.max(1, apiConfig.maxFileSizeMb) * 1024 * 1024;
        const processedFile = await compressImage(file, Math.min(maxUploadBytes, MAX_UPLOAD_SIZE_BYTES));
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const formData = new FormData();
          formData.append('image', processedFile);

          if (options?.model) {
            formData.append('model', options.model);
          }

          if (options?.mode) {
            formData.append('mode', options.mode);
          }

          if (options?.alphaMatting !== undefined) {
            formData.append('alpha_matting', String(options.alphaMatting));
          }

          const response = await fetch(buildApiUrl('/remove-background'), {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(await readErrorMessage(response));
          }

          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);

          setProcessedImage(imageUrl);
          setState('done');
        } finally {
          window.clearTimeout(timeoutId);
        }
      } catch (uploadError) {
        setError(getUploadErrorMessage(uploadError));
        setState('error');
      }
    },
    [apiConfig.maxFileSizeMb]
  );

  const handleReset = useCallback(() => {
    setProcessedImage((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setOriginalImage(null);
    setError('');
    setState('idle');
  }, []);

  const processingMessage =
    apiConfig.deploymentTarget === 'render'
      ? 'Render free may take 30-60 seconds on the first request after idle.'
      : 'Usually a few seconds.';

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="page-grid" />

      <div className="viewport-shell relative z-10 mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
        <Hero
          theme={theme}
          onToggleTheme={handleToggleTheme}
          maxFileSizeMb={apiConfig.maxFileSizeMb}
        />

        {state === 'error' && (
          <div className="shadow-strip theme-text-muted mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleReset}
              className="theme-text-primary inline-flex items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] transition hover:opacity-70"
            >
              Reset
            </button>
          </div>
        )}

        <main className="viewport-main">
          {(state === 'idle' || state === 'error') && (
            <UploadSection
              onUpload={handleUpload}
              maxFileSizeMb={apiConfig.maxFileSizeMb}
              supportNote={processingMessage}
            />
          )}
          {state === 'processing' && (
            <ProcessingState originalImage={originalImage} statusMessage={processingMessage} />
          )}
          {state === 'done' && (
            <ResultSection
              originalImage={originalImage}
              processedImage={processedImage}
              onReset={handleReset}
            />
          )}
        </main>

        <footer className="theme-text-subtle mt-3 text-center text-xs font-medium uppercase tracking-[0.16em]">
          Upload. Remove. Download.
        </footer>
      </div>
    </div>
  );
}
