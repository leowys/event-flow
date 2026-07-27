import { customAlphabet, nanoid } from "nanoid";

// Token de RSVP: 100% aleatorio (CSPRNG vía nanoid), no predecible ni secuencial.
// Nunca usar el id incremental de la base de datos como token público.
export function generateGuestToken() {
  return nanoid(32);
}

export function generateVerificationToken() {
  return nanoid(32);
}

const slugAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const randomSlugSuffix = customAlphabet(slugAlphabet, 5);

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Genera un slug base + sufijo random para evitar colisiones
// (ej. dos organizadores creando "casamiento-juan-y-ana").
export function generateUniqueSlug(nombreEvento: string) {
  const base = slugify(nombreEvento) || "evento";
  return `${base}-${randomSlugSuffix()}`;
}
