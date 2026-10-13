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
  schedule: {
    eyebrow: 'JOUR DU MARIAGE',
    title: '16 AOÛT 2027',
    events: [
      {
        time: '15:30',
        title: 'Arrivée des Invités & Rafraîchissements',
        description:
          'Accueil des invités et rafraîchissements avant le début de la cérémonie.',
      },
      {
        time: '16:00',
        title: 'Cérémonie',
        description:
          "La célébration de notre union avec l'échange des vœux et des alliances.",
      },
      {
        time: '17:00',
        title: 'Photos de Groupe & Toast',
        description:
          'Moments partagés en famille et entre amis pour les photos et le toast aux mariés.',
      },
      {
        time: '17:30',
        title: 'Cocktail & Apéritif',
        description:
          'Boissons, bouchées et musique live dans les jardins du domaine.',
      },
      {
        time: '19:30',
        title: 'Dîner & Célébration',
        description:
          'Banquet convivial à table, discours émouvants et moments de partage.',
      },
      {
        time: '22:00',
        title: 'Pièce Montée & Soirée',
        description:
          "Découpe de la pièce montée, ouverture du bal et fête jusqu'au bout de la nuit.",
      },
    ],
  },
  venueHeading: 'Le lieu',
  venueName: 'Quinta da Grilla',
  venueLink: 'Découvrir le lieu',
  venueDirections: 'Itinéraire',
  venueAddress: 'Estrada da Grilla, Alenquer, Portugal',
  a11y: {
    languageSelector: 'Choisir la langue',
    venueExternalLink: 'Ouvrir le site de la Quinta da Grilla dans un nouvel onglet',
    venueMapsLink: "Ouvrir l'itinéraire vers Quinta da Grilla sur Google Maps",
    venueMapFrame: 'Plan de situation de Quinta da Grilla',
    countdownLive: "Temps restant jusqu'au mariage",
  },
};
