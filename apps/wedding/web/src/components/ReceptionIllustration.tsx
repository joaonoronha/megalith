import React from 'react';
import receptionTableImg from '../assets/reception-table.png';

export interface ReceptionIllustrationProps {
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
 * ReceptionIllustration component renders the banquet reception table artwork
 * anchoring the bottom of the hero section.
 *
 * Features:
 * - High-resolution artwork of banquet table with draped linen cascade, cane-back chairs,
 *   brass taper candelabras, and delicate olive/rose florals.
 * - Non-blocking interaction (pointer-events: none) and aria-hidden="true" for screen reader hygiene
 * - Respects prefers-reduced-motion for accessible animations
 * - Smooth entrance choreography with cubic-bezier easing
 */
export const ReceptionIllustration: React.FC<ReceptionIllustrationProps> = ({
  isVisible = true,
  className = '',
}) => {
  const reducedMotion = usePrefersReducedMotion();

  const style: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    transform: reducedMotion
      ? 'none'
      : isVisible
      ? 'translateY(0)'
      : 'translateY(20px)',
    opacity: isVisible ? 1 : 0,
    transition: reducedMotion
      ? 'none'
      : 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1), transform 800ms cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: 'var(--z-illustration, 1)',
  };

  return (
    <div
      className={`reception-illustration pointer-events-none absolute bottom-0 left-0 right-0 w-full overflow-hidden select-none flex justify-center items-end ${
        !isVisible ? 'opacity-0' : 'opacity-100'
      } ${className}`}
      aria-hidden="true"
      style={style}
    >
      <img
        src={receptionTableImg}
        alt=""
        aria-hidden="true"
        data-part="reception-table-image"
        className="reception-img w-full h-auto max-w-[1400px] object-contain object-bottom pointer-events-none select-none"
        draggable={false}
      />
    </div>
  );
};
