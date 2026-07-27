"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatEventDate } from "@/lib/eventDatetime";

type RsvpData = {
  guest: {
    nombre: string;
    apellido: string;
    estadoRsvp: "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";
    cantidadPersonasPermitidas: number;
    cantidadConfirmada: number | null;
    comentarios: string | null;
  };
  event: {
    nombreEvento: string;
    fecha: string;
    horaInicio: string;
    nombreLugar: string | null;
    direccion: string | null;
    colorPrincipal: string;
    colorSecundario: string;
  };
};

export default function RsvpPage({ params }: { params: { token: string } }) {
  return (
    <Suspense fallback={null}>
      <RsvpPageInner params={params} />
    </Suspense>
  );
}

function RsvpPageInner({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<RsvpData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<"inicial" | "confirmar" | "rechazar" | "listo">("inicial");
  const [cantidad, setCantidad] = useState(1);
  const [comentarios, setComentarios] = useState("");
  const [asistira, setAsistira] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rsvp/${params.token}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((d: RsvpData) => {
        setData(d);
        if (d.guest.estadoRsvp !== "PENDIENTE") {
          setStep("listo");
          return;
        }

        // Preselección desde los botones del email (?accion=confirmar|no).
        // IMPORTANTE: esto solo navega a la pantalla correspondiente, nunca
        // guarda la respuesta automáticamente — eso evita que un email
        // client o filtro anti-spam que "previsualiza" el link (haciendo un
        // GET automático antes de que la persona lo vea) registre un RSVP
        // falso. La escritura real solo ocurre con un clic explícito abajo.
        const accion = searchParams.get("accion");
        if (accion === "confirmar") {
          setAsistira(true);
          setStep("confirmar");
        } else if (accion === "no") {
          setAsistira(false);
          setStep("rechazar");
        }
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  async function submitResponse(willAttend: boolean) {
    setAsistira(willAttend);
    setError(null);

    if (willAttend) {
      setStep("confirmar");
      return;
    }

    await sendResponse(false);
  }

  async function sendResponse(willAttend: boolean) {
    setSaving(true);
    const res = await fetch(`/api/rsvp/${params.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asistira: willAttend,
        cantidadConfirmada: willAttend ? cantidad : 0,
        comentarios,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "No se pudo guardar tu respuesta");
      return;
    }

    setStep("listo");
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-neutral-500">
          No encontramos esta invitación. Verificá el enlace o contactá al organizador.
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-400">Cargando invitación...</p>
      </main>
    );
  }

  const { guest, event } = data;

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6 py-16"
      style={{
        background: `linear-gradient(135deg, ${event.colorPrincipal}15, ${event.colorSecundario}15)`,
      }}
    >
      <div className="card w-full max-w-md text-center">
        <p className="text-sm text-neutral-500">Estás invitado a</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.nombreEvento}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {formatEventDate(new Date(event.fecha))} · {event.horaInicio}hs
          {event.nombreLugar && ` · ${event.nombreLugar}`}
        </p>

        <div className="my-6 border-t border-neutral-100" />

        {step === "inicial" && (
          <div>
            <p className="mb-6">
              Hola {guest.nombre}, ¿confirmás tu asistencia?
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => submitResponse(false)}>
                No asistiré
              </button>
              <button className="btn-primary flex-1" onClick={() => submitResponse(true)}>
                Confirmar asistencia
              </button>
            </div>
          </div>
        )}

        {step === "confirmar" && (
          <div className="text-left">
            <label className="label">¿Cuántas personas asistirán?</label>
            <input
              type="number"
              min={1}
              max={guest.cantidadPersonasPermitidas}
              className="input mb-1"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
            />
            <p className="mb-4 text-xs text-neutral-400">
              Máximo permitido: {guest.cantidadPersonasPermitidas}
            </p>

            <label className="label">Comentarios (opcional)</label>
            <textarea
              className="input mb-4 min-h-20"
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
            />

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <button
              className="btn-primary w-full"
              disabled={saving}
              onClick={() => sendResponse(true)}
            >
              {saving ? "Guardando..." : "Confirmar"}
            </button>
          </div>
        )}

        {step === "rechazar" && (
          <div>
            <p className="mb-6">
              Vas a avisar que <strong>no podrás asistir</strong> a {event.nombreEvento}. ¿Confirmás
              el envío?
            </p>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep("inicial")}>
                Volver
              </button>
              <button
                className="btn-primary flex-1"
                disabled={saving}
                onClick={() => sendResponse(false)}
              >
                {saving ? "Enviando..." : "Sí, avisar"}
              </button>
            </div>
          </div>
        )}

        {step === "listo" && (
          <div>
            <p className="text-lg font-medium">
              {guest.estadoRsvp === "RECHAZADO" || asistira === false
                ? "Gracias por avisarnos 🙏"
                : "¡Gracias por confirmar! 🎉"}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Ya registramos tu respuesta. Cualquier cambio, contactá al organizador.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
