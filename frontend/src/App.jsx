import { useCallback, useEffect, useState } from 'react';
import Hero from './components/Hero';
import UploadSection from './components/UploadSection';
import ProcessingState from './components/ProcessingState';
import ResultSection from './components/ResultSection';

const THEME_STORAGE_KEY = 'ai-background-remover-theme';

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

export default function App() {
  const [state, setState] = useState('idle');
  const [theme, setTheme] = useState(getInitialTheme);
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [error, setError] = useState('');

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

  const handleToggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const handleUpload = useCallback(async (file, options) => {
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
      const formData = new FormData();
      formData.append('image', file);

      if (options?.model) {
        formData.append('model', options.model);
      }

      if (options?.alphaMatting !== undefined) {
        formData.append('alpha_matting', String(options.alphaMatting));
      }

      const response = await fetch('/remove-background', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      setProcessedImage(imageUrl);
      setState('done');
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to process the image.');
      setState('error');
    }
  }, []);

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

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="page-grid" />

      <div className="viewport-shell relative z-10 mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
        <Hero theme={theme} onToggleTheme={handleToggleTheme} />

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
          {(state === 'idle' || state === 'error') && <UploadSection onUpload={handleUpload} />}
          {state === 'processing' && <ProcessingState originalImage={originalImage} />}
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
