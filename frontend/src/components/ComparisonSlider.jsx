import { useCallback, useRef, useState } from 'react';

export default function ComparisonSlider({ before, after }) {
  const containerRef = useRef(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const startDrag = useCallback(
    (clientX) => {
      setIsDragging(true);
      updatePosition(clientX);
    },
    [updatePosition]
  );

  const stopDrag = () => setIsDragging(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="theme-text-subtle mb-2 text-sm">Drag to compare</p>

      <div
        ref={containerRef}
        className="stage-surface tool-panel relative select-none overflow-hidden cursor-ew-resize"
        onMouseDown={(e) => startDrag(e.clientX)}
        onMouseMove={(e) => isDragging && updatePosition(e.clientX)}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => isDragging && updatePosition(e.touches[0].clientX)}
        onTouchEnd={stopDrag}
      >
        <div className="media-surface relative h-full w-full checkerboard overflow-hidden rounded-[20px]">
          <img src={after} alt="Processed" className="viewport-media-image" draggable={false} />

          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <img
              src={before}
              alt="Original"
              className="viewport-media-image theme-media-backdrop"
              draggable={false}
            />
          </div>
        </div>

        <div
          className="absolute top-0 bottom-0 z-10"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          <div className="compare-divider h-full w-px" />
        </div>

        <div
          className="absolute top-1/2 z-20"
          style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div className="slider-handle">
            <svg className="theme-text-subtle h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" transform="translate(-3, 0)" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" transform="translate(3, 0)" />
            </svg>
          </div>
        </div>

        <div className="compare-label compare-label-primary absolute left-4 top-4 z-10 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
          Original
        </div>
        <div className="compare-label compare-label-secondary absolute right-4 top-4 z-10 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
          Result
        </div>
      </div>
    </div>
  );
}
