import React from 'react';
import slice1 from '../assets/flower-slice-1.png';
import slice2 from '../assets/flower-slice-2.png';
import slice3 from '../assets/flower-slice-3.png';
import slice4 from '../assets/flower-slice-4.png';
import slice5 from '../assets/flower-slice-5.png';

export interface BotanicalFrameProps {
  /** Controls reveal visibility state. Defaults to true. */
  isVisible?: boolean;
  className?: string;
}

/**
 * Hook to detect prefers-reduced-motion media query.
 * Updates dynamically if user preference changes.
 */
function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = React.useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(update);
      return () => mediaQuery.removeListener(update);
    }
  }, []);

  return reducedMotion;
}

interface FlowerSliceConfig {
  id: number;
  src: string;
  left: string;
  width: string;
  swayClass: string;
}

const FLOWER_SLICES: FlowerSliceConfig[] = [
  { id: 1, src: slice1, left: '0%', width: '24.21%', swayClass: 'flower-sway-1' },
  { id: 2, src: slice2, left: '20.17%', width: '24.21%', swayClass: 'flower-sway-2' },
  { id: 3, src: slice3, left: '40.34%', width: '23.20%', swayClass: 'flower-sway-3' },
  { id: 4, src: slice4, left: '59.51%', width: '24.21%', swayClass: 'flower-sway-4' },
  { id: 5, src: slice5, left: '79.68%', width: '20.32%', swayClass: 'flower-sway-5' },
];

/**
 * BotanicalFrame component renders an artisanal floral canopy
 * cascading along the upper viewport edge.
 *
 * Sliced into 5 overlapping organic segments that sway gently in the breeze
 * (with top 20% cropped to sit flush against the ceiling and preserve all hanging tendrils).
 *
 * Conforms to accessibility standards (aria-hidden="true", pointer-events: none)
 * and honors prefers-reduced-motion preferences.
 */
export const BotanicalFrame: React.FC<BotanicalFrameProps> = ({
  isVisible = true,
  className = '',
}) => {
  const reducedMotion = usePrefersReducedMotion();

  const style: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 'var(--z-illustration, 1)',
    opacity: isVisible ? 1 : 0,
    transform: reducedMotion
      ? 'none'
      : isVisible
      ? 'translateY(0)'
      : 'translateY(-20px)',
    transition: reducedMotion
      ? 'none'
      : 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1), transform 800ms cubic-bezier(0.22, 1, 0.36, 1)',
  };

  return (
    <div
      className={`botanical-frame pointer-events-none absolute top-0 left-0 right-0 w-full overflow-visible select-none flex justify-center items-start ${
        !isVisible ? 'opacity-0' : 'opacity-100'
      } ${className}`}
      aria-hidden="true"
      style={style}
    >
      <div className="botanical-slices-wrapper relative w-full max-w-[1600px] overflow-visible pointer-events-none select-none">
        {FLOWER_SLICES.map((slice) => (
          <img
            key={slice.id}
            src={slice.src}
            alt=""
            aria-hidden="true"
            data-part={`flower-slice-${slice.id}`}
            className={`botanical-slice absolute top-0 h-full object-contain object-top pointer-events-none select-none ${
              reducedMotion ? '' : slice.swayClass
            }`}
            style={{
              left: slice.left,
              width: slice.width,
            }}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
};
