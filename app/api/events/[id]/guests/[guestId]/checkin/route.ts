import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

async function loadOwnedGuest(eventId: string, guestId: string) {
  return prisma.guest.findFirst({
    where: { id: guestId, eventId },
  });
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

  const updatedGuest = await prisma.guest.update({
    where: { id: guest.id },
    data: { checkedInAt: null, checkedInByUserId: null },
  });

  return NextResponse.json({ guest: updatedGuest });
}
