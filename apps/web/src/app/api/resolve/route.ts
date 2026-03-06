import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";
import { pickNearest } from "@/lib/field";

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || "");
  const tap = body?.tap || { x: 0.5, y: 0.5 };

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const picked = pickNearest(Number(tap.x), Number(tap.y), session.candidates);
  const home = { lat: 41.8857, lng: -87.6472 }; // near 730 W Couch Pl area

  return NextResponse.json({
    picked: {
      id: picked.id,
      name: picked.name,
      address: picked.address,
      lat: picked.lat,
      lng: picked.lng,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${picked.lat},${picked.lng}`,
    },
    distanceMeters: Math.round(metersBetween(home, { lat: picked.lat, lng: picked.lng })),
  });
}
