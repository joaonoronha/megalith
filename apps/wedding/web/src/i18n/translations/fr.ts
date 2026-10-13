import type { TranslationSchema } from '../types';

export const fr: TranslationSchema = {
  eyebrow: 'NOTRE MARIAGE',
  names: 'Madalena & João',
  invitation:
    "C'est avec une immense joie que nous vous invitons à célébrer notre mariage à nos côtés.",
  date: '16 août 2027',
  time: '16h00',
  countdownHeading: 'Le compte à rebours...',
  countdownUnits: {
    days: 'jours',
    hours: 'heures',
    minutes: 'minutes',
    seconds: 'secondes',
  },
  venueHeading: 'Le lieu',
  venueName: 'Quinta da Grilla',
  venueLink: 'Découvrir le lieu',
  a11y: {
    languageSelector: 'Choisir la langue',
    venueExternalLink: 'Ouvrir le site de la Quinta da Grilla dans un nouvel onglet',
    countdownLive: "Temps restant jusqu'au mariage",
  },
};
