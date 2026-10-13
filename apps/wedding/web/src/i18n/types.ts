export const SUPPORTED_LOCALES = ['pt-PT', 'en', 'fr'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface CountdownUnits {
  readonly days: string;
  readonly hours: string;
  readonly minutes: string;
  readonly seconds: string;
}

export interface A11yTranslations {
  readonly languageSelector: string;
  readonly venueExternalLink: string;
  readonly countdownLive: string;
}

export interface TranslationSchema {
  readonly eyebrow: string;
  readonly names: string;
  readonly invitation: string;
  readonly date: string;
  readonly time: string;
  readonly countdownHeading: string;
  readonly countdownUnits: CountdownUnits;
  readonly venueHeading: string;
  readonly venueName: string;
  readonly venueLink: string;
  readonly a11y: A11yTranslations;
}

export interface I18nContextValue {
  readonly locale: Locale;
  readonly t: TranslationSchema;
  readonly setLocale: (locale: Locale) => void;
}
