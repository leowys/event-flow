import AdmZip from "adm-zip";
import sanitizeHtml from "sanitize-html";

// Postcards exporta un ZIP con un HTML principal (index.html o el único .html
// del paquete) más una carpeta de imágenes referenciadas con rutas relativas.
// Acá extraemos el HTML, lo sanitizamos (evita que un ZIP con <script> o
// handlers inline se cuele en un email) y devolvemos también los recursos
// para poder subirlos aparte y reescribir sus URLs.

const MAX_ZIP_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, generoso para un template de email
const ALLOWED_IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export type ExtractedTemplate = {
  html: string;
  images: { relativePath: string; buffer: Buffer; ext: string }[];
};

export class TemplateProcessingError extends Error {}

export function extractTemplateFromZip(zipBuffer: Buffer): ExtractedTemplate {
  if (zipBuffer.length > MAX_ZIP_SIZE_BYTES) {
    throw new TemplateProcessingError("El archivo ZIP supera el tamaño máximo permitido (15MB).");
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw new TemplateProcessingError("El archivo no es un ZIP válido.");
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory);

  const htmlEntry =
    entries.find((e) => e.entryName.toLowerCase() === "index.html") ??
    entries.find((e) => e.entryName.toLowerCase().endsWith(".html"));

  if (!htmlEntry) {
    throw new TemplateProcessingError(
      "No se encontró ningún archivo .html dentro del ZIP exportado desde Postcards."
    );
  }

  const rawHtml = htmlEntry.getData().toString("utf-8");

  // Sanitización: se permite el HTML/CSS típico de un email (tablas, estilos
  // inline, imágenes) pero se elimina cualquier script o atributo de evento.
  const html = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "html",
      "head",
      "body",
      "style",
      "img",
      "table",
      "tr",
      "td",
      "th",
      "tbody",
      "thead",
      "center",
      "font",
    ]),
    allowedAttributes: false, // permite todos los atributos de las tags permitidas...
    allowedSchemes: ["http", "https", "mailto", "cid"],
    allowVulnerableTags: true, // ...pero disallowedTagsMode + exclusiveFilter abajo sacan lo peligroso
    exclusiveFilter: (frame) => frame.tag === "script",
    transformTags: {
      "*": (tagName, attribs) => {
        const clean = { ...attribs };
        for (const key of Object.keys(clean)) {
          if (key.toLowerCase().startsWith("on")) delete clean[key]; // onclick, onload, etc.
        }
        return { tagName, attribs: clean };
      },
    },
  });

  const images = entries
    .filter((e) => ALLOWED_IMAGE_EXT.some((ext) => e.entryName.toLowerCase().endsWith(ext)))
    .map((e) => ({
      relativePath: e.entryName,
      buffer: e.getData(),
      ext: e.entryName.slice(e.entryName.lastIndexOf(".")),
    }));

  return { html, images };
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// Reemplaza las rutas relativas de <img src="..."> por data URIs embebidos.
// Es una solución simple para no depender de un storage externo (S3/R2) en
// este MVP; el trade-off es que el email pesa más. Cuando se defina el
// proveedor de storage (Etapa 0/6), esto se puede cambiar por URLs públicas
// sin tocar el resto del flujo de envío.
export function inlineTemplateImages(template: ExtractedTemplate): string {
  let html = template.html;

  for (const image of template.images) {
    const mime = MIME_BY_EXT[image.ext.toLowerCase()] ?? "application/octet-stream";
    const dataUri = `data:${mime};base64,${image.buffer.toString("base64")}`;

    // Cubre tanto la ruta completa como solo el nombre de archivo, porque
    // Postcards a veces referencia "images/foo.png" y a veces "./foo.png".
    const fileName = image.relativePath.split("/").pop()!;
    const escapedFull = image.relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    html = html
      .replace(new RegExp(`(["'])(?:\\./)?${escapedFull}\\1`, "g"), `$1${dataUri}$1`)
      .replace(new RegExp(`(["'])(?:\\./)?(?:[^"']*/)?${escapedName}\\1`, "g"), `$1${dataUri}$1`);
  }

  return html;
}
