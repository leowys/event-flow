"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Estado = "BORRADOR" | "ACTIVO" | "FINALIZADO";

const estadoLabel: Record<Estado, string> = {
  BORRADOR: "Borrador",
  ACTIVO: "Publicado",
  FINALIZADO: "Finalizado",
};

const estadoBadgeStyle: Record<Estado, string> = {
  BORRADOR: "bg-neutral-100 text-neutral-600",
  ACTIVO: "bg-green-100 text-green-700",
  FINALIZADO: "bg-neutral-100 text-neutral-500",
};

const estadoDotStyle: Record<Estado, string> = {
  BORRADOR: "bg-neutral-400",
  ACTIVO: "bg-green-500",
  FINALIZADO: "bg-neutral-400",
};

const ORDER: Estado[] = ["BORRADOR", "ACTIVO", "FINALIZADO"];

export default function EventStatusControl({
  eventId,
  initialEstado,
}: {
  eventId: string;
  initialEstado: Estado;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(initialEstado);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeEstado(next: Estado) {
    if (next === estado) {
      setOpen(false);
      return;
    }
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: next }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo cambiar el estado");
      return;
    }

    setEstado(next);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${estadoBadgeStyle[estado]}`}
      >
        {saving ? "Guardando..." : estadoLabel[estado]}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
          {ORDER.map((e) => (
            <button
              key={e}
              onClick={() => changeEstado(e)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                e === estado ? "font-medium text-neutral-900" : "text-neutral-600"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${estadoDotStyle[e]}`} />
              {estadoLabel[e]}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
