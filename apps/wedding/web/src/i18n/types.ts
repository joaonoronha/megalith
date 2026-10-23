export const SUPPORTED_LOCALES = ['pt-PT', 'en', 'fr'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface CountdownUnits {
  readonly days: string;
  readonly hours: string;
  readonly minutes: string;
  readonly seconds: string;
}

export interface ScheduleEvent {
  readonly time: string;
  readonly title: string;
  readonly description: string;
}

export interface ScheduleTranslations {
  readonly eyebrow: string;
  readonly title: string;
  readonly events: readonly ScheduleEvent[];
}

export interface A11yTranslations {
  readonly languageSelector: string;
  readonly venueExternalLink: string;
  readonly venueMapsLink: string;
  readonly venueMapFrame: string;
  readonly countdownLive: string;
}

export interface SaveTheDateTranslations {
  readonly badge: string;
  readonly subtitle: string;
  readonly quoteIntro1: string;
  readonly quoteIntro2: string;
  readonly venueName: string;
  readonly country: string;
  readonly countdownHeading: string;
  readonly countdownSubtext: string;
  readonly calendarButton: string;
  readonly closingQuote1: string;
  readonly closingQuote2: string;
  readonly closingQuote3: string;
  readonly monogram: string;
  readonly playPrompt: string;
  readonly pausePrompt: string;
  readonly videoAriaLabel: string;
  readonly videoFallback: string;
  readonly weddingDateTeaser: string;
}

export interface TranslationSchema {
  readonly eyebrow: string;
  readonly names: string;
  readonly invitation: string;
  readonly date: string;
  readonly time: string;
  readonly countdownHeading: string;
  readonly countdownUnits: CountdownUnits;
  readonly schedule: ScheduleTranslations;
  readonly venueHeading: string;
  readonly venueName: string;
  readonly venueLink: string;
  readonly venueDirections: string;
  readonly venueAddress: string;
  readonly a11y: A11yTranslations;
  readonly saveTheDate: SaveTheDateTranslations;
}

export interface I18nContextValue {
  readonly locale: Locale;
  readonly t: TranslationSchema;
  readonly setLocale: (locale: Locale) => void;
}
