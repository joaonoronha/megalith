export interface WeddingConfig {
  readonly bride: string;
  readonly groom: string;
  readonly coupleDisplayName: string;
  readonly date: string;
  readonly time: string;
  readonly timezone: string;
  readonly utcInstant: string;
  readonly venueName: string;
  readonly venueWebsite: string;
  readonly country: string;
}

export const WEDDING_CONFIG: WeddingConfig = Object.freeze({
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
});
