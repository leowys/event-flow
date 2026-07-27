import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { guestSchema } from "@/lib/validation";
import { generateGuestToken } from "@/lib/tokens";

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const guests = await prisma.guest.findMany({
    where: { eventId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ guests });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const guest = await prisma.guest.create({
    data: {
      eventId: params.id,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      telefono: data.telefono || null,
      cantidadPersonasPermitidas: data.cantidadPersonasPermitidas,
      tokenUnico: generateGuestToken(),
    },
  });

  return NextResponse.json({ guest });
}
