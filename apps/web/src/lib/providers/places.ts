export type RealPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

function normalizeQuery(q: string) {
  return q.trim().toLowerCase();
}

function toOverpassFilter(query: string): string {
  const q = normalizeQuery(query);
  if (q.includes("brisket") || q.includes("bbq")) return '["amenity"~"restaurant|fast_food"]["cuisine"~"bbq",i]';
  if (q.includes("breakfast")) return '["amenity"~"cafe|restaurant|fast_food"]["breakfast"!="no"]';
  if (q.includes("climb")) return '["leisure"="sports_centre"]["sport"~"climbing",i]';
  if (q.includes("muay") || q.includes("thai") || q.includes("boxing")) return '["leisure"="sports_centre"]["sport"~"martial_arts|boxing|taekwondo|karate",i]';
  if (q.includes("coffee")) return '["amenity"="cafe"]';
  if (q.includes("gym")) return '["leisure"="fitness_centre"]';
  return '["amenity"~"restaurant|cafe|fast_food"]';
}

export async function searchPlacesOverpass(params: {
  query: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
}): Promise<RealPlace[]> {
  const { query, lat, lng, radiusMeters, limit } = params;
  const filter = toOverpassFilter(query);

  const overpass = `
[out:json][timeout:25];
(
  node${filter}(around:${radiusMeters},${lat},${lng});
  way${filter}(around:${radiusMeters},${lat},${lng});
  relation${filter}(around:${radiusMeters},${lat},${lng});
);
out center ${Math.max(40, limit * 2)};
`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: overpass,
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
  const data = (await res.json()) as {
    elements?: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const elements = data.elements ?? [];
  const places = elements
    .map((el) => {
      const latv = el.lat ?? el.center?.lat;
      const lngv = el.lon ?? el.center?.lon;
      if (latv == null || lngv == null) return null;
      const tags = el.tags ?? {};
      const name = tags.name || tags.brand || tags.operator || "Unnamed Place";
      const address = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"] || "Chicago",
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        id: `${el.type}-${el.id}`,
        name,
        address: address || "Chicago, IL",
        lat: latv,
        lng: lngv,
      } as RealPlace;
    })
    .filter((p): p is RealPlace => Boolean(p));

  const dedup = new Map<string, RealPlace>();
  for (const p of places) {
    const key = `${p.name.toLowerCase()}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`;
    if (!dedup.has(key)) dedup.set(key, p);
  }

  return Array.from(dedup.values()).slice(0, limit);
}
