import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { rateLimitResponse } from "@/lib/rateLimit";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/verificationEmail";

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24hs

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse(req, "auth:register", 5, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { nombre, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Mensaje genérico a propósito: no confirmar si un email ya existe
    // evita enumeración de cuentas.
    return NextResponse.json(
      { error: "No se pudo completar el registro con esos datos." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const emailVerificationToken = generateVerificationToken();
  const emailVerificationExpires = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  const user = await prisma.user.create({
    data: { nombre, email, passwordHash, emailVerificationToken, emailVerificationExpires },
  });

  // La cuenta se crea y se loguea igual aunque el email de verificación
  // falle. En el primer registro el usuario todavía puede no haber cargado
  // Ajustes de email, así que no queremos bloquear el alta en este MVP.
  await sendVerificationEmail(user.id, email, nombre, emailVerificationToken).catch(() => {});

  await createSession({ userId: user.id, email: user.email });

  return NextResponse.json({
    user: { id: user.id, nombre: user.nombre, email: user.email },
  });
}
