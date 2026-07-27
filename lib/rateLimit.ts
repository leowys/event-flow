import { NextRequest, NextResponse } from "next/server";

// Rate limiter en memoria, de ventana fija. Suficiente para un solo proceso
// (como corre hoy este proyecto en Docker Compose, un único contenedor de
// la app). LIMITACIÓN CONOCIDA: si en algún momento se escala a más de una
// instancia de la app detrás de un load balancer, cada instancia tendría su
// propio contador y el límite efectivo se multiplicaría por la cantidad de
// instancias. Para eso hace falta un store compartido (ej. Redis) — queda
// fuera del alcance de este MVP.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Limpieza periódica para no acumular memoria indefinidamente con IPs viejas.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();
function cleanupIfNeeded() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export function getClientIp(req: NextRequest): string {
  // Detrás de un proxy/load balancer, la IP real viene en x-forwarded-for.
  // En Docker Compose sin proxy adicional, req.ip suele venir vacío, por eso
  // el fallback a un valor fijo (mejor que reventar, aunque agrupe a todos
  // los clientes sin proxy bajo un mismo balde — poco probable en producción
  // real detrás de Nginx/Cloudflare, que sí setean este header).
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanupIfNeeded();

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

// Helper para usar directo en una route: si excede el límite, devuelve la
// respuesta 429 lista para retornar; si no, devuelve null y se sigue normal.
export function rateLimitResponse(
  req: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const ip = getClientIp(req);
  const result = checkRateLimit(`${scope}:${ip}`, limit, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
    );
  }

  return null;
}
