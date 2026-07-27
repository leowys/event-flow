import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  // Rate limit generoso: esto se accede haciendo clic en un link de email,
  // no es un endpoint que se llame programáticamente en un loop legítimo.
  const limited = rateLimitResponse(req, "auth:verify-email", 20, 15 * 60 * 1000);
  if (limited) return limited;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${appUrl}/dashboard?verificacion=error`);
  }

  const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });

  if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    return NextResponse.redirect(`${appUrl}/dashboard?verificacion=expirado`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return NextResponse.redirect(`${appUrl}/dashboard?verificacion=ok`);
}
