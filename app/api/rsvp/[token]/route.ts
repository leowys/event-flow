import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rsvpResponseSchema } from "@/lib/validation";
import { rateLimitResponse } from "@/lib/rateLimit";
import { sendRsvpReceiptEmail } from "@/lib/rsvpReceiptEmail";

// Endpoint público — no requiere sesión, el token del invitado ES la credencial.
// No exponer más datos del evento/invitado de los estrictamente necesarios
// para renderizar la página de RSVP.

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  // Límite generoso: alguien puede recargar la página de su invitación
  // varias veces sin problema, esto solo frena scraping/fuerza bruta de tokens.
  const limited = rateLimitResponse(req, "rsvp:get", 60, 60 * 1000);
  if (limited) return limited;

  const guest = await prisma.guest.findUnique({
    where: { tokenUnico: params.token },
    include: {
      event: {
        select: {
          nombreEvento: true,
          fecha: true,
          horaInicio: true,
          horaFin: true,
          timezone: true,
          nombreLugar: true,
          direccion: true,
          mapaUrl: true,
          descripcion: true,
          imagenPortada: true,
          logo: true,
          colorPrincipal: true,
          colorSecundario: true,
          estado: true,
        },
      },
    },
  });

  if (!guest) {
    return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    guest: {
      nombre: guest.nombre,
      apellido: guest.apellido,
      estadoRsvp: guest.estadoRsvp,
      cantidadPersonasPermitidas: guest.cantidadPersonasPermitidas,
      cantidadConfirmada: guest.cantidadConfirmada,
      comentarios: guest.comentarios,
    },
    event: guest.event,
  });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  // Más estricto que el GET porque esto escribe en la base — no debería
  // hacer falta más que un puñado de intentos por minuto para un uso legítimo
  // (confirmar, corregir la cantidad, volver a mandar si hubo un error).
  const limited = rateLimitResponse(req, "rsvp:post", 10, 60 * 1000);
  if (limited) return limited;

  const guest = await prisma.guest.findUnique({ where: { tokenUnico: params.token } });
  if (!guest) {
    return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = rsvpResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { asistira, cantidadConfirmada, comentarios } = parsed.data;

  if (asistira && cantidadConfirmada !== undefined) {
    if (cantidadConfirmada > guest.cantidadPersonasPermitidas) {
      return NextResponse.json(
        { error: `El máximo permitido es ${guest.cantidadPersonasPermitidas}` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.guest.update({
    where: { tokenUnico: params.token },
    data: {
      estadoRsvp: asistira ? "CONFIRMADO" : "RECHAZADO",
      cantidadConfirmada: asistira ? cantidadConfirmada ?? 1 : 0,
      comentarios: comentarios || null,
      fechaRespuesta: new Date(),
    },
  });

  // Email post-RSVP best-effort. Si falla el envío, la respuesta igual queda
  // guardada: nunca queremos que un problema de email le muestre error al
  // invitado que ya respondió.
  void sendRsvpReceiptEmail(guest.eventId, updated, asistira).catch(() => {});

  return NextResponse.json({ guest: updated });
}
