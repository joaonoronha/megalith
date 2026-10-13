import React from 'react';
import { motion } from 'motion/react';
import { useI18n } from '../i18n';
import type { ScheduleEvent } from '../i18n/types';

export interface WeddingScheduleProps {
  className?: string;
}

/**
 * Hook to detect prefers-reduced-motion media query.
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
 * Bespoke SVG icons for timeline events
 */
const ScheduleIcon: React.FC<{ index: number }> = ({ index }) => {
  switch (index) {
    case 0:
      // 15:30 - Guest Arrival (Door / Welcome)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="schedule-item-icon"
          aria-hidden="true"
        >
          <path
            d="M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M3 21h18M15 12h.01"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M12 3v18"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        </svg>
      );
    case 1:
      // 16:00 - Ceremony (Intertwined Rings)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="schedule-item-icon"
          aria-hidden="true"
        >
          <circle
            cx="9"
            cy="13"
            r="5.5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle
            cx="15"
            cy="11"
            r="5.5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M14 6l1-1.5 1 1.5-1 1-1-1z"
            fill="currentColor"
          />
        </svg>
      );
    case 2:
      // 17:00 - Photos & Toast (Clinking Glasses)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="schedule-item-icon"
          aria-hidden="true"
        >
          <path
            d="M7 4l2 6a3 3 0 01-3 3H5a3 3 0 01-3-3l2-6h3zM6 13v6M4 19h4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 4l-2 6a3 3 0 003 3h1a3 3 0 003-3l-2-6h-3zM18 13v6M16 19h4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="6" r="0.75" fill="currentColor" />
          <circle cx="11.5" cy="9" r="0.5" fill="currentColor" />
        </svg>
      );
    case 3:
      // 17:30 - Cocktail & Appetizers (Coupe glass with garnish)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="schedule-item-icon"
          aria-hidden="true"
        >
          <path
            d="M5 6c0 4 3.13 7 7 7s7-3 7-7H5z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M12 13v7M8 20h8"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M16 4l-3 4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="16.5" cy="3.5" r="1.5" fill="currentColor" />
        </svg>
      );
    case 4:
      // 19:30 - Dinner (Banquet Cloche / Candle)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="schedule-item-icon"
          aria-hidden="true"
        >
          <path
            d="M4 17h16M3 19h18"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M5 17c0-4.418 3.134-8 7-8s7 3.582 7 8"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="12" cy="7" r="1.25" fill="currentColor" />
        </svg>
      );
    case 5:
    default:
      // 22:00 - Cake Cutting & Party (Tiered Cake & Sparkle)
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="schedule-item-icon"
          aria-hidden="true"
        >
          <path
            d="M6 19h12v2H6v-2zM8 14h8v5H8v-5zM10 10h4v4h-4v-4z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M12 7c0-1 1-2 1-2s-1 0-1 2z"
            fill="currentColor"
          />
          <path
            d="M4 8l1 1M20 8l-1 1M18 4l.5 1.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

/**
 * WeddingSchedule displays the chronological wedding day timeline
 * inside an architectural deep olive arched container on the linen texture,
 * with graceful scroll-triggered fade-in animations on each item.
 */
export const WeddingSchedule: React.FC<WeddingScheduleProps> = ({
  className = '',
}) => {
  const { t } = useI18n();
  const reducedMotion = usePrefersReducedMotion();

  const hasIntersectionObserver =
    typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined';

  const shouldAnimate = !reducedMotion && hasIntersectionObserver;

  const itemMotionProps = shouldAnimate
    ? {
        initial: { opacity: 0, y: 22 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.08 },
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {
        initial: false,
      };

  return (
    <section
      className={`wedding-schedule-section ${className}`}
      aria-labelledby="schedule-heading"
    >
      <div className="schedule-card">
        {/* Architectural Arch Top & Botanical Motif */}
        <div className="schedule-arch-header" aria-hidden="true">
          <svg
            className="schedule-arch-sprig"
            viewBox="0 0 120 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Center diamond */}
            <path
              d="M60 12 L64 20 L60 28 L56 20 Z"
              fill="var(--color-gold, #A3894F)"
            />
            {/* Left sprig branch */}
            <path
              d="M54 20 C42 19 32 17 18 24"
              stroke="var(--color-gold, #A3894F)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />
            <path
              d="M44 19 C42 15 36 14 34 17 C35 20 40 21 44 19 Z"
              fill="var(--color-sage, #A7B09A)"
              fillOpacity="0.8"
            />
            <path
              d="M30 18 C28 14 22 13 20 16 C21 19 26 20 30 18 Z"
              fill="var(--color-gold, #A3894F)"
              fillOpacity="0.7"
            />
            {/* Right sprig branch */}
            <path
              d="M66 20 C78 19 88 17 102 24"
              stroke="var(--color-gold, #A3894F)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />
            <path
              d="M76 19 C78 15 84 14 86 17 C85 20 80 21 76 19 Z"
              fill="var(--color-sage, #A7B09A)"
              fillOpacity="0.8"
            />
            <path
              d="M90 18 C92 14 98 13 100 16 C99 19 94 20 90 18 Z"
              fill="var(--color-gold, #A3894F)"
              fillOpacity="0.7"
            />
          </svg>
        </div>

        {/* Section Eyebrow */}
        <p className="schedule-eyebrow">{t.schedule.eyebrow}</p>

        {/* Section Title */}
        <h2 id="schedule-heading" className="schedule-title">
          {t.schedule.title}
        </h2>

        {/* Subtle decorative divider */}
        <div className="schedule-divider" aria-hidden="true">
          <span className="schedule-divider-line" />
          <span className="schedule-divider-diamond">✦</span>
          <span className="schedule-divider-line" />
        </div>

        {/* Chronological Timeline List */}
        <ol className="schedule-timeline" role="list">
          {t.schedule.events.map((event: ScheduleEvent, idx: number) => {
            return (
              <motion.li
                key={event.time}
                className="schedule-item"
                role="listitem"
                {...itemMotionProps}
              >
                {/* Node with bespoke icon */}
                <div className="schedule-item-node" aria-hidden="true">
                  <div className="schedule-node-badge">
                    <ScheduleIcon index={idx} />
                  </div>
                </div>

                {/* Event Content Details */}
                <div className="schedule-item-content">
                  <div className="schedule-item-header">
                    <span className="schedule-item-time">{event.time}</span>
                    <h3 className="schedule-item-title">{event.title}</h3>
                  </div>
                  <p className="schedule-item-description">
                    {event.description}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
