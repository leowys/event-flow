"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombreEvento: "",
    tipoEvento: "",
    fecha: "",
    horaInicio: "",
    horaFin: "",
    nombreLugar: "",
    direccion: "",
    descripcion: "",
    logo: "",
    colorPrincipal: "#111827",
    colorSecundario: "#6366F1",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el evento");
      return;
    }

    router.push(`/dashboard/events/${data.event.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="page-title mb-1">Nuevo evento</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Completá la información general. Podés editar todo después.
      </p>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Nombre del evento</label>
          <input
            required
            className="input"
            value={form.nombreEvento}
            onChange={(e) => update("nombreEvento", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Tipo de evento</label>
          <input
            required
            placeholder="Casamiento, cumpleaños, corporativo..."
            className="input"
            value={form.tipoEvento}
            onChange={(e) => update("tipoEvento", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Fecha</label>
            <input
              type="date"
              required
              className="input"
              value={form.fecha}
              onChange={(e) => update("fecha", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Hora</label>
            <input
              type="time"
              required
              className="input"
              value={form.horaInicio}
              onChange={(e) => update("horaInicio", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Lugar</label>
          <input
            className="input"
            value={form.nombreLugar}
            onChange={(e) => update("nombreLugar", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Dirección</label>
          <input
            className="input"
            value={form.direccion}
            onChange={(e) => update("direccion", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Descripción</label>
          <textarea
            className="input min-h-24"
            value={form.descripcion}
            onChange={(e) => update("descripcion", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Logo (URL de la imagen)</label>
          <input
            type="url"
            placeholder="https://..."
            className="input"
            value={form.logo}
            onChange={(e) => update("logo", e.target.value)}
          />
          <p className="mt-1 text-xs text-neutral-400">
            Opcional. Se usa en la landing pública y en la plantilla básica de email. Tiene que
            ser un link directo a la imagen (subila antes a un servicio como Imgur o similar).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Color principal</label>
            <input
              type="color"
              className="h-10 w-full rounded-xl border border-neutral-200"
              value={form.colorPrincipal}
              onChange={(e) => update("colorPrincipal", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Color secundario</label>
            <input
              type="color"
              className="h-10 w-full rounded-xl border border-neutral-200"
              value={form.colorSecundario}
              onChange={(e) => update("colorSecundario", e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creando..." : "Crear evento"}
        </button>
      </form>
    </div>
  );
}
