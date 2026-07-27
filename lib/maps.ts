import { PNG } from "pngjs";

type EventMapData = {
  nombreLugar?: string | null;
  direccion?: string | null;
  mapaUrl?: string | null;
};

const TILE_SIZE = 256;
const EMAIL_MAP_WIDTH = 480;
const EMAIL_MAP_HEIGHT = 180;
const EMAIL_MAP_ZOOM = 15;
const DEFAULT_MAP_CONTEXT = process.env.EVENT_FLOW_MAP_CONTEXT ?? "Buenos Aires, Argentina";

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
  const query = buildMapQuery(event);
  const address = event.direccion?.trim() ?? "";
  const place = event.nombreLugar?.trim() ?? "";
  const context = DEFAULT_MAP_CONTEXT.trim();

  return [
    query,
    context && query ? `${query}, ${context}` : "",
    context && address ? `${address}, ${context}` : "",
    address,
    place,
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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeEventLocation(queries: string[]) {
  for (const query of queries) {
    const params = new URLSearchParams({
      format: "json",
      limit: "1",
      q: query,
    });
    const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": "Event Flow local MVP",
      },
    });

    if (!res.ok) continue;

    const data = (await res.json()) as NominatimResult[];
    const result = data[0];
    if (result?.lat && result.lon) return result;
  }

  return null;
}

export async function buildStaticMapImageDataUrl(event: EventMapData) {
  const queries = buildMapSearchQueries(event);
  if (queries.length === 0) return "";

  try {
    const result = await geocodeEventLocation(queries);

    if (!result?.lat || !result?.lon) return "";

    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";

    const imageBuffer = await renderOpenStreetMapPreview(lat, lon);
    if (!imageBuffer || imageBuffer.length > 900_000) return "";

    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
  } catch {
    return "";
  }
}

async function renderOpenStreetMapPreview(lat: number, lon: number) {
  const center = latLonToWorldPixel(lat, lon, EMAIL_MAP_ZOOM);
  const topLeftX = center.x - EMAIL_MAP_WIDTH / 2;
  const topLeftY = center.y - EMAIL_MAP_HEIGHT / 2;
  const firstTileX = Math.floor(topLeftX / TILE_SIZE);
  const firstTileY = Math.floor(topLeftY / TILE_SIZE);
  const lastTileX = Math.floor((topLeftX + EMAIL_MAP_WIDTH) / TILE_SIZE);
  const lastTileY = Math.floor((topLeftY + EMAIL_MAP_HEIGHT) / TILE_SIZE);
  const output = new PNG({ width: EMAIL_MAP_WIDTH, height: EMAIL_MAP_HEIGHT });

  output.data.fill(245);

  for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
    for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
      const tile = await fetchMapTile(tileX, tileY, EMAIL_MAP_ZOOM);
      if (!tile) continue;

      const destX = Math.round(tileX * TILE_SIZE - topLeftX);
      const destY = Math.round(tileY * TILE_SIZE - topLeftY);
      copyTileToCanvas(tile, output, destX, destY);
    }
  }

  drawMapMarker(output, Math.round(EMAIL_MAP_WIDTH / 2), Math.round(EMAIL_MAP_HEIGHT / 2));
  return PNG.sync.write(output);
}

function latLonToWorldPixel(lat: number, lon: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;

  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

async function fetchMapTile(tileX: number, tileY: number, zoom: number) {
  const maxTile = 2 ** zoom;
  const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;
  if (tileY < 0 || tileY >= maxTile) return null;

  const res = await fetchWithTimeout(`https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`, {
    headers: {
      "User-Agent": "Event Flow local MVP",
    },
  }, 3500);

  if (!res.ok) return null;
  const contentType = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "image/png") return null;

  return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
}

function copyTileToCanvas(tile: PNG, output: PNG, destX: number, destY: number) {
  for (let y = 0; y < tile.height; y += 1) {
    const outY = destY + y;
    if (outY < 0 || outY >= output.height) continue;

    for (let x = 0; x < tile.width; x += 1) {
      const outX = destX + x;
      if (outX < 0 || outX >= output.width) continue;

      const sourceIndex = (tile.width * y + x) << 2;
      const outputIndex = (output.width * outY + outX) << 2;
      output.data[outputIndex] = tile.data[sourceIndex];
      output.data[outputIndex + 1] = tile.data[sourceIndex + 1];
      output.data[outputIndex + 2] = tile.data[sourceIndex + 2];
      output.data[outputIndex + 3] = tile.data[sourceIndex + 3];
    }
  }
}

function drawMapMarker(output: PNG, centerX: number, centerY: number) {
  drawCircle(output, centerX, centerY - 8, 12, [190, 24, 45, 255]);
  drawCircle(output, centerX, centerY - 8, 5, [255, 255, 255, 255]);

  for (let y = centerY + 2; y <= centerY + 18; y += 1) {
    const halfWidth = Math.max(1, Math.round((18 - (y - centerY)) / 3));
    for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 1) {
      setPixel(output, x, y, [190, 24, 45, 255]);
    }
  }
}

function drawCircle(output: PNG, centerX: number, centerY: number, radius: number, color: [number, number, number, number]) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance <= radius) setPixel(output, x, y, color);
    }
  }
}

function setPixel(output: PNG, x: number, y: number, color: [number, number, number, number]) {
  if (x < 0 || x >= output.width || y < 0 || y >= output.height) return;

  const index = (output.width * y + x) << 2;
  output.data[index] = color[0];
  output.data[index + 1] = color[1];
  output.data[index + 2] = color[2];
  output.data[index + 3] = color[3];
}
