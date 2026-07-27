import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseCheckinCode } from "@/lib/checkin";

const checkinSchema = z.object({
  code: z.string().min(6, "Ingresá o escaneá un código válido"),
});

async function loadOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.userId !== userId) return null;
  return event;
}

function serializeGuest(guest: {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  cantidadPersonasPermitidas: number;
  cantidadConfirmada: number | null;
  estadoRsvp: "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";
  checkedInAt: Date | null;
}) {
  return {
    ...guest,
    checkedInAt: guest.checkedInAt?.toISOString() ?? null,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await loadOwnedEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const guests = await prisma.guest.findMany({
    where: { eventId: event.id },
    orderBy: [{ checkedInAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      cantidadPersonasPermitidas: true,
      cantidadConfirmada: true,
      estadoRsvp: true,
      checkedInAt: true,
    },
  });

  return NextResponse.json({
    guests: guests.map(serializeGuest),
    total: guests.length,
    checkedIn: guests.filter((g) => g.checkedInAt).length,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await loadOwnedEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Código inválido" },
      { status: 400 }
    );
  }

  const token = parseCheckinCode(parsed.data.code);
  const guest = await prisma.guest.findFirst({
    where: { tokenUnico: token, eventId: event.id },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      cantidadPersonasPermitidas: true,
      cantidadConfirmada: true,
      estadoRsvp: true,
      checkedInAt: true,
    },
  });

  if (!guest) {
    return NextResponse.json({ error: "El QR no corresponde a este evento" }, { status: 404 });
  }

  if (guest.checkedInAt) {
    return NextResponse.json({
      status: "already_checked_in",
      guest: serializeGuest(guest),
      message: "Este invitado ya estaba ingresado",
    });
  }

  const updatedGuest = await prisma.guest.update({
    where: { id: guest.id },
    data: {
      checkedInAt: new Date(),
      checkedInByUserId: session.userId,
    },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      cantidadPersonasPermitidas: true,
      cantidadConfirmada: true,
      estadoRsvp: true,
      checkedInAt: true,
    },
  });

  return NextResponse.json({
    status: "checked_in",
    guest: serializeGuest(updatedGuest),
    message: "Ingreso registrado",
  });
}
