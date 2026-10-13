import React from 'react';
import { useI18n } from '../i18n';
import { WEDDING_CONFIG } from '../config/wedding';
import { calculateCountdown, CountdownResult } from '../utils/countdown';

export interface WeddingCountdownProps {
  className?: string;
  targetUtc?: string;
}

/**
 * WeddingCountdown component renders an editorial, responsive countdown card
 * calculating remaining time until Madalena & João's wedding instant.
 *
 * Features:
 * - Timezone-safe UTC calculation (canonical: 2027-08-16T15:00:00Z / 16h00 Lisbon)
 * - Tabular numbers to prevent layout jitter on second ticks
 * - Elegant double border, warm gold diamond motif, and multilingual unit labels
 * - Screen-reader accessible polite live region (role="region", aria-live="polite")
 */
export const WeddingCountdown: React.FC<WeddingCountdownProps> = ({
  className = '',
  targetUtc = WEDDING_CONFIG.utcInstant,
}) => {
  const { t } = useI18n();

  const [countdown, setCountdown] = React.useState<CountdownResult>(() =>
    calculateCountdown(targetUtc)
  );

  React.useEffect(() => {
    // Initial sync
    setCountdown(calculateCountdown(targetUtc));

    const intervalId = window.setInterval(() => {
      setCountdown(calculateCountdown(targetUtc));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [targetUtc]);

  return (
    <section
      role="region"
      aria-live="polite"
      aria-label={t.a11y.countdownLive}
      className={`wedding-countdown-section ${className}`}
    >
      <div className="countdown-card">
        {/* Subtle decorative gold diamond motif */}
        <div className="countdown-diamond-motif" aria-hidden="true">
          <span className="diamond-symbol">✦</span>
        </div>

        {/* Section Heading */}
        <h2 className="countdown-heading">{t.countdownHeading}</h2>

        {/* Units Grid */}
        <div className="countdown-grid">
          {/* Days */}
          <div className="countdown-unit-box">
            <span
              className="countdown-digit"
              data-testid="countdown-days"
            >
              {countdown.days}
            </span>
            <span className="countdown-label">{t.countdownUnits.days}</span>
          </div>

          <div className="countdown-separator" aria-hidden="true">
            ·
          </div>

          {/* Hours */}
          <div className="countdown-unit-box">
            <span
              className="countdown-digit"
              data-testid="countdown-hours"
            >
              {countdown.hours}
            </span>
            <span className="countdown-label">{t.countdownUnits.hours}</span>
          </div>

          <div className="countdown-separator" aria-hidden="true">
            ·
          </div>

          {/* Minutes */}
          <div className="countdown-unit-box">
            <span
              className="countdown-digit"
              data-testid="countdown-minutes"
            >
              {countdown.minutes}
            </span>
            <span className="countdown-label">{t.countdownUnits.minutes}</span>
          </div>

          <div className="countdown-separator" aria-hidden="true">
            ·
          </div>

          {/* Seconds */}
          <div className="countdown-unit-box">
            <span
              className="countdown-digit"
              data-testid="countdown-seconds"
            >
              {countdown.seconds}
            </span>
            <span className="countdown-label">{t.countdownUnits.seconds}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
