export type Candidate = {
  id: string;
  x: number;
  y: number;
  weight: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type SearchResponse = {
  sessionId: string;
  fieldId: string;
  bounds: { north: number; south: number; east: number; west: number };
  candidatesMasked: Array<{ id: string; x: number; y: number; weight: number }>;
};

export type ResolveResponse = {
  picked: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    mapsUrl: string;
  };
  distanceMeters: number;
};
