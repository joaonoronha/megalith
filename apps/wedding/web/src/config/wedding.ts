export interface VenueCoordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface SaveTheDateConfig {
  readonly unlockUtc: string;
  readonly videoUrl: string;
  readonly posterUrl?: string;
}

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
  readonly venueAddress: string;
  readonly venueMapsUrl: string;
  readonly venueCoordinates: VenueCoordinates;
  readonly saveTheDate: SaveTheDateConfig;
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
  venueAddress: 'Estrada da Grilla, 2580-081 Alenquer, Portugal',
  venueMapsUrl:
    'https://www.google.com/maps/place/Quinta+da+Grilla/@39.1173506,-9.1326937,17z/data=!3m1!4b1!4m6!3m5!1s0xd18d26fb6491eef:0x3a60d630421163cc!8m2!3d39.1173506!4d-9.1326937!16s%2Fg%2F11byyrrx2n?entry=ttu&g_ep=EgoyMDI2MTAxMS4wIKXMDSoASAFQAw%3D%3D',
  venueCoordinates: Object.freeze({
    lat: 39.1173506,
    lng: -9.1326937,
  }),
  saveTheDate: Object.freeze({
    unlockUtc:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INVITATION_UNLOCK_UTC) ||
      '2027-02-16T00:00:00Z',
    videoUrl:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SAVE_THE_DATE_VIDEO_URL) ||
      '/assets/save-the-date.MOV',
  }),
});
