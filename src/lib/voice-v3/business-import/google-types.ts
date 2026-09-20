/** Client-safe Google Maps search result shape (no server secrets). */
export type GoogleMapsSearchResult = {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  place_id?: string;
  data_id?: string;
  ludocid?: string;
  hours?: unknown;
};
