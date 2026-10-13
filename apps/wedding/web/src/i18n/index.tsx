import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import {
  type Locale,
  type TranslationSchema,
  type I18nContextValue,
} from './types';
import { ptPT } from './translations/pt-PT';
import { en } from './translations/en';
import { fr } from './translations/fr';
import { detectLanguage } from './detectLanguage';

export const STORAGE_KEY = 'wedding_lang';

export const TRANSLATIONS: Record<Locale, TranslationSchema> = {
  'pt-PT': ptPT,
  en: en,
  fr: fr,
};

function getStoredLocale(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore quota or access errors
  }
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale && initialLocale in TRANSLATIONS) {
      return initialLocale;
    }
    return detectLanguage(getStoredLocale());
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    persistStoredLocale(newLocale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  }, []);

  useEffect(() => {
    if (initialLocale && initialLocale in TRANSLATIONS) {
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: TRANSLATIONS[locale],
      setLocale,
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export * from './types';
export { detectLanguage } from './detectLanguage';
