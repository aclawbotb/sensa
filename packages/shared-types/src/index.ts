export type LatLng = { lat: number; lng: number };

export type SearchRequest = {
  query: string;
  center: LatLng;
  radiusMeters?: number;
  limit?: number;
  seed?: string;
};

export type CandidateMasked = {
  id: string;
  x: number;
  y: number;
  weight: number;
};

export type SearchResponse = {
  sessionId: string;
  fieldId: string;
  bounds: { north: number; south: number; east: number; west: number };
  candidatesMasked: CandidateMasked[];
};

export type ResolveRequest = {
  sessionId: string;
  tap: { x: number; y: number };
};

export type ResolvedPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  mapsUrl: string;
};

export type ResolveResponse = {
  picked: ResolvedPlace;
  distanceMeters: number;
};
