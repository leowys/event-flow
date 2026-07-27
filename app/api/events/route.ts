import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { eventSchema } from "@/lib/validation";
import { generateUniqueSlug } from "@/lib/tokens";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: { userId: session.userId },
    orderBy: { fecha: "asc" },
    include: {
      _count: { select: { guests: true } },
      guests: { select: { estadoRsvp: true } },
    },
  });

  const withCounts = events.map((e) => {
    const confirmados = e.guests.filter((g) => g.estadoRsvp === "CONFIRMADO").length;
    const rechazados = e.guests.filter((g) => g.estadoRsvp === "RECHAZADO").length;
    const pendientes = e.guests.filter((g) => g.estadoRsvp === "PENDIENTE").length;
    const { guests, ...rest } = e;
    return { ...rest, totalInvitados: e._count.guests, confirmados, rechazados, pendientes };
  });

  return NextResponse.json({ events: withCounts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const slugPublico = generateUniqueSlug(data.nombreEvento);

  const event = await prisma.event.create({
    data: {
      userId: session.userId,
      nombreEvento: data.nombreEvento,
      tipoEvento: data.tipoEvento,
      fecha: new Date(data.fecha),
      horaInicio: data.horaInicio,
      horaFin: data.horaFin || null,
      timezone: data.timezone,
      descripcion: data.descripcion || null,
      nombreLugar: data.nombreLugar || null,
      direccion: data.direccion || null,
      mapaUrl: data.mapaUrl || null,
      logo: data.logo || null,
      colorPrincipal: data.colorPrincipal,
      colorSecundario: data.colorSecundario,
      slugPublico,
      estado: "BORRADOR",
    },
  });

  return NextResponse.json({ event });
}
