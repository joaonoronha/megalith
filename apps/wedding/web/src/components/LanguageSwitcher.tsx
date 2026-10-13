import React from 'react';
import { useI18n, type Locale } from '../i18n';
import '../styles/global.css';

interface LocaleItem {
  readonly code: Locale;
  readonly label: string;
  readonly ariaLabel: string;
}

const LOCALES: readonly LocaleItem[] = [
  { code: 'pt-PT', label: 'PT', ariaLabel: 'Português' },
  { code: 'en', label: 'EN', ariaLabel: 'English' },
  { code: 'fr', label: 'FR', ariaLabel: 'Français' },
];

export interface LanguageSwitcherProps {
  readonly className?: string;
}

/**
 * Discreet language switcher rendering PT · EN · FR.
 * Strictly adheres to editorial guidelines: typography-only, zero national flags.
 * Accessible with dynamic aria-pressed states and screen-reader localized labels.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps = {}): React.JSX.Element {
  const { locale, setLocale, t } = useI18n();

  const containerClasses = ['language-switcher', className].filter(Boolean).join(' ');

  return (
    <nav className={containerClasses} aria-label={t.a11y.languageSelector}>
      <div className="language-switcher-list" role="group">
        {LOCALES.map((item, index) => {
          const isActive = locale === item.code;
          return (
            <React.Fragment key={item.code}>
              {index > 0 && (
                <span className="language-switcher-separator" aria-hidden="true">
                  ·
                </span>
              )}
              <button
                type="button"
                className={`language-switcher-btn ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                aria-label={item.ariaLabel}
                onClick={() => setLocale(item.code)}
              >
                {item.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
