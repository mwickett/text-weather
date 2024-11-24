export interface Coordinates {
  lat: number;
  lng: number;
}

export interface What3WordsResponse {
  coordinates: {
    lat: number;
    lng: number;
  };
  map: string;
  nearestPlace: string;
  words: string;
  language: string;
  status: {
    code: number;
    message: string;
  };
}

export class LocationProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationProcessingError';
  }
}
