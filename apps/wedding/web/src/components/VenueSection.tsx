import React from 'react';
import { useI18n } from '../i18n';
import { WEDDING_CONFIG } from '../config/wedding';

export interface VenueSectionProps {
  className?: string;
}

/**
 * VenueSection displays Quinta da Grilla wedding location details
 * in an architectural arched card with an interactive arched Google Maps snippet
 * and direct action buttons for directions and venue information.
 */
export const VenueSection: React.FC<VenueSectionProps> = ({ className = '' }) => {
  const { t, locale } = useI18n();

  const mapLang = locale === 'pt-PT' ? 'pt' : locale === 'fr' ? 'fr' : 'en';
  const mapEmbedUrl = `https://maps.google.com/maps?q=${WEDDING_CONFIG.venueCoordinates.lat},${WEDDING_CONFIG.venueCoordinates.lng}&hl=${mapLang}&z=15&output=embed`;

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

        {/* Section Eyebrow */}
        <p id="venue-heading" className="venue-eyebrow">
          {t.venueHeading}
        </p>

        {/* Venue Title */}
        <h2 className="venue-title">{t.venueName}</h2>

        {/* Arched Map Snippet */}
        <div className="venue-map-wrapper">
          <div className="venue-map-arch-container">
            <iframe
              title={t.a11y.venueMapFrame}
              src={mapEmbedUrl}
              className="venue-map-iframe"
              loading="eager"
              allowFullScreen
            />
          </div>
        </div>

        {/* Location & Details */}
        <div className="venue-location-details">
          <p className="venue-address-text">{WEDDING_CONFIG.venueAddress}</p>
          <p className="venue-datetime-text">
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
        </div>

        {/* Decorative Divider */}
        <div className="venue-divider" aria-hidden="true">
          <span className="venue-divider-line" />
          <span className="venue-divider-diamond">✦</span>
          <span className="venue-divider-line" />
        </div>

        {/* Action Buttons: Directions & Venue Website */}
        <div className="venue-actions-group">
          {/* Get Directions Link */}
          <a
            href={WEDDING_CONFIG.venueMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.a11y.venueMapsLink}
            className="venue-btn venue-btn--primary"
          >
            <svg
              className="venue-btn-icon"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10 2C6.686 2 4 4.686 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6zm0 8.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{t.venueDirections}</span>
          </a>

          {/* View Venue Website Link */}
          <a
            href={WEDDING_CONFIG.venueWebsite}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.a11y.venueExternalLink}
            className="venue-btn venue-btn--secondary"
          >
            <svg
              className="venue-btn-icon"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10 3.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM3.5 10h13M10 3.5c1.7 2 2.6 4.2 2.6 6.5s-.9 4.5-2.6 6.5c-1.7-2-2.6-4.2-2.6-6.5s.9-4.5 2.6-6.5z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{t.venueLink}</span>
          </a>
        </div>
      </div>
    </section>
  );
};
