import type { TranslationSchema } from '../types';

export const ptPT: TranslationSchema = {
  eyebrow: 'O NOSSO CASAMENTO',
  names: 'Madalena & João',
  invitation:
    'É com muita alegria que vos convidamos a celebrar connosco o nosso casamento.',
  date: '16 de agosto de 2027',
  time: '16h00',
  countdownHeading: 'Faltam apenas...',
  countdownUnits: {
    days: 'dias',
    hours: 'horas',
    minutes: 'minutos',
    seconds: 'segundos',
  },
  schedule: {
    eyebrow: 'O NOSSO DIA',
    title: '16 DE AGOSTO, 2027',
    events: [
      {
        time: '15:30',
        title: 'Chegada dos Convidados',
        description:
          'Receção calorosa aos convidados com bebidas de boas-vindas antes do início da cerimónia.',
      },
      {
        time: '16:00',
        title: 'Cerimónia',
        description:
          'A celebração do nosso casamento com a troca de votos e alianças.',
      },
      {
        time: '17:00',
        title: 'Fotos de Grupo & Brinde',
        description:
          'Reunimo-nos com família e amigos para as fotografias comemorativas e o brinde aos noivos.',
      },
      {
        time: '17:30',
        title: 'Cocktail & Aperitivos',
        description:
          'Bebidas refrescantes, aperitivos e música ao vivo nos jardins da quinta.',
      },
      {
        time: '19:30',
        title: 'Jantar & Celebração',
        description:
          'Banquete à mesa com momentos inesquecíveis, discursos e partilha.',
      },
      {
        time: '22:00',
        title: 'Corte do Bolo & Festa',
        description:
          'Corte do bolo dos noivos, abertura da pista de dança e festa pela noite dentro.',
      },
    ],
  },
  venueHeading: 'O local',
  venueName: 'Quinta da Grilla',
  venueLink: 'Ver o local',
  venueDirections: 'Como chegar',
  venueAddress: 'Estrada da Grilla, Alenquer, Portugal',
  a11y: {
    languageSelector: 'Selecionar idioma',
    venueExternalLink: 'Abrir website da Quinta da Grilla numa nova janela',
    venueMapsLink: 'Abrir direções para a Quinta da Grilla no Google Maps',
    venueMapFrame: 'Mapa da localização da Quinta da Grilla',
    countdownLive: 'Tempo restante para o casamento',
  },
  saveTheDate: {
    badge: 'SAVE THE DATE',
    subtitle: 'O nosso convite de casamento será revelado em breve.',
    quoteIntro1: 'Há dias que guardamos no coração.',
    quoteIntro2: 'Este queremos partilhar convosco.',
    venueName: 'QUINTA DA GRILLA',
    country: 'PORTUGAL',
    countdownHeading: 'A NOSSA HISTÓRIA CONTINUA EM...',
    countdownSubtext: 'Volta em fevereiro para descobrires todos os detalhes do nosso grande dia.',
    calendarButton: 'GUARDAR A DATA',
    closingQuote1: 'O amor trouxe-nos até aqui.',
    closingQuote2: 'E não faria sentido celebrar este dia',
    closingQuote3: 'sem as pessoas que fazem parte da nossa história.',
    monogram: 'M | J',
    playPrompt: 'Reproduzir vídeo',
    pausePrompt: 'Pausar vídeo',
    videoAriaLabel: 'Vídeo Save the Date de Madalena & João',
    videoFallback: 'O seu navegador não suporta a reprodução deste vídeo.',
    weddingDateTeaser: '16 de Agosto de 2027 · Quinta da Grilla',
  },
};
