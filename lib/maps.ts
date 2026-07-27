type EventMapData = {
  nombreLugar?: string | null;
  direccion?: string | null;
  mapaUrl?: string | null;
};

function isHttpUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildMapQuery(event: EventMapData) {
  return [event.nombreLugar, event.direccion]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function buildMapSearchQueries(event: EventMapData) {
  return [
    buildMapQuery(event),
    event.direccion?.trim() ?? "",
    event.nombreLugar?.trim() ?? "",
  ].filter((query, index, all) => query && all.indexOf(query) === index);
}

export function buildMapLink(event: EventMapData) {
  if (isHttpUrl(event.mapaUrl)) return event.mapaUrl!;

  const queries = buildMapSearchQueries(event);
  if (queries.length === 0) return "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queries[0])}`;
}

export function buildMapEmbedUrl(event: EventMapData) {
  const query = buildMapQuery(event);
  if (!query) return "";

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function buildLocationLabel(event: EventMapData) {
  return [event.nombreLugar, event.direccion]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

type NominatimResult = {
  lat?: string;
  lon?: string;
};

export async function buildStaticMapImageUrl(event: EventMapData) {
  const queries = buildMapSearchQueries(event);
  if (queries.length === 0) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    let result: NominatimResult | undefined;

    for (const query of queries) {
      const params = new URLSearchParams({
        format: "json",
        limit: "1",
        q: query,
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          "User-Agent": "Event Flow local MVP",
        },
        signal: controller.signal,
      });

      if (!res.ok) continue;

      const data = (await res.json()) as NominatimResult[];
      result = data[0];
      if (result?.lat && result.lon) break;
    }

    if (!result?.lat || !result?.lon) return "";

    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";

    const center = `${lat},${lon}`;
    const staticParams = new URLSearchParams({
      center,
      zoom: "15",
      size: "520x220",
      markers: `${center},red-pushpin`,
    });

    return `https://staticmap.openstreetmap.de/staticmap.php?${staticParams.toString()}`;
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}
