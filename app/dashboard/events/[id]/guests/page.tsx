"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Guest = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  cantidadPersonasPermitidas: number;
  cantidadConfirmada: number | null;
  estadoRsvp: "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";
  tokenUnico: string;
  invitacionEnviadaEn: string | null;
  fechaRespuesta: string | null;
  checkedInAt: string | null;
  checkedInByUserId: string | null;
  comentarios: string | null;
  createdAt: string;
  updatedAt: string;
};

type GuestForm = {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  cantidadPersonasPermitidas: string;
};

const emptyForm: GuestForm = {
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  cantidadPersonasPermitidas: "1",
};

const rsvpLabel: Record<Guest["estadoRsvp"], string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  RECHAZADO: "Rechazado",
};

const rsvpStyle: Record<Guest["estadoRsvp"], string> = {
  PENDIENTE: "bg-neutral-100 text-neutral-600",
  CONFIRMADO: "bg-green-100 text-green-700",
  RECHAZADO: "bg-red-100 text-red-600",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formFromGuest(guest: Guest): GuestForm {
  return {
    nombre: guest.nombre,
    apellido: guest.apellido,
    email: guest.email,
    telefono: guest.telefono ?? "",
    cantidadPersonasPermitidas: String(guest.cantidadPersonasPermitidas),
  };
}

export default function GuestsPage({ params }: { params: { id: string } }) {
  const eventId = params.id;
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GuestForm>(emptyForm);
  const [editGuestId, setEditGuestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GuestForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [undoingCheckinId, setUndoingCheckinId] = useState<string | null>(null);
  const [resendingQrId, setResendingQrId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    creados: number;
    duplicadosEnArchivo: number;
    duplicadosExistentes: number;
    filasInvalidas: number;
    detalleErrores: { row: number; reason: string }[];
  } | null>(null);

  async function loadGuests() {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/guests`);
    const data = await res.json();
    if (res.ok) setGuests(data.guests);
    setLoading(false);
  }

  useEffect(() => {
    loadGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleAddGuest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/events/${eventId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo agregar el invitado");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    loadGuests();
  }

  function startEditGuest(guest: Guest) {
    setEditError(null);
    setEditGuestId(guest.id);
    setEditForm(formFromGuest(guest));
    setShowForm(false);
  }

  async function handleEditGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!editGuestId) return;

    setEditError(null);
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/guests/${editGuestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setEditError(data.error ?? "No se pudo actualizar el invitado");
      return;
    }

    setEditGuestId(null);
    setEditForm(emptyForm);
    loadGuests();
  }

  async function handleDeleteGuest(guest: Guest) {
    const ok = window.confirm(`¿Eliminar a ${guest.nombre} ${guest.apellido}?`);
    if (!ok) return;

    setDeletingId(guest.id);
    const res = await fetch(`/api/events/${eventId}/guests/${guest.id}`, { method: "DELETE" });
    setDeletingId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "No se pudo eliminar el invitado");
      return;
    }

    if (editGuestId === guest.id) setEditGuestId(null);
    loadGuests();
  }

  async function undoCheckin(guest: Guest) {
    const ok = window.confirm(`¿Deshacer el ingreso de ${guest.nombre} ${guest.apellido}?`);
    if (!ok) return;

    setUndoingCheckinId(guest.id);
    const res = await fetch(`/api/events/${eventId}/guests/${guest.id}/checkin`, {
      method: "DELETE",
    });
    setUndoingCheckinId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "No se pudo deshacer el check-in");
      return;
    }

    loadGuests();
  }

  async function resendQr(guest: Guest) {
    setActionMessage(null);
    setResendingQrId(guest.id);
    const res = await fetch(`/api/events/${eventId}/guests/${guest.id}/resend-qr`, {
      method: "POST",
    });
    setResendingQrId(null);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error ?? "No se pudo reenviar el QR");
      return;
    }

    setActionMessage(`QR reenviado a ${guest.email}`);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);

    if (!importFile) {
      setImportError("Elegí un archivo .csv");
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append("file", importFile);

    const res = await fetch(`/api/events/${eventId}/guests/import`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setImporting(false);

    if (!res.ok) {
      setImportError(data.error ?? "No se pudo importar el archivo");
      return;
    }

    setImportResult(data);
    setImportFile(null);
    loadGuests();
  }

  function downloadTemplate() {
    const csv = "Nombre,Apellido,Email,Telefono\nJuan,Pérez,juan.perez@ejemplo.com,+54 9 11 1234-5678\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-invitados.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadGuestsCsv() {
    window.location.href = `/api/events/${eventId}/guests/export`;
  }

  function qrUrl(guestId: string) {
    return `/api/events/${eventId}/guests/${guestId}/qr`;
  }

  function renderGuestForm(
    values: GuestForm,
    setValues: React.Dispatch<React.SetStateAction<GuestForm>>
  ) {
    return (
      <>
        <div>
          <label className="label">Nombre</label>
          <input
            required
            className="input"
            value={values.nombre}
            onChange={(e) => setValues((f) => ({ ...f, nombre: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Apellido</label>
          <input
            required
            className="input"
            value={values.apellido}
            onChange={(e) => setValues((f) => ({ ...f, apellido: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            className="input"
            value={values.email}
            onChange={(e) => setValues((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input
            className="input"
            value={values.telefono}
            onChange={(e) => setValues((f) => ({ ...f, telefono: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Cantidad permitida</label>
          <input
            type="number"
            min={1}
            max={20}
            className="input"
            value={values.cantidadPersonasPermitidas}
            onChange={(e) =>
              setValues((f) => ({ ...f, cantidadPersonasPermitidas: e.target.value }))
            }
          />
        </div>
      </>
    );
  }

  const filtered = guests.filter((g) => {
    const q = search.toLowerCase();
    return (
      g.nombre.toLowerCase().includes(q) ||
      g.apellido.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <Link
        href={`/dashboard/events/${eventId}`}
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Volver al evento
      </Link>

      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Invitados</h1>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button className="btn-secondary min-h-11" onClick={downloadGuestsCsv}>
            Exportar CSV
          </button>
          <Link className="btn-secondary min-h-11" href={`/dashboard/events/${eventId}/checkin`}>
            Check-in
          </Link>
          <button className="btn-secondary min-h-11" onClick={() => setShowImport((v) => !v)}>
            {showImport ? "Cancelar" : "Importar CSV"}
          </button>
          <button
            className="btn-primary min-h-11"
            onClick={() => {
              setShowForm((v) => !v);
              setEditGuestId(null);
            }}
          >
            {showForm ? "Cancelar" : "+ Agregar invitado"}
          </button>
        </div>
      </div>

      {showImport && (
        <form onSubmit={handleImport} className="card mb-6 space-y-4">
          <div>
            <p className="text-sm text-neutral-500">
              El CSV necesita columnas <strong>Nombre</strong>, <strong>Apellido</strong> y{" "}
              <strong>Email</strong> (Teléfono es opcional). El orden de las columnas no importa.
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="mt-2 text-xs font-medium text-neutral-500 underline"
            >
              Descargar plantilla de ejemplo
            </button>
          </div>

          <div>
            <label className="label">Archivo .csv</label>
            <input
              type="file"
              accept=".csv"
              className="input"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {importError && <p className="text-sm text-red-600">{importError}</p>}

          {importResult && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <p className="font-medium text-green-700">
                {importResult.creados} invitado{importResult.creados !== 1 && "s"} importado
                {importResult.creados !== 1 && "s"}.
              </p>
              {(importResult.duplicadosEnArchivo > 0 ||
                importResult.duplicadosExistentes > 0 ||
                importResult.filasInvalidas > 0) && (
                <ul className="mt-2 space-y-0.5 text-neutral-500">
                  {importResult.duplicadosEnArchivo > 0 && (
                    <li>
                      {importResult.duplicadosEnArchivo} filas repetidas dentro del mismo archivo
                      (se ignoraron).
                    </li>
                  )}
                  {importResult.duplicadosExistentes > 0 && (
                    <li>{importResult.duplicadosExistentes} ya existían en este evento.</li>
                  )}
                  {importResult.filasInvalidas > 0 && (
                    <li>{importResult.filasInvalidas} filas con datos inválidos o incompletos.</li>
                  )}
                </ul>
              )}
              {importResult.detalleErrores.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-neutral-400">Ver detalle</summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-neutral-400">
                    {importResult.detalleErrores.map((e, i) => (
                      <li key={i}>
                        {e.row > 0 ? `Fila ${e.row}: ` : ""}
                        {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <button type="submit" disabled={importing} className="btn-primary w-full">
            {importing ? "Importando..." : "Importar"}
          </button>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleAddGuest} className="card mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {renderGuestForm(form, setForm)}
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando..." : "Guardar invitado"}
            </button>
          </div>
        </form>
      )}

      {editGuestId && (
        <form onSubmit={handleEditGuest} className="card mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="font-medium">Editar invitado</p>
          </div>
          {renderGuestForm(editForm, setEditForm)}
          {editError && <p className="sm:col-span-2 text-sm text-red-600">{editError}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditGuestId(null);
                setEditForm(emptyForm);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <input
        placeholder="Buscar por nombre, apellido o email..."
        className="input mb-4 min-h-12 max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {actionMessage && (
        <p className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {actionMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-sm text-neutral-500">
          No hay invitados que coincidan.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((g) => (
              <article key={g.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium text-neutral-900">
                      {g.nombre} {g.apellido}
                    </h2>
                    <p className="truncate text-xs text-neutral-400">{g.email}</p>
                    {g.telefono && <p className="mt-0.5 text-xs text-neutral-400">{g.telefono}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${rsvpStyle[g.estadoRsvp]}`}>
                    {rsvpLabel[g.estadoRsvp]}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-neutral-50 px-3 py-2">
                    <p className="text-xs text-neutral-400">Personas</p>
                    <p className="font-medium text-neutral-700">
                      {g.cantidadConfirmada ?? g.cantidadPersonasPermitidas}
                    </p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 px-3 py-2">
                    <p className="text-xs text-neutral-400">Ingreso</p>
                    <p className="font-medium text-neutral-700">
                      {g.checkedInAt ? "Ingresó" : "Pendiente"}
                    </p>
                  </div>
                </div>

                <details className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  <summary className="cursor-pointer text-xs font-medium text-neutral-500">
                    Ver fechas
                  </summary>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">Carga</dt>
                      <dd className="text-right">{formatDate(g.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">Confirmación</dt>
                      <dd className="text-right">
                        {g.estadoRsvp === "CONFIRMADO" ? formatDate(g.fechaRespuesta) : "-"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">Rechazo</dt>
                      <dd className="text-right">
                        {g.estadoRsvp === "RECHAZADO" ? formatDate(g.fechaRespuesta) : "-"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">Ingreso</dt>
                      <dd className="text-right">{formatDate(g.checkedInAt)}</dd>
                    </div>
                  </dl>
                </details>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-secondary min-h-11" onClick={() => startEditGuest(g)}>
                    Editar contacto
                  </button>
                  {g.estadoRsvp === "CONFIRMADO" && (
                    <>
                    <a
                      className="btn-secondary min-h-11"
                      href={qrUrl(g.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver QR
                    </a>
                    <button
                      className="btn-secondary min-h-11"
                      disabled={resendingQrId === g.id}
                      onClick={() => resendQr(g)}
                    >
                      {resendingQrId === g.id ? "Reenviando..." : "Reenviar QR"}
                    </button>
                    </>
                  )}
                  {g.checkedInAt && (
                    <button
                      className="btn-secondary min-h-11"
                      disabled={undoingCheckinId === g.id}
                      onClick={() => undoCheckin(g)}
                    >
                      {undoingCheckinId === g.id ? "Revirtiendo..." : "Deshacer ingreso"}
                    </button>
                  )}
                  <button
                    className="btn-danger min-h-11"
                    disabled={deletingId === g.id}
                    onClick={() => handleDeleteGuest(g)}
                  >
                    {deletingId === g.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="w-[23%] px-4 py-3 font-medium">Contacto</th>
                  <th className="w-[12%] px-4 py-3 font-medium">RSVP</th>
                  <th className="w-[13%] px-4 py-3 font-medium">Ingreso</th>
                  <th className="w-[25%] px-4 py-3 font-medium">Fechas</th>
                  <th className="w-[8%] px-4 py-3 text-center font-medium">Personas</th>
                  <th className="w-[19%] px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b border-neutral-100 align-top last:border-0 hover:bg-neutral-50/70">
                    <td className="px-4 py-4">
                      <p className="font-medium leading-snug text-neutral-950">
                        {g.nombre} {g.apellido}
                      </p>
                      <p className="mt-1 truncate text-sm text-neutral-500">{g.email}</p>
                      {g.telefono && <p className="mt-0.5 text-xs text-neutral-400">{g.telefono}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${rsvpStyle[g.estadoRsvp]}`}
                      >
                        {rsvpLabel[g.estadoRsvp]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {g.checkedInAt ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          Ingresó
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      <dl className="space-y-1.5">
                        <div className="grid grid-cols-[82px_1fr] gap-2">
                          <dt className="text-neutral-400">Carga</dt>
                          <dd>{formatDate(g.createdAt)}</dd>
                        </div>
                        <div className="grid grid-cols-[82px_1fr] gap-2">
                          <dt className="text-neutral-400">Respuesta</dt>
                          <dd>
                            {g.estadoRsvp === "PENDIENTE" ? "-" : formatDate(g.fechaRespuesta)}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[82px_1fr] gap-2">
                          <dt className="text-neutral-400">Ingreso</dt>
                          <dd>{formatDate(g.checkedInAt)}</dd>
                        </div>
                      </dl>
                    </td>
                    <td className="px-4 py-3 text-center text-neutral-600">
                      {g.cantidadConfirmada ?? g.cantidadPersonasPermitidas}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <button
                          className="rounded-md px-2 py-1 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                          onClick={() => startEditGuest(g)}
                        >
                          Editar contacto
                        </button>
                        {g.estadoRsvp === "CONFIRMADO" && (
                          <>
                          <a
                            className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            href={qrUrl(g.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver QR
                          </a>
                          <button
                            className="rounded-md px-2 py-1 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                            disabled={resendingQrId === g.id}
                            onClick={() => resendQr(g)}
                          >
                            {resendingQrId === g.id ? "Enviando..." : "Reenviar QR"}
                          </button>
                          </>
                        )}
                        {g.checkedInAt && (
                          <button
                            className="rounded-md px-2 py-1 text-left text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
                            disabled={undoingCheckinId === g.id}
                            onClick={() => undoCheckin(g)}
                          >
                            {undoingCheckinId === g.id ? "Revirtiendo..." : "Deshacer ingreso"}
                          </button>
                        )}
                        <button
                          className="rounded-md px-2 py-1 text-left text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          disabled={deletingId === g.id}
                          onClick={() => handleDeleteGuest(g)}
                        >
                          {deletingId === g.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
