import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { WEDDING_CONFIG } from '../src/config/wedding';
import { SUPPORTED_LOCALES, type Locale } from '../src/i18n/types';
import { detectLanguage } from '../src/i18n/detectLanguage';
import { ptPT } from '../src/i18n/translations/pt-PT';
import { en } from '../src/i18n/translations/en';
import { fr } from '../src/i18n/translations/fr';
import { I18nProvider, useI18n, TRANSLATIONS } from '../src/i18n/index';

describe('WEDDING_CONFIG', () => {
  it('contains immutable confirmed wedding facts', () => {
    expect(WEDDING_CONFIG).toEqual({
      bride: 'Madalena',
      groom: 'João',
      coupleDisplayName: 'Madalena & João',
      date: '2027-08-16',
      time: '16:00',
      timezone: 'Europe/Lisbon',
      utcInstant: '2027-08-16T15:00:00Z',
      venueName: 'Quinta da Grilla',
      venueWebsite: 'https://quintadagrilla.com',
      country: 'Portugal',
      venueAddress: 'Estrada da Grilla, 2580-081 Alenquer, Portugal',
      venueMapsUrl:
        'https://www.google.com/maps/place/Quinta+da+Grilla/@39.1173506,-9.1326937,17z/data=!3m1!4b1!4m6!3m5!1s0xd18d26fb6491eef:0x3a60d630421163cc!8m2!3d39.1173506!4d-9.1326937!16s%2Fg%2F11byyrrx2n?entry=ttu&g_ep=EgoyMDI2MTAxMS4wIKXMDSoASAFQAw%3D%3D',
      venueCoordinates: {
        lat: 39.1173506,
        lng: -9.1326937,
      },
    });
  });

  it('is frozen against mutation', () => {
    expect(Object.isFrozen(WEDDING_CONFIG)).toBe(true);
  });
});

describe('Translation Schema Symmetry & Editorial Copy', () => {
  const getKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
    return Object.entries(obj).flatMap(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return getKeys(value as Record<string, unknown>, fullKey);
      }
      return [fullKey];
    });
  };

  it('enforces 100% key parity across pt-PT, en, and fr', () => {
    const ptKeys = getKeys(ptPT as unknown as Record<string, unknown>).sort();
    const enKeys = getKeys(en as unknown as Record<string, unknown>).sort();
    const frKeys = getKeys(fr as unknown as Record<string, unknown>).sort();

    expect(enKeys).toEqual(ptKeys);
    expect(frKeys).toEqual(ptKeys);
  });

  it('contains exact canonical pt-PT copy in refined wedding register', () => {
    expect(ptPT.eyebrow).toBe('O NOSSO CASAMENTO');
    expect(ptPT.names).toBe('Madalena & João');
    expect(ptPT.invitation).toBe(
      'É com muita alegria que vos convidamos a celebrar connosco o nosso casamento.'
    );
    expect(ptPT.date).toBe('16 de agosto de 2027');
    expect(ptPT.time).toBe('16h00');
    expect(ptPT.countdownHeading).toBe('Faltam apenas...');
    expect(ptPT.countdownUnits).toEqual({
      days: 'dias',
      hours: 'horas',
      minutes: 'minutos',
      seconds: 'segundos',
    });
    expect(ptPT.venueHeading).toBe('O local');
    expect(ptPT.venueName).toBe('Quinta da Grilla');
    expect(ptPT.venueLink).toBe('Ver o local');
    expect(ptPT.venueDirections).toBe('Como chegar');
    expect(ptPT.venueAddress).toBe('Estrada da Grilla, Alenquer, Portugal');
  });

  it('contains exact en copy in refined wedding register', () => {
    expect(en.eyebrow).toBe('OUR WEDDING');
    expect(en.names).toBe('Madalena & João');
    expect(en.invitation).toBe(
      'We are delighted to invite you to celebrate our wedding with us.'
    );
    expect(en.date).toBe('16 August 2027');
    expect(en.time).toBe('4:00 PM');
    expect(en.countdownHeading).toBe('Counting down...');
    expect(en.countdownUnits).toEqual({
      days: 'days',
      hours: 'hours',
      minutes: 'minutes',
      seconds: 'seconds',
    });
    expect(en.venueHeading).toBe('The venue');
    expect(en.venueName).toBe('Quinta da Grilla');
    expect(en.venueLink).toBe('View the venue');
    expect(en.venueDirections).toBe('Get directions');
    expect(en.venueAddress).toBe('Estrada da Grilla, Alenquer, Portugal');
  });

  it('contains exact fr copy in refined wedding register', () => {
    expect(fr.eyebrow).toBe('NOTRE MARIAGE');
    expect(fr.names).toBe('Madalena & João');
    expect(fr.invitation).toBe(
      "C'est avec une immense joie que nous vous invitons à célébrer notre mariage à nos côtés."
    );
    expect(fr.date).toBe('16 août 2027');
    expect(fr.time).toBe('16h00');
    expect(fr.countdownHeading).toBe('Le compte à rebours...');
    expect(fr.countdownUnits).toEqual({
      days: 'jours',
      hours: 'heures',
      minutes: 'minutes',
      seconds: 'secondes',
    });
    expect(fr.venueHeading).toBe('Le lieu');
    expect(fr.venueName).toBe('Quinta da Grilla');
    expect(fr.venueLink).toBe('Découvrir le lieu');
    expect(fr.venueDirections).toBe('Itinéraire');
    expect(fr.venueAddress).toBe('Estrada da Grilla, Alenquer, Portugal');
  });

  it('has entries for all SUPPORTED_LOCALES in TRANSLATIONS record', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(TRANSLATIONS[locale]).toBeDefined();
    }
  });
});

