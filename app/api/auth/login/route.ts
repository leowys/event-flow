import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse(req, "auth:login", 10, 15 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Mensaje idéntico tanto si el usuario no existe como si la contraseña
  // es incorrecta, para no filtrar qué emails están registrados.
  const genericError = { error: "Email o contraseña incorrectos" };

  if (!user) {
    return NextResponse.json(genericError, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(genericError, { status: 401 });
  }

  await createSession({ userId: user.id, email: user.email });

  return NextResponse.json({
    user: { id: user.id, nombre: user.nombre, email: user.email },
  });
}
