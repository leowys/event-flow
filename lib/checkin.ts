const CHECKIN_PREFIX = "eventflow:checkin:";

export function buildCheckinCode(token: string) {
  return `${CHECKIN_PREFIX}${token}`;
}

export function parseCheckinCode(rawCode: string) {
  const code = rawCode.trim();
  if (code.startsWith(CHECKIN_PREFIX)) {
    return code.slice(CHECKIN_PREFIX.length);
  }

  try {
    const url = new URL(code);
    const token = url.searchParams.get("token");
    if (token) return token;

    const rsvpMatch = url.pathname.match(/\/rsvp\/([^/]+)/);
    if (rsvpMatch?.[1]) return rsvpMatch[1];
  } catch {
    // Si no es URL, lo tratamos como token plano.
  }

  return code;
}
