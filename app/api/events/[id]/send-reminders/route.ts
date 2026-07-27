import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { renderTemplate } from "@/lib/emailVariables";
import { sendEmail } from "@/lib/email";
import { buildDefaultTemplate } from "@/lib/defaultEmailTemplate";
import { formatEventDate } from "@/lib/eventDatetime";

async function loadOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.userId !== userId) return null;
  return event;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await loadOwnedEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const pendingGuests = await prisma.guest.findMany({
    where: { eventId: event.id, estadoRsvp: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
  });

  if (pendingGuests.length === 0) {
    return NextResponse.json(
      { error: "No hay invitados pendientes de confirmación" },
      { status: 400 }
    );
  }

  const template = await prisma.emailTemplate.findFirst({
    where: { eventId: event.id, kind: "RECORDATORIO" },
    orderBy: { createdAt: "desc" },
  });

  const templateHtml =
    template?.htmlProcesado ??
    buildDefaultTemplate(
      {
        nombreEvento: event.nombreEvento,
        colorPrincipal: event.colorPrincipal,
        colorSecundario: event.colorSecundario,
        logo: event.logo,
      },
      "RECORDATORIO"
    );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const eventDateLabel = formatEventDate(event.fecha);
  const results: { guestId: string; ok: boolean; error?: string }[] = [];

  for (const guest of pendingGuests) {
    const rsvpLink = `${appUrl}/rsvp/${guest.tokenUnico}`;
    const html = renderTemplate(templateHtml, {
      guest_name: `${guest.nombre} ${guest.apellido}`,
      event_name: event.nombreEvento,
      event_date: eventDateLabel,
      event_time: event.horaInicio,
      event_location: event.nombreLugar ?? "",
      rsvp_link: rsvpLink,
      rsvp_confirm_link: `${rsvpLink}?accion=confirmar`,
      rsvp_decline_link: `${rsvpLink}?accion=no`,
    });

    const result = await sendEmail({
      userId: session.userId,
      to: guest.email,
      subject: `Recordatorio: ${event.nombreEvento}`,
      html,
    });

    await prisma.emailLog.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        templateId: template?.id ?? null,
        kind: "RECORDATORIO",
        status: result.ok ? "ENVIADO" : "FALLIDO",
        proveedorId: result.ok ? result.providerId : null,
        error: result.ok ? null : result.error,
      },
    });

    results.push({ guestId: guest.id, ok: result.ok, error: result.ok ? undefined : result.error });
  }

  const enviados = results.filter((r) => r.ok).length;
  const fallidos = results.length - enviados;

  return NextResponse.json({ enviados, fallidos, results });
}
