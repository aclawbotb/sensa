import { NextRequest, NextResponse } from "next/server";
import { generateCandidates } from "@/lib/field";
import { searchPlacesOverpass } from "@/lib/providers/places";
import { saveSession } from "@/lib/session-store";

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function boundsFromCenter(lat: number, lng: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta,
  };
}

function normalizeToBounds(lat: number, lng: number, bounds: { north: number; south: number; east: number; west: number }) {
  const x = (lng - bounds.west) / (bounds.east - bounds.west);
  const y = (lat - bounds.south) / (bounds.north - bounds.south);
  return {
    x: Math.max(0.05, Math.min(0.95, x)),
    y: Math.max(0.05, Math.min(0.95, 1 - y)),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const query = String(body?.query || "food");
  const limit = Number(body?.limit || 28);
  const center = body?.center || { lat: 41.8857, lng: -87.6472 };
  const radiusMeters = Number(body?.radiusMeters || 2500);

  const bounds = boundsFromCenter(Number(center.lat), Number(center.lng), radiusMeters);
  let candidates = generateCandidates(query, limit);

  try {
    const realPlaces = await searchPlacesOverpass({
      query,
      lat: Number(center.lat),
      lng: Number(center.lng),
      radiusMeters,
      limit,
    });

    if (realPlaces.length > 0) {
      candidates = realPlaces.map((p, idx) => {
        const norm = normalizeToBounds(p.lat, p.lng, bounds);
        return {
          id: p.id || `c${idx + 1}`,
          x: norm.x,
          y: norm.y,
          weight: 0.45 + Math.random() * 0.5,
          name: p.name,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
        };
      });
    }
  } catch {
    // fallback to synthetic candidates
  }

  const sessionId = makeId("sess");
  const fieldId = makeId("fld");
  saveSession({ id: sessionId, fieldId, query, candidates });

  return NextResponse.json({
    sessionId,
    fieldId,
    bounds,
    candidatesMasked: candidates.map((c) => ({ id: c.id, x: c.x, y: c.y, weight: c.weight })),
  });
}
