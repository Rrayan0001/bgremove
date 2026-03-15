import { useState } from 'react';
import ComparisonSlider from './ComparisonSlider';

export default function ResultSection({ originalImage, processedImage, onReset }) {
  const [viewMode, setViewMode] = useState('sideBySide');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'removed_bg.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="section-space tool-stage">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="micro-label theme-text-subtle">Result</p>
            <h2 className="theme-text-primary mt-2 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              Done.
            </h2>
          </div>

          <div className="shadow-strip theme-text-subtle flex gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <button
              type="button"
              onClick={() => setViewMode('sideBySide')}
              className={`view-toggle ${viewMode === 'sideBySide' ? 'is-active' : ''}`}
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('slider')}
              className={`view-toggle ${viewMode === 'slider' ? 'is-active' : ''}`}
            >
              Slider
            </button>
          </div>
        </div>

        <div className="mt-3 flex-1 min-h-0">
          {viewMode === 'sideBySide' ? (
            <div className="result-grid h-full min-h-0">
              <div className="flex min-h-0 flex-col">
                <p className="theme-text-subtle mb-2 text-sm">Original</p>
                <div className="stage-surface tool-panel">
                  <div className="media-surface viewport-media-frame theme-media-backdrop h-full">
                    <img src={originalImage} alt="Original" className="viewport-media-image" />
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                <p className="theme-text-subtle mb-2 text-sm">Transparent PNG</p>
                <div className="stage-surface checkerboard tool-panel">
                  <div className="media-surface viewport-media-frame h-full">
                    <img src={processedImage} alt="Processed" className="viewport-media-image" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ComparisonSlider before={originalImage} after={processedImage} />
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={handleDownload} className="action-primary">
            Download PNG
          </button>
          <button type="button" onClick={onReset} className="action-secondary">
            Start over
          </button>
        </div>
      </div>
    </section>
  );
}
