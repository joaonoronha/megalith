import React from 'react';
import { motion, type Variants } from 'motion/react';
import { useI18n } from '../i18n';
import '../styles/invitation.css';

export interface AnimatedInvitationTextProps {
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
 * AnimatedInvitationText renders the central wedding invitation editorial typography:
 * 1. Eyebrow: "O NOSSO CASAMENTO" / "OUR WEDDING" / "NOTRE MARIAGE"
 * 2. Couple Names: "Madalena & João" in romantic editorial serif font with responsive clamp
 * 3. Gold divider line (#A3894F) with 45-degree diamond center motif
 * 4. Date & Time: "16 de agosto de 2027 · 16h00"
 * 5. Venue: "Quinta da Grilla"
 * 6. Invitation message: "É com muita alegria que vos convidamos a celebrar connosco o nosso casamento."
 *
 * Implements staggered reveal animations orchestrated with cubic-bezier easing [0.22, 1, 0.36, 1].
 * Fully respects prefers-reduced-motion: zero delays and zero transform offsets.
 */
export const AnimatedInvitationText: React.FC<AnimatedInvitationTextProps> = ({
  isVisible = true,
  className = '',
}) => {
  const { t } = useI18n();
  const reducedMotion = usePrefersReducedMotion();

  const containerVariants: Variants = {
    hidden: {
      opacity: reducedMotion ? 1 : 0,
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.16,
        delayChildren: reducedMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: reducedMotion ? 1 : 0,
      y: reducedMotion ? 0 : 16,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reducedMotion ? 0 : 0.8,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      className={`invitation-text-container ${className}`}
      variants={containerVariants}
      initial={reducedMotion ? false : 'hidden'}
      animate={isVisible ? 'visible' : 'hidden'}
      style={{
        transform: reducedMotion ? 'none' : undefined,
      }}
    >
      {/* 1. Eyebrow */}
      <motion.p className="hero-eyebrow" variants={itemVariants}>
        {t.eyebrow}
      </motion.p>

      {/* 2. Couple Names */}
      <motion.h1
        className="hero-names"
        variants={itemVariants}
        style={{
          fontFamily: "'Forum', 'Cinzel', 'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(2.1rem, 7.8vw, 3.75rem)',
        }}
      >
        {t.names}
      </motion.h1>

      {/* 3. Gold Divider Line with 45-degree Diamond */}
      <motion.div
        className="hero-divider"
        data-testid="hero-divider"
        role="separator"
        aria-hidden="true"
        variants={itemVariants}
      >
        <span className="hero-divider-line" />
        <span
          className="hero-divider-diamond"
          data-motif="diamond"
          aria-hidden="true"
        />
        <span className="hero-divider-line hero-divider-line--right" />
      </motion.div>

      {/* 4. Date and Time */}
      <motion.p className="hero-datetime" variants={itemVariants}>
        <span>{t.date}</span>
        <span className="hero-datetime-sep" aria-hidden="true">
          ·
        </span>
        <span>{t.time}</span>
      </motion.p>

      {/* 5. Venue */}
      <motion.p className="hero-venue" variants={itemVariants}>
        {t.venueName}
      </motion.p>

      {/* 6. Invitation Message */}
      <motion.p className="hero-message" variants={itemVariants}>
        {t.invitation}
      </motion.p>
    </motion.div>
  );
};
