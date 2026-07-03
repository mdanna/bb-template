import rawContent from "@/data/content.json";
import type { LocaleCode } from "@/i18n/index";

export type L10n = Record<LocaleCode, string>;

export interface MapBookmark {
  lat: number;
  lng: number;
  label: string;
}

export interface Review {
  text: L10n;
  author: string;
}

export interface AreaPlace {
  name: L10n;
  comment: L10n;
}

export interface Details {
  entirePlace: L10n;
  quietCourtyard: L10n;
  roomInfo: L10n;
  maxGuests: L10n;
  neighborhood: L10n;
}

export interface SiteContent {
  siteTitle: L10n;
  locationDisplay: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  bookingEmail: string;
  vatNumber: string;
  cin: string;
  metaDescription: string;
  hostName: string;
  airbnbUrl: string;
  airbnbRating: number;
  airbnbReviewCount: number;
  mapLat: number;
  mapLng: number;
  mapBookmarks: MapBookmark[];
  heroImage: string;
  galleryImages: string[];
  amenities: L10n[];
  reviews: Review[];
  heroSubtitle: L10n;
  storyTitle: L10n;
  storyParagraphs: L10n[];
  areaDescription: L10n;
  areaPlaces: AreaPlace[];
  details: Details;
}

export const CONTENT: SiteContent = rawContent as SiteContent;
