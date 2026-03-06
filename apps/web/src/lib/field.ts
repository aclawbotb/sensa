import { Candidate } from "./types";

type FieldPoint = Pick<Candidate, "id" | "x" | "y" | "weight">;

export function fieldAt(x: number, y: number, points: FieldPoint[]): number {
  let value = 0;
  for (const p of points) {
    const dx = x - p.x;
    const dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    const sigma = 0.03 + (1 - p.weight) * 0.05;
    value += p.weight * Math.exp(-d2 / (2 * sigma * sigma));
  }
  return Math.max(0, Math.min(1, value));
}

export function pickNearest(x: number, y: number, points: Candidate[]): Candidate {
  let best = points[0];
  let bestD2 = Number.POSITIVE_INFINITY;
  for (const p of points) {
    const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCandidates(query: string, limit = 28): Candidate[] {
  const seed = hashString(query.toLowerCase());
  const rand = mulberry32(seed);

  const chicagoCenter = { lat: 41.8857, lng: -87.6472 };
  const places = [
    "Hidden Ember BBQ",
    "Kinetic Muay Thai",
    "Granite Pulse Climbing",
    "Dawn Spoon Breakfast",
    "River Steel Gym",
    "Coal & Salt Kitchen",
    "North Loop Ramen",
    "Sable Street Tacos",
    "Moonrise Bakery",
    "West Loop Noodles",
    "Quiet Bell Coffee",
    "Iron Lantern Brisket",
  ];

  return Array.from({ length: limit }).map((_, i) => {
    const x = 0.08 + rand() * 0.84;
    const y = 0.08 + rand() * 0.84;
    const w = 0.4 + rand() * 0.6;
    const lat = chicagoCenter.lat + (rand() - 0.5) * 0.03;
    const lng = chicagoCenter.lng + (rand() - 0.5) * 0.04;
    const name = `${places[i % places.length]} #${i + 1}`;
    return {
      id: `c${i + 1}`,
      x,
      y,
      weight: w,
      name,
      address: `${120 + i} W Loop St, Chicago, IL`,
      lat,
      lng,
    };
  });
}
