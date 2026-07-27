import Papa from "papaparse";
import { z } from "zod";

// Formato esperado (según la spec original): Nombre, Apellido, Email, Teléfono.
// Se acepta encabezado en cualquier orden, con o sin acentos/mayúsculas, y una
// columna opcional de cantidad de personas permitidas.
const HEADER_ALIASES: Record<string, keyof RawGuestRow> = {
  nombre: "nombre",
  apellido: "apellido",
  email: "email",
  correo: "email",
  "e-mail": "email",
  telefono: "telefono",
  tel: "telefono",
  cantidad: "cantidad",
  cantidadpersonaspermitidas: "cantidad",
  "cantidad de personas": "cantidad",
};

type RawGuestRow = {
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  cantidad?: string;
};

export type ParsedGuestRow = {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  cantidadPersonasPermitidas: number;
};

export type CsvRowError = {
  row: number; // 1-indexed, contando el header como fila 1 (igual que se ve en Excel/Sheets)
  reason: string;
};

export type ParseCsvResult = {
  valid: ParsedGuestRow[];
  errors: CsvRowError[];
  // Duplicados detectados dentro del mismo archivo (no contra la base todavía).
  duplicatesInFile: CsvRowError[];
};

const rowSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  email: z.string().email(),
  telefono: z.string().optional(),
  cantidad: z.string().optional(),
});

function normalizeHeader(header: string): keyof RawGuestRow | null {
  const clean = header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // saca acentos para matchear alias sin tilde
  return HEADER_ALIASES[clean] ?? null;
}

const MAX_ROWS = 5000; // límite razonable para evitar imports gigantes que bloqueen el request

export function parseGuestsCsv(csvText: string): ParseCsvResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => {
      const normalized = normalizeHeader(header);
      return normalized ?? header; // si no matchea ningún alias, se deja tal cual (columna extra ignorada)
    },
  });

  const valid: ParsedGuestRow[] = [];
  const errors: CsvRowError[] = [];
  const duplicatesInFile: CsvRowError[] = [];
  const seenEmails = new Set<string>();

  const rows = parsed.data.slice(0, MAX_ROWS);

  rows.forEach((rawRow, index) => {
    const excelRow = index + 2; // +1 por el header, +1 porque index es 0-based

    const candidate: RawGuestRow = {
      nombre: rawRow.nombre?.trim(),
      apellido: rawRow.apellido?.trim(),
      email: rawRow.email?.trim().toLowerCase(),
      telefono: rawRow.telefono?.trim(),
      cantidad: rawRow.cantidad?.trim(),
    };

    const result = rowSchema.safeParse(candidate);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path[0] ?? "datos";
      errors.push({
        row: excelRow,
        reason: `Campo "${field}" inválido o faltante`,
      });
      return;
    }

    const email = result.data.email;
    if (seenEmails.has(email)) {
      duplicatesInFile.push({ row: excelRow, reason: `Email repetido en el archivo: ${email}` });
      return;
    }
    seenEmails.add(email);

    let cantidadPersonasPermitidas = 1;
    if (result.data.cantidad) {
      const parsedCantidad = parseInt(result.data.cantidad, 10);
      if (!Number.isNaN(parsedCantidad) && parsedCantidad >= 1 && parsedCantidad <= 20) {
        cantidadPersonasPermitidas = parsedCantidad;
      }
    }

    valid.push({
      nombre: result.data.nombre,
      apellido: result.data.apellido,
      email,
      telefono: result.data.telefono || null,
      cantidadPersonasPermitidas,
    });
  });

  return { valid, errors, duplicatesInFile };
}
