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

export function buildMapLink(event: EventMapData) {
  if (isHttpUrl(event.mapaUrl)) return event.mapaUrl!;

  const query = buildMapQuery(event);
  if (!query) return "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
