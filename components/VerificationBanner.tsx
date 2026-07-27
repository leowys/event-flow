"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function VerificationBanner() {
  return (
    <Suspense fallback={null}>
      <VerificationBannerInner />
    </Suspense>
  );
}

function VerificationBannerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const verificacion = searchParams.get("verificacion");

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    verificacion === "expirado" ? "Ese link de verificación venció. Pedí uno nuevo abajo." : null
  );
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setSending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo reenviar el email.");
      return;
    }

    setMessage("Te mandamos un nuevo link. Revisá tu bandeja de entrada (y spam).");
  }

  // Si justo se verificó (viene de hacer clic en el link), refrescamos para
  // que el layout vuelva a leer emailVerified=true del lado del servidor y
  // deje de renderizar este banner.
  if (verificacion === "ok") {
    router.refresh();
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 text-sm text-amber-800">
        <p>
          {message ?? error ?? "Todavía no verificaste tu email. Revisá tu bandeja de entrada."}
        </p>
        <button
          onClick={handleResend}
          disabled={sending}
          className="font-medium underline underline-offset-2 disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Reenviar email"}
        </button>
      </div>
    </div>
  );
}
