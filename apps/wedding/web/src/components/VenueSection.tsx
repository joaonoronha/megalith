import React from 'react';
import { useI18n } from '../i18n';
import { WEDDING_CONFIG } from '../config/wedding';

export interface VenueSectionProps {
  className?: string;
}

/**
 * VenueSection displays Quinta da Grilla wedding location details
 * in an elegant architectural arched card with external links and accessibility features.
 */
export const VenueSection: React.FC<VenueSectionProps> = ({ className = '' }) => {
  const { t } = useI18n();

  return (
    <section
      className={`venue-section ${className}`}
      aria-labelledby="venue-heading"
    >
      <div className="venue-card">
        {/* Architectural Arch Top & Botanical Motif */}
        <div className="venue-arch-header" aria-hidden="true">
          <svg
            className="venue-arch-sprig"
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
              stroke="var(--color-olive, #505B46)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M44 19 C42 15 36 14 34 17 C35 20 40 21 44 19 Z"
              fill="var(--color-sage, #A7B09A)"
            />
            <path
              d="M30 18 C28 14 22 13 20 16 C21 19 26 20 30 18 Z"
              fill="var(--color-olive, #505B46)"
              opacity="0.8"
            />
            {/* Right sprig branch */}
            <path
              d="M66 20 C78 19 88 17 102 24"
              stroke="var(--color-olive, #505B46)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M76 19 C78 15 84 14 86 17 C85 20 80 21 76 19 Z"
              fill="var(--color-sage, #A7B09A)"
            />
            <path
              d="M90 18 C92 14 98 13 100 16 C99 19 94 20 90 18 Z"
              fill="var(--color-olive, #505B46)"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Section Subtitle */}
        <p id="venue-heading" className="venue-eyebrow">
          {t.venueHeading}
        </p>

        {/* Venue Name */}
        <h2 className="venue-title">{t.venueName}</h2>

        {/* Location & Details */}
        <p className="venue-location">
          <span>{WEDDING_CONFIG.country}</span>
          <span className="venue-dot" aria-hidden="true">
            ·
          </span>
          <span>{t.date}</span>
          <span className="venue-dot" aria-hidden="true">
            ·
          </span>
          <span>{t.time}</span>
        </p>

        {/* Decorative Divider */}
        <div className="venue-divider" aria-hidden="true">
          <span className="venue-divider-line" />
          <span className="venue-divider-diamond">✦</span>
          <span className="venue-divider-line" />
        </div>

        {/* External Link Action */}
        <div className="venue-action-container">
          <a
            href={WEDDING_CONFIG.venueWebsite}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.a11y.venueExternalLink}
            className="venue-link-button"
          >
            <span>{t.venueLink}</span>
            <svg
              className="venue-external-icon"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M5 11L11 5M11 5H6.5M11 5V9.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};
