import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/verificationEmail";

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Por usuario Y por IP, para que no se pueda usar para floodear la bandeja
  // de entrada de otra persona ni para saturar el proveedor de email.
  const limitedByUser = rateLimitResponse(req, `verify-resend:user:${session.userId}`, 3, 15 * 60 * 1000);
  if (limitedByUser) return limitedByUser;
  const limitedByIp = rateLimitResponse(req, "verify-resend:ip", 10, 15 * 60 * 1000);
  if (limitedByIp) return limitedByIp;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const emailVerificationToken = generateVerificationToken();
  const emailVerificationExpires = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken, emailVerificationExpires },
  });

  const result = await sendVerificationEmail(
    user.id,
    user.email,
    user.nombre,
    emailVerificationToken
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "No se pudo enviar el email de verificación." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
