export type Candidate = { id: string; x: number; y: number; weight: number };

export function fieldAt(x: number, y: number, points: Candidate[]): number {
  let value = 0;
  for (const p of points) {
    const dx = x - p.x;
    const dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    const sigma = 0.03 + (1 - p.weight) * 0.04;
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
