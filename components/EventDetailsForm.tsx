"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EventDetails = {
  nombreEvento: string;
  tipoEvento: string;
  fecha: string;
  horaInicio: string;
  horaFin: string | null;
  nombreLugar: string | null;
  direccion: string | null;
  mapaUrl: string | null;
  descripcion: string | null;
};

function dateInputValue(value: string) {
  return value.slice(0, 10);
}

export default function EventDetailsForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: EventDetails;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    nombreEvento: initial.nombreEvento,
    tipoEvento: initial.tipoEvento,
    fecha: dateInputValue(initial.fecha),
    horaInicio: initial.horaInicio,
    horaFin: initial.horaFin ?? "",
    nombreLugar: initial.nombreLugar ?? "",
    direccion: initial.direccion ?? "",
    mapaUrl: initial.mapaUrl ?? "",
    descripcion: initial.descripcion ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar el evento");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="card">
      <div className="mb-5">
        <h2 className="font-medium">Datos del evento</h2>
        <p className="text-sm text-neutral-500">
          Nombre, fecha, lugar y dirección que aparecen en la landing y en los emails.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Nombre del evento</label>
          <input
            required
            className="input"
            value={values.nombreEvento}
            onChange={(e) => update("nombreEvento", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Tipo de evento</label>
          <input
            required
            className="input"
            value={values.tipoEvento}
            onChange={(e) => update("tipoEvento", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Fecha</label>
          <input
            type="date"
            required
            className="input"
            value={values.fecha}
            onChange={(e) => update("fecha", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Inicio</label>
            <input
              type="time"
              required
              className="input"
              value={values.horaInicio}
              onChange={(e) => update("horaInicio", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Fin</label>
            <input
              type="time"
              className="input"
              value={values.horaFin}
              onChange={(e) => update("horaFin", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Lugar</label>
          <input
            className="input"
            value={values.nombreLugar}
            onChange={(e) => update("nombreLugar", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Dirección</label>
          <input
            className="input"
            value={values.direccion}
            onChange={(e) => update("direccion", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Link de mapa opcional</label>
          <input
            type="url"
            className="input"
            placeholder="https://maps.google.com/..."
            value={values.mapaUrl}
            onChange={(e) => update("mapaUrl", e.target.value)}
          />
          <p className="mt-1 text-xs text-neutral-400">
            Si lo dejás vacío, Event Flow genera el mapa con lugar y dirección.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descripción</label>
          <textarea
            className="input min-h-28"
            value={values.descripcion}
            onChange={(e) => update("descripcion", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-700">Evento guardado.</p>}

      <button type="submit" disabled={saving} className="btn-primary mt-5">
        {saving ? "Guardando..." : "Guardar datos del evento"}
      </button>
    </form>
  );
}