describe('detectLanguage', () => {
  const makeNavigator = (languages?: string[], language?: string): Navigator => {
    return {
      languages: languages as readonly string[],
      language: language as string,
    } as unknown as Navigator;
  };

  it('detects preference ordering from nav.languages', () => {
    expect(detectLanguage(null, makeNavigator(['fr-FR', 'en-US']))).toBe('fr');
    expect(detectLanguage(null, makeNavigator(['en-GB']))).toBe('en');
    expect(detectLanguage(null, makeNavigator(['pt-BR']))).toBe('pt-PT');
    expect(detectLanguage(null, makeNavigator(['pt-PT']))).toBe('pt-PT');
  });

  it('handles case-insensitive tags', () => {
    expect(detectLanguage(null, makeNavigator(['FR-be']))).toBe('fr');
    expect(detectLanguage(null, makeNavigator(['PT-br']))).toBe('pt-PT');
    expect(detectLanguage(null, makeNavigator(['EN-us']))).toBe('en');
  });

  it('falls back to pt-PT on unsupported locales or empty array', () => {
    expect(detectLanguage(null, makeNavigator(['de-DE']))).toBe('pt-PT');
    expect(detectLanguage(null, makeNavigator(['es-ES']))).toBe('pt-PT');
    expect(detectLanguage(null, makeNavigator([]))).toBe('pt-PT');
  });

  it('skips unsupported locales and selects first supported match in order', () => {
    expect(detectLanguage(null, makeNavigator(['de-DE', 'en-US']))).toBe('en');
    expect(detectLanguage(null, makeNavigator(['it-IT', 'ja-JP', 'fr-CA']))).toBe('fr');
    expect(detectLanguage(null, makeNavigator(['es-ES', 'pt-MZ']))).toBe('pt-PT');
  });

  it('falls back to nav.language if nav.languages is empty or missing', () => {
    expect(detectLanguage(null, makeNavigator([], 'en-US'))).toBe('en');
    expect(detectLanguage(null, makeNavigator(undefined, 'fr-FR'))).toBe('fr');
    expect(detectLanguage(null, makeNavigator(undefined, 'de-DE'))).toBe('pt-PT');
  });

  it('falls back to pt-PT when navigator is undefined', () => {
    expect(detectLanguage(null, undefined)).toBe('pt-PT');
  });

  it('gives stored preference priority over browser languages', () => {
    expect(detectLanguage('en', makeNavigator(['fr-FR']))).toBe('en');
    expect(detectLanguage('fr', makeNavigator(['pt-PT']))).toBe('fr');
    expect(detectLanguage('pt-PT', makeNavigator(['en-US']))).toBe('pt-PT');
    expect(detectLanguage('PT-pt', makeNavigator(['en-US']))).toBe('pt-PT');
  });

  it('ignores invalid stored value and falls back to navigator detection', () => {
    expect(detectLanguage('invalid', makeNavigator(['fr-FR']))).toBe('fr');
    expect(detectLanguage('de-DE', makeNavigator(['en-US']))).toBe('en');
    expect(detectLanguage('', makeNavigator(['en-US']))).toBe('en');
  });
});

describe('I18nProvider and useI18n hook', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('throws error when useI18n is used outside I18nProvider', () => {
    expect(() => renderHook(() => useI18n())).toThrow(
      'useI18n must be used within an I18nProvider'
    );
  });

  it('initializes with detected language and sets document lang', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(I18nProvider, { initialLocale: 'pt-PT' }, children);

    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.locale).toBe('pt-PT');
    expect(result.current.t.eyebrow).toBe('O NOSSO CASAMENTO');
    expect(document.documentElement.lang).toBe('pt-PT');
  });

  it('switches language and synchronizes document lang and localStorage', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(I18nProvider, { initialLocale: 'pt-PT' }, children);

    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => {
      result.current.setLocale('en');
    });

    expect(result.current.locale).toBe('en');
    expect(result.current.t.eyebrow).toBe('OUR WEDDING');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('wedding_lang')).toBe('en');

    act(() => {
      result.current.setLocale('fr');
    });

    expect(result.current.locale).toBe('fr');
    expect(result.current.t.eyebrow).toBe('NOTRE MARIAGE');
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('wedding_lang')).toBe('fr');
  });
});
