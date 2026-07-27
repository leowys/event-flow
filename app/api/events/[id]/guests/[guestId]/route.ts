import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { guestSchema } from "@/lib/validation";

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

async function loadOwnedGuest(eventId: string, guestId: string) {
  return prisma.guest.findFirst({
    where: { id: guestId, eventId },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; guestId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const guest = await loadOwnedGuest(event.id, params.guestId);
  if (!guest) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updatedGuest = await prisma.guest.update({
    where: { id: guest.id },
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      telefono: data.telefono || null,
      cantidadPersonasPermitidas: data.cantidadPersonasPermitidas,
    },
  });

  return NextResponse.json({ guest: updatedGuest });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; guestId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const guest = await loadOwnedGuest(event.id, params.guestId);
  if (!guest) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

  await prisma.guest.delete({ where: { id: guest.id } });

  return NextResponse.json({ ok: true });
}
