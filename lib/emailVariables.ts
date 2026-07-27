// Variables soportadas por las plantillas, según la spec original más las
// dos variables de botones directos (confirmar / no asistiré).
export type TemplateVariables = {
  guest_name: string;
  event_name: string;
  event_date: string;
  event_time: string;
  event_location: string;
  event_map_url: string;
  rsvp_link: string;
  rsvp_confirm_link: string;
  rsvp_decline_link: string;
};

// Escapa cada valor antes de insertarlo en el HTML. Es un paso de seguridad
// necesario: guest_name sale de datos cargados por el organizador (o por un
// CSV importado), así que hay que tratarlo como no confiable — sin este
// escape, un nombre de invitado como `<img src=x onerror=...>` terminaría
// ejecutándose dentro del email.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const URL_VARIABLES = new Set([
  "event_map_url",
  "rsvp_link",
  "rsvp_confirm_link",
  "rsvp_decline_link",
]);

export function renderTemplate(html: string, variables: TemplateVariables): string {
  let output = html;
  for (const [key, value] of Object.entries(variables)) {
    const token = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    // Los links de RSVP son URLs generadas por el sistema, no texto libre:
    // no hace falta (ni conviene) escaparlos como HTML, pero sí sanitizarlos
    // como URL para evitar cosas como "javascript:".
    const safeValue = URL_VARIABLES.has(key) ? sanitizeUrl(value) : escapeHtml(value);
    output = output.replace(token, safeValue);
  }
  return output;
}

function sanitizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}
