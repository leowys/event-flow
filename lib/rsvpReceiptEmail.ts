import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/emailVariables";
import { sendEmail } from "@/lib/email";
import { buildDefaultTemplate } from "@/lib/defaultEmailTemplate";
import { formatEventDate } from "@/lib/eventDatetime";
import { buildCheckinCode } from "@/lib/checkin";
import { buildLocationLabel, buildMapLink } from "@/lib/maps";

export async function sendRsvpReceiptEmail(
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
    event_location: buildLocationLabel(event),
    event_map_url: buildMapLink(event),
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
    html = insertCheckinQrBlock(html, qrDataUrl, event.colorPrincipal);
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

  return result;
}

function insertCheckinQrBlock(html: string, qrDataUrl: string, accentColor: string) {
  const qrSection = `
            <tr>
              <td style="padding:0 28px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
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
                </table>
              </td>
            </tr>`;

  const fallbackBlock = `
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

  if (html.includes("<!-- EVENT_FLOW_EMAIL_FOOTER -->")) {
    return html.replace("<!-- EVENT_FLOW_EMAIL_FOOTER -->", qrSection);
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${fallbackBlock}</body>`);
  }

  return `${html}${fallbackBlock}`;
}
