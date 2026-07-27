"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Html5Qrcode } from "html5-qrcode";

type CheckinGuest = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  cantidadPersonasPermitidas: number;
  cantidadConfirmada: number | null;
  estadoRsvp: "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";
  checkedInAt: string | null;
};

type CheckinResult = {
  status: "checked_in" | "already_checked_in";
  message: string;
  guest: CheckinGuest;
};

const rsvpLabel: Record<CheckinGuest["estadoRsvp"], string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  RECHAZADO: "Rechazado",
};

const rsvpStyle: Record<CheckinGuest["estadoRsvp"], string> = {
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

export default function CheckinPage({ params }: { params: { id: string } }) {
  const eventId = params.id;
  const scannerId = `qr-reader-${eventId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef("");

  const [guests, setGuests] = useState<CheckinGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadGuests() {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/checkin`);
    const data = await res.json();
    if (res.ok) setGuests(data.guests);
    setLoading(false);
  }

  useEffect(() => {
    loadGuests();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function submitCode(code: string) {
    const normalizedCode = code.trim();
    if (!normalizedCode || checking) return;

    setChecking(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/events/${eventId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalizedCode }),
    });
    const data = await res.json();
    setChecking(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo registrar el ingreso");
      return;
    }

    setResult(data);
    setManualCode("");
    loadGuests();
  }

  async function startScanner() {
    setCameraError(null);
    setError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          if (decodedText === lastCodeRef.current) return;
          lastCodeRef.current = decodedText;
          submitCode(decodedText);
          window.setTimeout(() => {
            lastCodeRef.current = "";
          }, 2500);
        },
        () => {}
      );
      setCameraRunning(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "No se pudo abrir la cámara. Podés pegar el código manualmente."
      );
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      await scanner.clear();
    } catch {
      // La cámara pudo haber sido cerrada por el navegador.
    } finally {
      scannerRef.current = null;
      setCameraRunning(false);
    }
  }

  async function undoCheckin(guest: CheckinGuest) {
    const ok = window.confirm(`¿Deshacer el ingreso de ${guest.nombre} ${guest.apellido}?`);
    if (!ok) return;

    const res = await fetch(`/api/events/${eventId}/guests/${guest.id}/checkin`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo deshacer el check-in");
      return;
    }
    loadGuests();
  }

  const stats = useMemo(() => {
    const checkedIn = guests.filter((g) => g.checkedInAt).length;
    return { checkedIn, pending: guests.length - checkedIn, total: guests.length };
  }, [guests]);

  const filteredGuests = guests.filter((guest) => {
    const q = search.toLowerCase();
    return (
      guest.nombre.toLowerCase().includes(q) ||
      guest.apellido.toLowerCase().includes(q) ||
      guest.email.toLowerCase().includes(q)
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Check-in</h1>
          <p className="mt-1 text-sm text-neutral-500">Escaneo de QR y acreditación en puerta.</p>
        </div>
        <Link href={`/dashboard/events/${eventId}/guests`} className="btn-secondary">
          Ver invitados
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ingresados" value={stats.checkedIn} />
        <StatCard label="Pendientes" value={stats.pending} />
        <StatCard label="Invitados" value={stats.total} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Scanner</h2>
            {cameraRunning ? (
              <button className="btn-secondary" onClick={stopScanner}>
                Detener cámara
              </button>
            ) : (
              <button className="btn-primary" onClick={startScanner}>
                Iniciar cámara
              </button>
            )}
          </div>

          <div
            id={scannerId}
            className="min-h-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
          />

          {cameraError && <p className="mt-3 text-sm text-red-600">{cameraError}</p>}

          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              submitCode(manualCode);
            }}
          >
            <input
              className="input"
              placeholder="Pegar código o token..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button className="btn-primary sm:w-40" disabled={checking}>
              {checking ? "Validando..." : "Registrar"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="mb-4 font-medium">Resultado</h2>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {!error && !result && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
              Esperando lectura de QR.
            </div>
          )}
          {result && (
            <div
              className={`rounded-xl border p-4 ${
                result.status === "checked_in"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="text-sm font-medium">{result.message}</p>
              <p className="mt-3 text-xl font-semibold">
                {result.guest.nombre} {result.guest.apellido}
              </p>
              <p className="mt-1 text-sm opacity-80">{result.guest.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${rsvpStyle[result.guest.estadoRsvp]}`}>
                  {rsvpLabel[result.guest.estadoRsvp]}
                </span>
                <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium">
                  {result.guest.cantidadConfirmada ?? result.guest.cantidadPersonasPermitidas} persona
                  {(result.guest.cantidadConfirmada ?? result.guest.cantidadPersonasPermitidas) !== 1 && "s"}
                </span>
              </div>
              {result.guest.checkedInAt && (
                <p className="mt-4 text-xs opacity-75">Ingreso: {formatDate(result.guest.checkedInAt)}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-medium">Listado de acreditación</h2>
          <input
            className="input max-w-sm"
            placeholder="Buscar invitado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Cargando...</p>
        ) : filteredGuests.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay invitados que coincidan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="border-b border-neutral-200 text-left text-neutral-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Invitado</th>
                  <th className="py-3 pr-4 font-medium">RSVP</th>
                  <th className="py-3 pr-4 font-medium">Ingreso</th>
                  <th className="py-3 pr-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => (
                  <tr key={guest.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-neutral-900">
                        {guest.nombre} {guest.apellido}
                      </p>
                      <p className="text-xs text-neutral-400">{guest.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${rsvpStyle[guest.estadoRsvp]}`}>
                        {rsvpLabel[guest.estadoRsvp]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-neutral-500">
                      {guest.checkedInAt ? formatDate(guest.checkedInAt) : "Pendiente"}
                    </td>
                    <td className="py-3 pr-4">
                      {guest.checkedInAt ? (
                        <button className="text-xs font-medium text-neutral-600 underline" onClick={() => undoCheckin(guest)}>
                          Deshacer ingreso
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">Sin ingreso</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
