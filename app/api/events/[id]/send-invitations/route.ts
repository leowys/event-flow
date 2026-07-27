import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendInvitationsSchema } from "@/lib/validation";
import { renderTemplate } from "@/lib/emailVariables";
import { sendEmail } from "@/lib/email";
import { buildDefaultTemplate, DefaultTemplateKind } from "@/lib/defaultEmailTemplate";
import { formatEventDate } from "@/lib/eventDatetime";
import { buildLocationLabel, buildMapLink, buildStaticMapImageDataUrl } from "@/lib/maps";

type SendTemplateKind = Exclude<DefaultTemplateKind, "RECHAZO">;

async function loadOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.userId !== userId) return null;
  return event;
}

// El templateId puede ser el id real de una plantilla subida, o el valor
// sintético "default:INVITACION" / "default:CONFIRMACION" / "default:RECORDATORIO"
// que representa la plantilla básica generada automáticamente (sin subir ZIP).
function parseDefaultTemplateId(templateId: string): SendTemplateKind | null {
  const match = templateId.match(/^default:(INVITACION|CONFIRMACION|RECORDATORIO)$/);
  return match ? (match[1] as SendTemplateKind) : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await loadOwnedEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = sendInvitationsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { templateId, guestIds } = parsed.data;

  const defaultKind = parseDefaultTemplateId(templateId);
  let templateHtml: string;
  let templateDbId: string | null;
  let templateKind: SendTemplateKind;

  if (defaultKind) {
    templateHtml = buildDefaultTemplate(
      {
        nombreEvento: event.nombreEvento,
        colorPrincipal: event.colorPrincipal,
        colorSecundario: event.colorSecundario,
        logo: event.logo,
      },
      defaultKind
    );
    templateDbId = null;
    templateKind = defaultKind;
  } else {
    const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.eventId !== event.id) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }
    templateHtml = template.htmlProcesado;
    templateDbId = template.id;
    templateKind = template.kind as SendTemplateKind;
  }

  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds }, eventId: event.id },
  });
  if (guests.length === 0) {
    return NextResponse.json({ error: "No se encontraron invitados válidos" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const eventDateLabel = formatEventDate(event.fecha);
  const eventLocationLabel = buildLocationLabel(event);
  const eventMapUrl = buildMapLink(event);
  const eventMapImageSrc = eventMapUrl ? await buildStaticMapImageDataUrl(event) : "";

  const results: { guestId: string; ok: boolean; error?: string }[] = [];

  // Envío secuencial: para el volumen esperado en un MVP (decenas/pocos
  // cientos de invitados) evita saturar el rate limit del proveedor. Si el
  // volumen crece, esto debería moverse a una cola (ej. background job).
  for (const guest of guests) {
    const rsvpLink = `${appUrl}/rsvp/${guest.tokenUnico}`;
    let html = renderTemplate(templateHtml, {
      guest_name: `${guest.nombre} ${guest.apellido}`,
      event_name: event.nombreEvento,
      event_date: eventDateLabel,
      event_time: event.horaInicio,
      event_location: eventLocationLabel,
      event_map_url: eventMapUrl,
      rsvp_link: rsvpLink,
      rsvp_confirm_link: `${rsvpLink}?accion=confirmar`,
      rsvp_decline_link: `${rsvpLink}?accion=no`,
    });

    if (templateKind === "INVITACION" && eventMapUrl) {
      html = insertInvitationMapBlock(html, {
        mapUrl: eventMapUrl,
        mapImageSrc: eventMapImageSrc,
        accentColor: event.colorPrincipal,
      });
    }

    const result = await sendEmail({
      userId: session.userId,
      to: guest.email,
      subject: `Invitación: ${event.nombreEvento}`,
      html,
    });

    await prisma.emailLog.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        templateId: templateDbId,
        kind: templateKind,
        status: result.ok ? "ENVIADO" : "FALLIDO",
        proveedorId: result.ok ? result.providerId : null,
        error: result.ok ? null : result.error,
      },
    });

    if (result.ok) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitacionEnviadaEn: new Date() },
      });
    }

    results.push({ guestId: guest.id, ok: result.ok, error: result.ok ? undefined : result.error });
  }

  const enviados = results.filter((r) => r.ok).length;
  const fallidos = results.length - enviados;

  if (enviados > 0 && event.estado !== "FINALIZADO") {
    await prisma.event.update({
      where: { id: event.id },
      data: { estado: "ACTIVO" },
    });
  }

  return NextResponse.json({ enviados, fallidos, results });
}

function insertInvitationMapBlock(
  html: string,
  options: { mapUrl: string; mapImageSrc: string; accentColor: string }
) {
  const mapUrl = escapeHtmlAttribute(options.mapUrl);
  const mapImageSrc = escapeHtmlAttribute(options.mapImageSrc);
  const accentColor = escapeHtmlAttribute(options.accentColor);
  const mapImage = mapImageSrc
    ? `<a href="${mapUrl}" target="_blank" style="display:block; margin:0 0 16px; text-decoration:none;">
          <img src="${mapImageSrc}" width="480" alt="Mapa de la ubicación del evento" style="display:block; width:100%; max-width:480px; height:auto; border:0; border-radius:12px;" />
        </a>`
    : "";

  const mapSection = `
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:18px; border:1px solid #e5e5e5; border-radius:14px; background-color:#fafafa;">
                      ${mapImage}
                      <p style="font-size:14px; line-height:1.5; color:#525252; margin:0 0 14px;">
                        Ubicación del evento
                      </p>
                      <a href="${mapUrl}" target="_blank" style="display:inline-block; background-color:${accentColor}; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; padding:12px 20px; border-radius:10px;">
                        Ver mapa
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;

  const fallbackBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr>
        <td align="center" style="padding:18px; border:1px solid #e5e5e5; border-radius:14px; background-color:#fafafa;">
          ${mapImage}
          <p style="font-size:14px; line-height:1.5; color:#525252; margin:0 0 14px;">
            Ubicación del evento
          </p>
          <a href="${mapUrl}" target="_blank" style="display:inline-block; background-color:${accentColor}; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; padding:12px 20px; border-radius:10px;">
            Ver mapa
          </a>
        </td>
      </tr>
    </table>`;

  if (html.includes("<!-- EVENT_FLOW_EMAIL_FOOTER -->")) {
    return html.replace("<!-- EVENT_FLOW_EMAIL_FOOTER -->", `${mapSection}<!-- EVENT_FLOW_EMAIL_FOOTER -->`);
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${fallbackBlock}</body>`);
  }

  return `${html}${fallbackBlock}`;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
