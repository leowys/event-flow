import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendRsvpReceiptEmail } from "@/lib/rsvpReceiptEmail";

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string; guestId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const guest = await prisma.guest.findFirst({
    where: { id: params.guestId, eventId: event.id },
  });
  if (!guest) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

  if (guest.estadoRsvp !== "CONFIRMADO") {
    return NextResponse.json(
      { error: "Solo se puede reenviar QR a invitados confirmados" },
      { status: 400 }
    );
  }

  const result = await sendRsvpReceiptEmail(event.id, guest, true);
  if (!result?.ok) {
    return NextResponse.json(
      { error: result?.error ?? "No se pudo reenviar el QR" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
