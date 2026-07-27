import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

export type SendEmailResult = { ok: true; providerId: string } | { ok: false; error: string };

export type ProviderConfig = {
  provider: "RESEND" | "BREVO";
  apiKey: string;
  fromEmail: string;
  fromName: string;
  testModeEnabled?: boolean;
  testRecipientEmail?: string | null;
};

// Resuelve qué proveedor/credenciales usar para un organizador:
// 1) si tiene EmailProviderSettings guardado en la app, se usa eso (desencriptando la key)
// 2) si no, cae a las variables de entorno (RESEND_API_KEY/EMAIL_FROM) como
//    quedó en la Etapa 4 original — mantiene compatibilidad con quien no
//    haya pasado por la pantalla de configuración todavía.
export async function resolveProviderConfig(userId: string): Promise<ProviderConfig | null> {
  const settings = await prisma.emailProviderSettings.findUnique({ where: { userId } });

  if (settings) {
    return {
      provider: settings.provider,
      apiKey: decryptSecret(settings.apiKeyEncrypted),
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      testModeEnabled: settings.testModeEnabled,
      testRecipientEmail: settings.testRecipientEmail,
    };
  }

  const envKey = process.env.RESEND_API_KEY;
  const envFrom = process.env.EMAIL_FROM; // formato "Nombre <email@dominio.com>"
  if (envKey && envFrom) {
    const match = envFrom.match(/^(.*)<(.+)>$/);
    return {
      provider: "RESEND",
      apiKey: envKey,
      fromName: match ? match[1].trim() : "Event Flow",
      fromEmail: match ? match[2].trim() : envFrom,
    };
  }

  return null;
}

export async function sendEmail(params: {
  userId: string;
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const config = await resolveProviderConfig(params.userId);
  if (!config) {
    return {
      ok: false,
      error:
        "No hay un proveedor de email configurado. Configurá Resend o Brevo en Ajustes → Email.",
    };
  }

  if (config.provider === "RESEND") {
    return sendWithProviderConfig(config, params);
  }
  return sendWithProviderConfig(config, params);
}

export async function sendWithProviderConfig(
  config: ProviderConfig,
  params: { to: string; subject: string; html: string }
): Promise<SendEmailResult> {
  const effectiveParams = applyTestMode(config, params);

  return config.provider === "RESEND"
    ? sendViaResend(config, effectiveParams)
    : sendViaBrevo(config, effectiveParams);
}

function applyTestMode(
  config: ProviderConfig,
  params: { to: string; subject: string; html: string }
) {
  if (!config.testModeEnabled || !config.testRecipientEmail) {
    return params;
  }

  const originalTo = escapeHtml(params.to);
  return {
    to: config.testRecipientEmail,
    subject: `[TEST para ${params.to}] ${params.subject}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; margin:0 0 16px; padding:12px 14px; border:1px solid #f59e0b; background:#fffbeb; color:#92400e; border-radius:8px;">
        <strong>Modo prueba Event Flow</strong><br />
        Este email iba dirigido originalmente a <code>${originalTo}</code>, pero fue redirigido a este destinatario de prueba.
      </div>
      ${params.html}
    `,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendViaResend(
  config: ProviderConfig,
  params: { to: string; subject: string; html: string }
): Promise<SendEmailResult> {
  try {
    const client = new Resend(config.apiKey);
    const { data, error } = await client.emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, providerId: data?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido (Resend)" };
  }
}

async function sendViaBrevo(
  config: ProviderConfig,
  params: { to: string; subject: string; html: string }
): Promise<SendEmailResult> {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: config.fromName, email: config.fromEmail },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.html,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data?.message ?? `Brevo devolvió el estado ${res.status}` };
    }

    return { ok: true, providerId: data?.messageId ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido (Brevo)" };
  }
}

// Envía un email de prueba con las credenciales dadas SIN guardarlas todavía,
// para validar la configuración desde la pantalla de Ajustes antes de confirmar.
export async function sendTestEmail(
  config: ProviderConfig,
  to: string
): Promise<SendEmailResult> {
  const params = {
    to,
    subject: "Event Flow — Prueba de configuración de email",
    html: "<p>Si estás viendo este email, tu configuración de envío quedó funcionando correctamente. 🎉</p>",
  };
  return sendWithProviderConfig(config, params);
}
