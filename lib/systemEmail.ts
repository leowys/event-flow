import { resolveProviderConfig, sendWithProviderConfig } from "@/lib/email";

// Los emails transaccionales de la app usan la misma configuración que las
// invitaciones del organizador. En el registro inicial puede no existir aún
// una configuración guardada; en ese caso aplica el fallback a .env que ya
// maneja resolveProviderConfig.

export async function sendSystemEmail(params: {
  userId: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = await resolveProviderConfig(params.userId);

  if (!config) {
    return {
      ok: false,
      error:
        "No hay un proveedor de email configurado. Configurá Resend o Brevo en Ajustes de email.",
    };
  }

  return sendWithProviderConfig(config, params);
}
