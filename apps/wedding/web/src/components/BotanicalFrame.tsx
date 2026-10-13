import React from 'react';
import flowersImg from '../assets/flowers.png';

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

/**
 * BotanicalFrame component renders an artisanal floral canopy
 * cascading along the upper viewport edge.
 *
 * Conceived with natural white roses, hydrangeas, lilies, and cascading olive/eucalyptus greenery.
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
      className={`botanical-frame pointer-events-none absolute top-0 left-0 right-0 w-full overflow-hidden select-none flex justify-center items-start ${
        !isVisible ? 'opacity-0' : 'opacity-100'
      } ${className}`}
      aria-hidden="true"
      style={style}
    >
      <img
        src={flowersImg}
        alt=""
        aria-hidden="true"
        data-part="botanical-canopy-image"
        className="botanical-canopy-img w-full h-auto max-w-[1600px] pointer-events-none select-none"
        draggable={false}
      />
    </div>
  );
};
