export default function ProcessingState({ originalImage, statusMessage = 'Usually a few seconds.' }) {
  return (
    <section className="section-space tool-stage">
      <div className="result-grid h-full min-h-0">
        <div className="stage-surface tool-panel">
          {originalImage ? (
            <div className="media-surface viewport-media-frame theme-media-backdrop h-full">
              <img
                src={originalImage}
                alt="Image being processed"
                className="viewport-media-image"
              />
            </div>
          ) : (
            <div className="viewport-media-frame theme-media-backdrop h-full rounded-[22px]" />
          )}
        </div>

        <div className="shadow-strip flex flex-col justify-center gap-4">
          <p className="micro-label theme-text-subtle">Processing</p>
          <h2 className="theme-text-primary font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            Removing background...
          </h2>
          <div className="flex items-center gap-4">
            <div className="processing-ring" />
            <p className="theme-text-muted text-sm">{statusMessage}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
