import React from 'react';
import { useI18n } from '../i18n';
import { PaperTexture } from './PaperTexture';
import { BotanicalFrame } from './BotanicalFrame';
import { Chandelier } from './Chandelier';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AnimatedInvitationText } from './AnimatedInvitationText';
import { ReceptionIllustration } from './ReceptionIllustration';
import '../styles/invitation.css';

export interface InvitationHeroProps {
  className?: string;
  /** Force all animated layers visible immediately (useful for static renders or test fixtures) */
  forceVisible?: boolean;
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
 * InvitationHero component renders the full-viewport hero section for the wedding invitation.
 *
 * Layered visual composition:
 * 1. Warm ivory background (#F5F2EB) with tactile PaperTexture overlay
 * 2. Artisanal BotanicalFrame cascading canopy descending from top corners
 * 3. Antique gold Chandelier centered beneath greenery
 * 4. Discreet LanguageSwitcher anchored in the top-right
 * 5. Centered AnimatedInvitationText with romantic editorial typography
 * 6. Bespoke ReceptionIllustration table anchoring the bottom
 *
 * Animation Sequence Choreography (total duration ~2.6-2.8s):
 * - 0ms: Botanical canopy descends
 * - 350ms: Chandelier reveals beneath greenery
 * - 700ms: Central editorial typography staggers in (Eyebrow -> Names -> Divider -> DateTime/Venue/Message)
 * - 1600ms: Panoramic reception banquet table rises to anchor base
 *
 * Full compliance with prefers-reduced-motion: all layers render immediately without transforms or delays.
 */
export const InvitationHero: React.FC<InvitationHeroProps> = ({
  className = '',
  forceVisible = false,
}) => {
  const { t } = useI18n();
  const reducedMotion = usePrefersReducedMotion();

  // If forceVisible or reduced motion, all layers are immediately active
  const isImmediate = forceVisible || reducedMotion;

  const [canopyVisible, setCanopyVisible] = React.useState<boolean>(true);
  const [chandelierVisible, setChandelierVisible] = React.useState<boolean>(isImmediate);
  const [textVisible, setTextVisible] = React.useState<boolean>(isImmediate);
  const [receptionVisible, setReceptionVisible] = React.useState<boolean>(isImmediate);

  React.useEffect(() => {
    if (isImmediate) {
      setCanopyVisible(true);
      setChandelierVisible(true);
      setTextVisible(true);
      setReceptionVisible(true);
      return;
    }

    // Sequenced reveal choreography using cubic-bezier easing [0.22, 1, 0.36, 1]
    const timerChandelier = setTimeout(() => {
      setChandelierVisible(true);
    }, 350);

    const timerText = setTimeout(() => {
      setTextVisible(true);
    }, 700);

    const timerReception = setTimeout(() => {
      setReceptionVisible(true);
    }, 1600);

    return () => {
      clearTimeout(timerChandelier);
      clearTimeout(timerText);
      clearTimeout(timerReception);
    };
  }, [isImmediate]);

  return (
    <section
      className={`invitation-hero overflow-hidden ${className}`}
      aria-label={t.eyebrow}
    >
      {/* Layer 1: Warm ivory background + Paper texture */}
      <PaperTexture />

      {/* Layer 2: Botanical canopy cascading from top corners */}
      <BotanicalFrame isVisible={canopyVisible} />

      {/* Layer 3: Bespoke Chandelier centered beneath greenery */}
      <Chandelier isVisible={chandelierVisible} />

      {/* Layer 4: Discreet Language Switcher in top right */}
      <LanguageSwitcher />

      {/* Layer 5: Centered Animated Invitation Text */}
      <div className="hero-content-wrapper">
        <AnimatedInvitationText isVisible={textVisible} />
      </div>

      {/* Layer 6: Panoramic Reception Table anchoring bottom */}
      <ReceptionIllustration isVisible={receptionVisible} />
    </section>
  );
};
