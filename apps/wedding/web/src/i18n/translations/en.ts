import type { TranslationSchema } from '../types';

export const en: TranslationSchema = {
  eyebrow: 'OUR WEDDING',
  names: 'Madalena & João',
  invitation:
    'We are delighted to invite you to celebrate our wedding with us.',
  date: '16 August 2027',
  time: '4:00 PM',
  countdownHeading: 'Counting down...',
  countdownUnits: {
    days: 'days',
    hours: 'hours',
    minutes: 'minutes',
    seconds: 'seconds',
  },
  schedule: {
    eyebrow: 'WEDDING DAY',
    title: '16 AUGUST 2027',
    events: [
      {
        time: '15:30',
        title: 'Guest Arrival & Welcome Drinks',
        description:
          'Guests arrive and enjoy light refreshments before the ceremony begins.',
      },
      {
        time: '16:00',
        title: 'Ceremony',
        description:
          'The wedding ceremony with vows, ring exchange, and celebration.',
      },
      {
        time: '17:00',
        title: 'Group Photos & Toast',
        description:
          'Family and friends gather for formal and candid photographs and a toast.',
      },
      {
        time: '17:30',
        title: 'Cocktail Hour',
        description:
          'Drinks, appetizers, and live music while enjoying the estate gardens.',
      },
      {
        time: '19:30',
        title: 'Dinner & Celebration',
        description:
          'Seated dinner with memorable speeches, dining, and joyful moments.',
      },
      {
        time: '22:00',
        title: 'Cake Cutting & Party',
        description:
          'Cake cutting, opening of the dance floor, and partying into the night.',
      },
    ],
  },
  venueHeading: 'The venue',
  venueName: 'Quinta da Grilla',
  venueLink: 'View the venue',
  venueDirections: 'Get directions',
  venueAddress: 'Estrada da Grilla, Alenquer, Portugal',
  a11y: {
    languageSelector: 'Select language',
    venueExternalLink: 'Open Quinta da Grilla website in a new window',
    venueMapsLink: 'Open directions to Quinta da Grilla in Google Maps',
    venueMapFrame: 'Location map of Quinta da Grilla',
    countdownLive: 'Time remaining until the wedding',
  },
};
