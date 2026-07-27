import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { eventSchema } from "@/lib/validation";

async function loadOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.userId !== userId) return null;
  return event;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await loadOwnedEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  return NextResponse.json({ event });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await loadOwnedEvent(params.id, session.userId);
  if (!existing) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = eventSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const event = await prisma.event.update({
    where: { id: params.id },
    data: {
      ...(data.nombreEvento && { nombreEvento: data.nombreEvento }),
      ...(data.tipoEvento && { tipoEvento: data.tipoEvento }),
      ...(data.fecha && { fecha: new Date(data.fecha) }),
      ...(data.horaInicio && { horaInicio: data.horaInicio }),
      ...(data.horaFin !== undefined && { horaFin: data.horaFin || null }),
      ...(data.timezone && { timezone: data.timezone }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion || null }),
      ...(data.nombreLugar !== undefined && { nombreLugar: data.nombreLugar || null }),
      ...(data.direccion !== undefined && { direccion: data.direccion || null }),
      ...(data.mapaUrl !== undefined && { mapaUrl: data.mapaUrl || null }),
      ...(data.logo !== undefined && { logo: data.logo || null }),
      ...(data.colorPrincipal && { colorPrincipal: data.colorPrincipal }),
      ...(data.colorSecundario && { colorSecundario: data.colorSecundario }),
      ...(data.estado && { estado: data.estado }),
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await loadOwnedEvent(params.id, session.userId);
  if (!existing) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  await prisma.event.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
