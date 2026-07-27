"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Template = {
  id: string;
  nombre: string;
  kind: "INVITACION" | "CONFIRMACION" | "RECORDATORIO";
  createdAt: string | null;
  isDefault?: boolean;
};

type Guest = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  invitacionEnviadaEn?: string | null;
  estadoRsvp: "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";
};

const kindLabel: Record<Template["kind"], string> = {
  INVITACION: "Invitación",
  CONFIRMACION: "Confirmación",
  RECORDATORIO: "Recordatorio",
};

export default function EmailsPage({ params }: { params: { id: string } }) {
  const eventId = params.id;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ nombre: "", kind: "INVITACION" as Template["kind"] });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ enviados: number; fallidos: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ enviados: number; fallidos: number } | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [templatesRes, guestsRes] = await Promise.all([
      fetch(`/api/events/${eventId}/templates`),
      fetch(`/api/events/${eventId}/guests`),
    ]);
    const templatesData = await templatesRes.json();
    const guestsData = await guestsRes.json();
    if (templatesRes.ok) setTemplates(templatesData.templates);
    if (guestsRes.ok) setGuests(guestsData.guests);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    fetch("/api/settings/email")
      .then((res) => res.json())
      .then((data) => setProviderConfigured(!!data.configured))
      .catch(() => setProviderConfigured(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    if (!file) {
      setUploadError("Elegí el archivo .zip exportado desde Postcards");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("nombre", uploadForm.nombre);
    formData.append("kind", uploadForm.kind);

    const res = await fetch(`/api/events/${eventId}/templates`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setUploadError(data.error ?? "No se pudo subir la plantilla");
      return;
    }

    setUploadForm({ nombre: "", kind: "INVITACION" });
    setFile(null);
    setShowUpload(false);
    loadData();
  }

  function toggleGuest(id: string) {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllGuests() {
    if (selectedGuestIds.size === guests.length) {
      setSelectedGuestIds(new Set());
    } else {
      setSelectedGuestIds(new Set(guests.map((g) => g.id)));
    }
  }

  async function handleSend() {
    setSendError(null);
    setSendResult(null);

    if (!selectedTemplateId) {
      setSendError("Elegí una plantilla");
      return;
    }
    if (selectedGuestIds.size === 0) {
      setSendError("Seleccioná al menos un invitado");
      return;
    }

    setSending(true);
    const res = await fetch(`/api/events/${eventId}/send-invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: selectedTemplateId,
        guestIds: Array.from(selectedGuestIds),
      }),
    });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setSendError(data.error ?? "No se pudo enviar");
      return;
    }

    setSendResult({ enviados: data.enviados, fallidos: data.fallidos });
    loadData();
  }

  async function handleSendReminders() {
    setReminderError(null);
    setReminderResult(null);
    setReminding(true);

    const res = await fetch(`/api/events/${eventId}/send-reminders`, {
      method: "POST",
    });
    const data = await res.json();
    setReminding(false);

    if (!res.ok) {
      setReminderError(data.error ?? "No se pudieron enviar los recordatorios");
      return;
    }

    setReminderResult({ enviados: data.enviados, fallidos: data.fallidos });
    loadData();
  }

  const invitacionTemplates = templates.filter((t) => t.kind === "INVITACION");
  const pendingGuests = guests.filter((g) => g.estadoRsvp === "PENDIENTE");

  return (
    <div>
      <Link
        href={`/dashboard/events/${eventId}`}
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Volver al evento
      </Link>

      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Invitaciones</h1>
          <p className="page-subtitle">Plantillas, envíos y recordatorios del evento.</p>
        </div>
        <button className="btn-primary min-h-11 sm:min-h-0" onClick={() => setShowUpload((v) => !v)}>
          {showUpload ? "Cancelar" : "+ Subir plantilla"}
        </button>
      </div>

      {providerConfigured === false && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Todavía no configuraste un proveedor de email.{" "}
          <Link href="/dashboard/settings/email" className="font-medium underline">
            Configurar Resend o Brevo
          </Link>
          .
        </div>
      )}

      {showUpload && (
        <form onSubmit={handleUpload} className="card mb-8 space-y-4">
          <p className="text-sm text-neutral-500">
            Subí el archivo .zip exportado desde Postcards. Se extrae el HTML, se
            sanitiza y las imágenes se embeben automáticamente.
          </p>
          <div>
            <label className="label">Nombre de la plantilla</label>
            <input
              required
              className="input"
              placeholder="Invitación principal"
              value={uploadForm.nombre}
              onChange={(e) => setUploadForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={uploadForm.kind}
              onChange={(e) =>
                setUploadForm((f) => ({ ...f, kind: e.target.value as Template["kind"] }))
              }
            >
              <option value="INVITACION">Invitación</option>
              <option value="CONFIRMACION">Confirmación</option>
              <option value="RECORDATORIO">Recordatorio</option>
            </select>
          </div>
          <div>
            <label className="label">Archivo .zip</label>
            <input
              type="file"
              accept=".zip"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

          <button type="submit" disabled={uploading} className="btn-primary min-h-11 w-full">
            {uploading ? "Procesando..." : "Subir plantilla"}
          </button>
        </form>
      )}

      <h2 className="mb-3 text-sm font-medium text-neutral-500">Plantillas</h2>
      {loading ? (
        <p className="mb-8 text-sm text-neutral-500">Cargando...</p>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card">
              <p className="font-medium">{t.nombre}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs ${
                  t.isDefault ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {t.isDefault ? "Básica (automática)" : kindLabel[t.kind]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 font-medium">Enviar invitaciones</h2>

        <div className="mb-4">
          <label className="label">Plantilla</label>
          <select
            className="input"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            <option value="">Elegir plantilla de invitación...</option>
            {invitacionTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          {invitacionTemplates.length === 0 && (
            <p className="mt-1 text-xs text-neutral-400">
              Subí una plantilla de tipo "Invitación" para poder enviar.
            </p>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Invitados ({selectedGuestIds.size} seleccionados)</label>
            <button type="button" className="text-xs text-neutral-500 underline" onClick={toggleAllGuests}>
              {selectedGuestIds.size === guests.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-200">
            {guests.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">No hay invitados cargados todavía.</p>
            ) : (
              guests.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-0 hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedGuestIds.has(g.id)}
                    onChange={() => toggleGuest(g.id)}
                  />
                  <span className="flex-1">
                    {g.nombre} {g.apellido} · <span className="text-neutral-400">{g.email}</span>
                  </span>
                  {g.invitacionEnviadaEn && (
                    <span className="text-xs text-green-600">Ya enviada</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>

        {sendError && <p className="mb-3 text-sm text-red-600">{sendError}</p>}
        {sendResult && (
          <p className="mb-3 text-sm text-green-700">
            Enviados: {sendResult.enviados}
            {sendResult.fallidos > 0 && ` · Fallidos: ${sendResult.fallidos}`}
          </p>
        )}

        <button className="btn-primary min-h-11 w-full" disabled={sending} onClick={handleSend}>
          {sending ? "Enviando..." : "Enviar invitaciones"}
        </button>
      </div>

      <div className="card mt-6">
        <h2 className="mb-2 font-medium">Enviar recordatorio</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Se enviará a los invitados que todavía figuran como pendientes. Si cargaste una plantilla de
          recordatorio se usa esa; si no, se usa la básica automática.
        </p>

        {reminderError && <p className="mb-3 text-sm text-red-600">{reminderError}</p>}
        {reminderResult && (
          <p className="mb-3 text-sm text-green-700">
            Recordatorios enviados: {reminderResult.enviados}
            {reminderResult.fallidos > 0 && ` · Fallidos: ${reminderResult.fallidos}`}
          </p>
        )}

        <button
          className="btn-secondary min-h-11 w-full"
          disabled={reminding || pendingGuests.length === 0}
          onClick={handleSendReminders}
        >
          {reminding
            ? "Enviando recordatorios..."
            : `Enviar recordatorios a pendientes (${pendingGuests.length})`}
        </button>
      </div>
    </div>
  );
}
