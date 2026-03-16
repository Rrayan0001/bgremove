import { useCallback, useState } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const FILE_INPUT_ID = 'bg-remover-file-input';

function formatFileSize(size = 0) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadSection({ onUpload, maxFileSizeMb = 10, supportNote = '' }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

  const validate = useCallback((file) => {
    if (!file) return null;
    
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Unsupported format. Upload a JPG, PNG, or WebP image.';
    }

    if (file.size > maxFileSizeBytes) {
      return `File too large (${formatFileSize(file.size)}). Maximum allowed size is ${maxFileSizeMb} MB.`;
    }

    return null;
  }, [maxFileSizeBytes, maxFileSizeMb]);

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
    // Very important: reset value so selecting the same file triggers again
    event.target.value = '';
  };

  const clearPreview = () => {
    setSelectedFile(null);
    setPreview(null);
    setValidationError('');
  };

  const submitImage = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <section className="section-space tool-stage">
      {/* 
        Single File Input for the entire component.
        Styling uses the robust "screen-reader only" pattern to hide 
        it from layout while keeping it fully interactive for its <label>s.
      */}
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={onFileChange}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      />

      <div
        className={`stage-surface tool-panel ${dragOver ? 'is-active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {!preview ? (
          <label htmlFor={FILE_INPUT_ID} className="empty-state cursor-pointer hover:opacity-90 transition-opacity">
            <div className="icon-badge theme-inverse-surface flex h-14 w-14 items-center justify-center rounded-full">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4 4 4M4 20h16" />
              </svg>
            </div>

            <h2 className="theme-text-primary mt-5 font-display text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
              Drop an image here
            </h2>

            <p className="theme-text-muted mt-2 text-sm">Or click anywhere to choose a file manually.</p>

            <span className="mt-6 inline-block rounded-full border-0 bg-black px-5 py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-white hover:bg-neutral-800">
              Choose file
            </span>
          </label>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-4">
              <p className="theme-text-muted text-sm font-medium">Preview</p>

              <div className="theme-text-subtle flex gap-4 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <label
                  htmlFor={FILE_INPUT_ID}
                  className="inline-block rounded-full border-0 bg-black px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white hover:bg-neutral-800 cursor-pointer"
                >
                  Change
                </label>
                <button type="button" onClick={clearPreview} className="theme-action-link">
                  Clear
                </button>
              </div>
            </div>

            <div className="media-surface viewport-media-frame theme-media-backdrop mt-3">
              <img src={preview} alt="Preview" className="viewport-media-image" />
            </div>

            <div className="shadow-strip mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
              <p className="theme-text-muted truncate text-sm">
                {selectedFile?.name} <span className="theme-text-subtle">·</span> {formatFileSize(selectedFile?.size)}
              </p>

              <button type="button" onClick={submitImage} className="action-primary sm:w-auto">
                Remove background
              </button>
            </div>
          </div>
        )}
      </div>

      {validationError && <p className="theme-text-muted mt-2 text-sm leading-6">{validationError}</p>}
      {!validationError && supportNote && (
        <p className="theme-text-muted mt-2 text-sm leading-6">{supportNote}</p>
      )}
    </section>
  );
}
