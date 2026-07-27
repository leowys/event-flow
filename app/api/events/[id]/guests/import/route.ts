import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseGuestsCsv } from "@/lib/csvImport";
import { generateGuestToken } from "@/lib/tokens";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB, de sobra para miles de filas de texto

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo CSV" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "El archivo debe ser un .csv" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "El archivo supera el tamaño máximo (2MB)." }, { status: 400 });
  }

  const csvText = await file.text();
  const { valid, errors, duplicatesInFile } = parseGuestsCsv(csvText);

  if (valid.length === 0 && errors.length === 0 && duplicatesInFile.length === 0) {
    return NextResponse.json(
      {
        error:
          "No se encontraron filas para importar. Verificá que el CSV tenga las columnas Nombre, Apellido, Email (y opcionalmente Teléfono).",
      },
      { status: 400 }
    );
  }

  // Duplicados contra invitados que YA existen en este evento (por email,
  // sin distinguir mayúsculas/minúsculas). Se resuelven aparte de los
  // duplicados dentro del mismo archivo, detectados en parseGuestsCsv.
  const existingGuests = await prisma.guest.findMany({
    where: { eventId: event.id },
    select: { email: true },
  });
  const existingEmails = new Set(existingGuests.map((g) => g.email.toLowerCase()));

  const toCreate = valid.filter((row) => !existingEmails.has(row.email));
  const duplicatesInDb = valid.filter((row) => existingEmails.has(row.email));

  if (toCreate.length > 0) {
    await prisma.guest.createMany({
      data: toCreate.map((row) => ({
        eventId: event.id,
        nombre: row.nombre,
        apellido: row.apellido,
        email: row.email,
        telefono: row.telefono,
        cantidadPersonasPermitidas: row.cantidadPersonasPermitidas,
        tokenUnico: generateGuestToken(),
      })),
    });
  }

  return NextResponse.json({
    creados: toCreate.length,
    duplicadosEnArchivo: duplicatesInFile.length,
    duplicadosExistentes: duplicatesInDb.length,
    filasInvalidas: errors.length,
    detalleErrores: [
      ...errors,
      ...duplicatesInFile,
      ...duplicatesInDb.map((row) => ({ row: 0, reason: `Ya existe un invitado con el email ${row.email}` })),
    ].slice(0, 50), // no devolvemos miles de líneas de detalle si el archivo es grande
  });
}
