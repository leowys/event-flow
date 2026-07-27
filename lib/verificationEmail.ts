import { sendSystemEmail } from "@/lib/systemEmail";

export async function sendVerificationEmail(
  userId: string,
  email: string,
  nombre: string,
  token: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

  return sendSystemEmail({
    userId,
    to: email,
    subject: "Verificá tu cuenta de Event Flow",
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin-bottom: 8px;">Hola ${nombre},</h2>
        <p style="color:#525252; line-height:1.6;">
          Confirmá tu cuenta de Event Flow haciendo clic en el siguiente botón. El link vence en 24 horas.
        </p>
        <a href="${verifyUrl}" style="display:inline-block; background:#111827; color:#fff; text-decoration:none; padding:12px 22px; border-radius:10px; font-weight:600; margin-top:12px;">
          Verificar mi cuenta
        </a>
        <p style="color:#a3a3a3; font-size:12px; margin-top:20px;">
          Si no creaste esta cuenta, podés ignorar este email.
        </p>
      </div>
    `,
  });
}
