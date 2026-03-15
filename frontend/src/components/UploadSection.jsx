import { useCallback, useRef, useState } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

function formatFileSize(size = 0) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadSection({ onUpload }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef(null);

  const validate = useCallback((file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Unsupported format. Upload a JPG, PNG, or WebP image.';
    }

    if (file.size > MAX_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Maximum allowed size is 10 MB.`;
    }

    return null;
  }, []);

  const handleFile = useCallback(
    (file) => {
      setValidationError('');

      const error = validate(file);
      if (error) {
        setSelectedFile(null);
        setPreview(null);
        setValidationError(error);
        return;
      }

      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = (event) => setPreview(event.target?.result || null);
      reader.readAsDataURL(file);
    },
    [validate]
  );

  const openPicker = () => fileInputRef.current?.click();

  const onDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const onDrop = (event) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const clearPreview = () => {
    setSelectedFile(null);
    setPreview(null);
    setValidationError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const submitImage = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <section className="section-space tool-stage">
      <div
        className={`stage-surface tool-panel ${dragOver ? 'is-active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={!preview ? openPicker : undefined}
        role={!preview ? 'button' : undefined}
        tabIndex={!preview ? 0 : undefined}
        onKeyDown={
          !preview
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPicker();
                }
              }
            : undefined
        }
      >
        {!preview ? (
          <div className="empty-state">
            <div className="icon-badge theme-inverse-surface flex h-14 w-14 items-center justify-center rounded-full">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4 4 4M4 20h16" />
              </svg>
            </div>

            <h2 className="theme-text-primary mt-5 font-display text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
              Drop an image here
            </h2>

            <p className="theme-text-muted mt-2 text-sm">Or choose a file manually.</p>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
              className="action-primary mt-6"
            >
              Choose image
            </button>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-4">
              <p className="theme-text-muted text-sm font-medium">Preview</p>

              <div className="theme-text-subtle flex gap-4 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <button type="button" onClick={openPicker} className="theme-action-link">
                  Replace
                </button>
                <button type="button" onClick={clearPreview} className="theme-action-link">
                  Clear
                </button>
              </div>
            </div>

            <div className="media-surface viewport-media-frame theme-media-backdrop mt-3">
              <img src={preview} alt="Preview" className="viewport-media-image" />
            </div>

            <div className="shadow-strip mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="theme-text-muted truncate text-sm">
                {selectedFile.name} <span className="theme-text-subtle">·</span> {formatFileSize(selectedFile.size)}
              </p>

              <button type="button" onClick={submitImage} className="action-primary sm:w-auto">
                Remove background
              </button>
            </div>
          </div>
        )}
      </div>

      {validationError && <p className="theme-text-muted mt-2 text-sm leading-6">{validationError}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={onFileChange}
      />
    </section>
  );
}
