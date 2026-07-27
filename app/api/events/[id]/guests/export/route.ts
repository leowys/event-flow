import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const guests = await prisma.guest.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Nombre",
    "Apellido",
    "Email",
    "Telefono",
    "Cantidad permitida",
    "Estado RSVP",
    "Cantidad confirmada",
    "Fecha carga",
    "Fecha invitacion",
    "Fecha confirmacion",
    "Fecha rechazo",
    "Fecha ingreso",
    "Ingresado por usuario",
    "Comentarios",
  ];

  const rows = guests.map((guest) => [
    guest.nombre,
    guest.apellido,
    guest.email,
    guest.telefono,
    guest.cantidadPersonasPermitidas,
    guest.estadoRsvp,
    guest.cantidadConfirmada,
    csvDate(guest.createdAt),
    csvDate(guest.invitacionEnviadaEn),
    guest.estadoRsvp === "CONFIRMADO" ? csvDate(guest.fechaRespuesta) : "",
    guest.estadoRsvp === "RECHAZADO" ? csvDate(guest.fechaRespuesta) : "",
    csvDate(guest.checkedInAt),
    guest.checkedInByUserId,
    guest.comentarios,
  ]);

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invitados-${event.slugPublico}.csv"`,
    },
  });
}
