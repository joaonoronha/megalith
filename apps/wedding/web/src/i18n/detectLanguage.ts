import { type Locale } from './types';

function normalizeTag(tag: string): Locale | null {
  const clean = tag.trim().toLowerCase();
  if (clean === 'pt' || clean.startsWith('pt-') || clean.startsWith('pt_')) {
    return 'pt-PT';
  }
  if (clean === 'en' || clean.startsWith('en-') || clean.startsWith('en_')) {
    return 'en';
  }
  if (clean === 'fr' || clean.startsWith('fr-') || clean.startsWith('fr_')) {
    return 'fr';
  }
  return null;
}

export function detectLanguage(
  stored?: string | null,
  nav?: Navigator
): Locale {
  if (stored) {
    const matchedStored = normalizeTag(stored);
    if (matchedStored) {
      return matchedStored;
    }
  }

  const activeNav =
    arguments.length >= 2
      ? nav
      : typeof navigator !== 'undefined'
        ? navigator
        : undefined;

  if (activeNav) {
    const candidates: string[] = [];

    if (Array.isArray(activeNav.languages)) {
      candidates.push(...activeNav.languages);
    }

    if (typeof activeNav.language === 'string') {
      candidates.push(activeNav.language);
    }

    for (const tag of candidates) {
      if (typeof tag === 'string') {
        const matched = normalizeTag(tag);
        if (matched) {
          return matched;
        }
      }
    }
  }

  return 'pt-PT';
}
