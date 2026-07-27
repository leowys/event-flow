import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { rsvpResponseSchema } from "@/lib/validation";
import { renderTemplate } from "@/lib/emailVariables";
import { sendEmail } from "@/lib/email";
import { buildDefaultTemplate } from "@/lib/defaultEmailTemplate";
import { rateLimitResponse } from "@/lib/rateLimit";
import { formatEventDate } from "@/lib/eventDatetime";
import { buildCheckinCode } from "@/lib/checkin";

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

async function sendRsvpReceiptEmail(
  eventId: string,
  guest: { id: string; nombre: string; apellido: string; email: string; tokenUnico: string },
  asistira: boolean
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;

  // Para confirmaciones usamos la plantilla subida de tipo CONFIRMACION si
  // existe. Para rechazos usamos una plantilla básica específica para evitar
  // mandar por accidente un texto de "gracias por confirmar asistencia".
  const uploadedTemplate = asistira
    ? await prisma.emailTemplate.findFirst({
        where: { eventId, kind: "CONFIRMACION" },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const htmlTemplate =
    uploadedTemplate?.htmlProcesado
      ? uploadedTemplate.htmlProcesado
      : buildDefaultTemplate(
          {
            nombreEvento: event.nombreEvento,
            colorPrincipal: event.colorPrincipal,
            colorSecundario: event.colorSecundario,
            logo: event.logo,
          },
          asistira ? "CONFIRMACION" : "RECHAZO"
        );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const rsvpLink = `${appUrl}/rsvp/${guest.tokenUnico}`;
  let html = renderTemplate(htmlTemplate, {
    guest_name: `${guest.nombre} ${guest.apellido}`,
    event_name: event.nombreEvento,
    event_date: formatEventDate(event.fecha),
    event_time: event.horaInicio,
    event_location: event.nombreLugar ?? "",
    rsvp_link: rsvpLink,
    rsvp_confirm_link: `${rsvpLink}?accion=confirmar`,
    rsvp_decline_link: `${rsvpLink}?accion=no`,
  });

  if (asistira) {
    const qrDataUrl = await QRCode.toDataURL(buildCheckinCode(guest.tokenUnico), {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    });
    html = appendCheckinQrBlock(html, qrDataUrl, event.colorPrincipal);
  }

  const result = await sendEmail({
    userId: event.userId,
    to: guest.email,
    subject: asistira
      ? `Confirmación: ${event.nombreEvento}`
      : `Respuesta registrada: ${event.nombreEvento}`,
    html,
  });

  await prisma.emailLog.create({
    data: {
      eventId,
      guestId: guest.id,
      templateId: uploadedTemplate?.id ?? null,
      kind: "CONFIRMACION",
      status: result.ok ? "ENVIADO" : "FALLIDO",
      proveedorId: result.ok ? result.providerId : null,
      error: result.ok ? null : result.error,
    },
  });
}

function appendCheckinQrBlock(html: string, qrDataUrl: string, accentColor: string) {
  const qrBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr>
        <td align="center" style="padding:24px 18px; border:1px solid #e5e5e5; border-radius:16px; background-color:#fafafa;">
          <p style="font-size:16px; line-height:1.5; color:#171717; font-weight:600; margin:0 0 8px;">
            Tu QR de ingreso
          </p>
          <p style="font-size:14px; line-height:1.6; color:#525252; margin:0 0 18px;">
            Guardá este correo o descargá/capturá este QR. Te lo van a pedir al ingresar al evento.
          </p>
          <img src="${qrDataUrl}" width="220" height="220" alt="QR de ingreso" style="display:block; width:220px; height:220px; margin:0 auto; border:8px solid #ffffff; border-radius:12px;" />
          <p style="font-size:12px; line-height:1.5; color:#737373; margin:16px 0 0;">
            Este código es personal y corresponde a tu confirmación de asistencia.
          </p>
          <div style="height:3px; width:48px; background-color:${accentColor}; border-radius:999px; margin:18px auto 0;"></div>
        </td>
      </tr>
    </table>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${qrBlock}</body>`);
  }

  return `${html}${qrBlock}`;
}
