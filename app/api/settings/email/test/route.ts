import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { testEmailSchema } from "@/lib/validation";
import { sendTestEmail } from "@/lib/email";
import { rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const limited = rateLimitResponse(req, `email-test:${session.userId}`, 5, 10 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = testEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { provider, apiKey, fromEmail, fromName, to } = parsed.data;

  const result = await sendTestEmail({ provider, apiKey, fromEmail, fromName }, to);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
