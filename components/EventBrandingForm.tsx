"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EventBrandingForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: { logo: string | null; colorPrincipal: string; colorSecundario: string };
}) {
  const router = useRouter();
  const [logo, setLogo] = useState(initial.logo ?? "");
  const [colorPrincipal, setColorPrincipal] = useState(initial.colorPrincipal);
  const [colorSecundario, setColorSecundario] = useState(initial.colorSecundario);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo, colorPrincipal, colorSecundario }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-medium">Identidad visual</h2>
          <p className="text-sm text-neutral-500">
            Se usa en la landing pública y en la plantilla básica de email.
          </p>
        </div>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo" className="h-12 w-12 rounded-full border border-neutral-200 object-cover" />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="label">Logo (URL de la imagen)</label>
          <input
            type="url"
            placeholder="https://..."
            className="input"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Color principal</label>
          <input
            type="color"
            className="h-10 w-full rounded-xl border border-neutral-200"
            value={colorPrincipal}
            onChange={(e) => setColorPrincipal(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Color secundario</label>
          <input
            type="color"
            className="h-10 w-full rounded-xl border border-neutral-200"
            value={colorSecundario}
            onChange={(e) => setColorSecundario(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-700">Guardado.</p>}

      <button type="submit" disabled={saving} className="btn-primary mt-4">
        {saving ? "Guardando..." : "Guardar identidad visual"}
      </button>
    </form>
  );
}
