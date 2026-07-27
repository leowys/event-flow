import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { emailProviderSettingsSchema } from "@/lib/validation";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const settings = await prisma.emailProviderSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings) {
    return NextResponse.json({ configured: false });
  }

  // Nunca se devuelve la API key completa al cliente, solo una versión
  // enmascarada para que el organizador pueda confirmar cuál cargó.
  return NextResponse.json({
    configured: true,
    provider: settings.provider,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    testModeEnabled: settings.testModeEnabled,
    testRecipientEmail: settings.testRecipientEmail,
    apiKeyMasked: maskSecret(decryptSecret(settings.apiKeyEncrypted)),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = emailProviderSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { provider, apiKey, fromEmail, fromName, testModeEnabled, testRecipientEmail } = parsed.data;

  if (testModeEnabled && !testRecipientEmail) {
    return NextResponse.json(
      { error: "Ingresá el email al que querés redirigir los envíos de prueba." },
      { status: 400 }
    );
  }

  const existing = await prisma.emailProviderSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!apiKey && !existing) {
    return NextResponse.json(
      { error: "Ingresá la API key (todavía no hay ninguna guardada)." },
      { status: 400 }
    );
  }

  const apiKeyEncrypted = apiKey ? encryptSecret(apiKey) : existing!.apiKeyEncrypted;

  const settings = await prisma.emailProviderSettings.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      provider,
      apiKeyEncrypted,
      fromEmail,
      fromName,
      testModeEnabled,
      testRecipientEmail: testModeEnabled ? testRecipientEmail : null,
    },
    update: {
      provider,
      apiKeyEncrypted,
      fromEmail,
      fromName,
      testModeEnabled,
      testRecipientEmail: testModeEnabled ? testRecipientEmail : null,
    },
  });

  return NextResponse.json({
    configured: true,
    provider: settings.provider,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    testModeEnabled: settings.testModeEnabled,
    testRecipientEmail: settings.testRecipientEmail,
    apiKeyMasked: maskSecret(apiKey || decryptSecret(settings.apiKeyEncrypted)),
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  await prisma.emailProviderSettings.deleteMany({ where: { userId: session.userId } });

  return NextResponse.json({ ok: true });
}
