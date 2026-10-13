import React from 'react';
import chandelierImg from '../assets/chandelier.png';

export interface ChandelierProps {
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
 * Chandelier component renders the antique-gold crystal & floral chandelier
 * suspended from the ceiling beneath the botanical canopy.
 *
 * Features:
 * - High-resolution artwork with antique brass candelabras, crystal beads, glowing taper candles,
 *   and delicate olive/rose florals.
 * - Non-blocking interaction (pointer-events: none) and aria-hidden="true" for screen reader hygiene
 * - Respects prefers-reduced-motion for accessible animations
 * - Smooth entrance choreography with cubic-bezier easing
 */
export const Chandelier: React.FC<ChandelierProps> = ({
  isVisible = true,
  className = '',
}) => {
  const reducedMotion = usePrefersReducedMotion();

  const style: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'absolute',
    left: '50%',
    transform: reducedMotion
      ? 'translateX(-50%)'
      : isVisible
      ? 'translateX(-50%) translateY(0)'
      : 'translateX(-50%) translateY(-20px)',
    opacity: isVisible ? 1 : 0,
    transition: reducedMotion
      ? 'none'
      : 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1), transform 800ms cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: 'var(--z-illustration, 1)',
  };

  return (
    <div
      className={`chandelier-container pointer-events-none absolute left-1/2 -translate-x-1/2 overflow-visible select-none flex justify-center items-start ${
        !isVisible ? 'opacity-0' : 'opacity-100'
      } ${className}`}
      aria-hidden="true"
      style={style}
    >
      <img
        src={chandelierImg}
        alt=""
        aria-hidden="true"
        data-part="chandelier-image"
        className={`chandelier-img w-auto h-auto object-contain object-top pointer-events-none select-none ${
          reducedMotion ? '' : 'chandelier-sway'
        }`}
        draggable={false}
      />
    </div>
  );
};
