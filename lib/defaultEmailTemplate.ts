// Plantilla básica generada automáticamente a partir de los datos del
// evento (logo, colores), para poder mandar invitaciones sin pasar por
// Postcards. Usa los mismos merge-tags que las plantillas subidas por ZIP,
// así que pasa por el mismo renderTemplate() antes de enviarse.
//
// HTML pensado para clientes de email (tablas, estilos inline, sin CSS
// externo ni flexbox/grid) — nada de esto se sanitiza porque no viene de
// un ZIP subido por el usuario, se genera acá mismo.

export type DefaultTemplateKind = "INVITACION" | "CONFIRMACION" | "RECORDATORIO" | "RECHAZO";

export type DefaultTemplateEventData = {
  nombreEvento: string;
  colorPrincipal: string;
  colorSecundario: string;
  logo: string | null;
};

function baseLayout(params: {
  event: DefaultTemplateEventData;
  preheader: string;
  bodyHtml: string;
}): string {
  const { event, preheader, bodyHtml } = params;

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${event.nombreEvento}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <span style="display:none; font-size:1px; color:#f5f5f5; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${preheader}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:16px; overflow:hidden;">
            <tr>
              <td align="center" style="background:linear-gradient(135deg, ${event.colorPrincipal}, ${event.colorSecundario}); padding:40px 24px;">
                ${
                  event.logo
                    ? `<img src="${event.logo}" alt="Logo" width="64" height="64" style="border-radius:50%; object-fit:cover; margin-bottom:16px;" />`
                    : ""
                }
                <div style="color:#ffffff; font-size:22px; font-weight:600; letter-spacing:-0.3px;">
                  ${event.nombreEvento}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                ${bodyHtml}
              </td>
            </tr>
            <!-- EVENT_FLOW_EMAIL_FOOTER -->
            <tr>
              <td style="padding:0 28px 28px; text-align:center;">
                <p style="font-size:12px; color:#a3a3a3; margin:0;">Enviado con Event Flow</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, href: string, color: string): string {
  return `<a href="${href}" style="display:inline-block; background-color:${color}; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px; padding:12px 22px; border-radius:10px;">${label}</a>`;
}

function eventDetailsBlock(): string {
  // Los valores concretos los resuelve renderTemplate() vía merge-tags.
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0; font-size:14px; color:#525252;">
      <tr><td style="padding:4px 0;">📅 &nbsp;{{event_date}} · {{event_time}}hs</td></tr>
      <tr><td style="padding:4px 0;">📍 &nbsp;{{event_location}}</td></tr>
    </table>`;
}

export function buildDefaultTemplate(
  event: DefaultTemplateEventData,
  kind: DefaultTemplateKind
): string {
  if (kind === "INVITACION") {
    const bodyHtml = `
      <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">Hola {{guest_name}},</p>
      <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">
        Te invitamos a <strong>{{event_name}}</strong>. Nos encantaría contar con tu presencia.
      </p>
      ${eventDetailsBlock()}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr>
          <td style="padding-right:10px;">
            ${button("Confirmar asistencia", "{{rsvp_confirm_link}}", event.colorPrincipal)}
          </td>
          <td>
            ${button("No podré asistir", "{{rsvp_decline_link}}", "#737373")}
          </td>
        </tr>
      </table>
      <p style="font-size:12px; color:#a3a3a3; margin-top:20px;">
        Si los botones no funcionan, copiá y pegá este link en tu navegador:<br />
        <a href="{{rsvp_link}}" style="color:${event.colorPrincipal};">{{rsvp_link}}</a>
      </p>`;
    return baseLayout({ event, preheader: `Estás invitado a ${event.nombreEvento}`, bodyHtml });
  }

  if (kind === "CONFIRMACION") {
    const bodyHtml = `
      <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">Hola {{guest_name}},</p>
      <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">
        ¡Gracias por confirmar tu asistencia a <strong>{{event_name}}</strong>! Ya te tenemos anotado.
      </p>
      ${eventDetailsBlock()}
      <p style="font-size:13px; color:#a3a3a3; margin-top:20px;">
        Si necesitás cambiar tu respuesta, contactá al organizador del evento.
      </p>`;
    return baseLayout({ event, preheader: `Confirmación de ${event.nombreEvento}`, bodyHtml });
  }

  if (kind === "RECHAZO") {
    const bodyHtml = `
      <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">Hola {{guest_name}},</p>
      <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">
        Gracias por avisarnos que no vas a poder asistir a <strong>{{event_name}}</strong>. Ya registramos tu respuesta.
      </p>
      ${eventDetailsBlock()}
      <p style="font-size:13px; color:#a3a3a3; margin-top:20px;">
        Si necesitás cambiar tu respuesta, contactá al organizador del evento.
      </p>`;
    return baseLayout({ event, preheader: `Respuesta registrada para ${event.nombreEvento}`, bodyHtml });
  }

  // RECORDATORIO
  const bodyHtml = `
    <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">Hola {{guest_name}},</p>
    <p style="font-size:15px; color:#171717; line-height:1.6; margin:0 0 4px;">
      Te recordamos que se acerca <strong>{{event_name}}</strong>. ¡Te esperamos!
    </p>
    ${eventDetailsBlock()}
    <div style="margin-top:24px;">
      ${button("Ver mi invitación", "{{rsvp_link}}", event.colorPrincipal)}
    </div>`;
  return baseLayout({ event, preheader: `Recordatorio: ${event.nombreEvento}`, bodyHtml });
}
