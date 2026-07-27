import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DeleteEventButton from "@/components/DeleteEventButton";
import EventBrandingForm from "@/components/EventBrandingForm";
import RsvpPieChart from "@/components/RsvpPieChart";
import EventStatusControl from "@/components/EventStatusControl";
import { formatEventDate } from "@/lib/eventDatetime";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { guests: { select: { estadoRsvp: true, checkedInAt: true } } },
  });

  if (!event || event.userId !== session!.userId) {
    notFound();
  }

  const confirmados = event.guests.filter((g) => g.estadoRsvp === "CONFIRMADO").length;
  const rechazados = event.guests.filter((g) => g.estadoRsvp === "RECHAZADO").length;
  const pendientes = event.guests.filter((g) => g.estadoRsvp === "PENDIENTE").length;
  const ingresados = event.guests.filter((g) => g.checkedInAt).length;

  const emailLogGroups = await prisma.emailLog.groupBy({
    by: ["status"],
    where: { eventId: event.id },
    _count: { _all: true },
  });
  const emailsEnviados = emailLogGroups
    .filter((g) => g.status === "ENVIADO" || g.status === "ENTREGADO")
    .reduce((acc, g) => acc + g._count._all, 0);
  const emailsFallidos = emailLogGroups
    .filter((g) => g.status === "FALLIDO" || g.status === "REBOTADO")
    .reduce((acc, g) => acc + g._count._all, 0);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Volver
          </Link>
          <h1 className="page-title mt-2">{event.nombreEvento}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <EventStatusControl eventId={event.id} initialEstado={event.estado} />
            <p className="text-sm text-neutral-500">
              {formatEventDate(event.fecha)} · {event.horaInicio}hs
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
          <a
            href={`/event/${event.slugPublico}`}
            target="_blank"
            className="btn-secondary min-h-11"
          >
            Ver landing pública
          </a>
          <DeleteEventButton eventId={event.id} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-sm font-medium text-neutral-500">Estado de las respuestas</h2>
          <RsvpPieChart confirmados={confirmados} pendientes={pendientes} rechazados={rechazados} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Confirmados" value={confirmados} />
          <StatCard label="Pendientes" value={pendientes} />
          <StatCard label="Rechazados" value={rechazados} />
          <StatCard
            label="Emails enviados"
            value={emailsEnviados}
            sub={emailsFallidos > 0 ? `${emailsFallidos} fallaron` : undefined}
          />
          <StatCard label="Ingresados" value={ingresados} sub={`${event.guests.length} invitados`} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Invitados</h2>
            <p className="text-sm text-neutral-500">
              {event.guests.length} invitado{event.guests.length !== 1 && "s"} cargado
              {event.guests.length !== 1 && "s"}.
            </p>
          </div>
          <Link href={`/dashboard/events/${event.id}/guests`} className="btn-primary">
            Gestionar
          </Link>
        </div>

        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Check-in</h2>
            <p className="text-sm text-neutral-500">
              {ingresados} ingreso{ingresados !== 1 && "s"} registrado{ingresados !== 1 && "s"}.
            </p>
          </div>
          <Link href={`/dashboard/events/${event.id}/checkin`} className="btn-primary">
            Abrir
          </Link>
        </div>

        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Emails</h2>
            <p className="text-sm text-neutral-500">Plantillas e invitaciones.</p>
          </div>
          <Link href={`/dashboard/events/${event.id}/emails`} className="btn-primary">
            Gestionar
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <EventBrandingForm
          eventId={event.id}
          initial={{
            logo: event.logo,
            colorPrincipal: event.colorPrincipal,
            colorSecundario: event.colorSecundario,
          }}
        />
      </div>

      <div className="card text-sm text-neutral-500">
        Link público de RSVP: cada invitado recibe un enlace único del tipo{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
          /rsvp/&#123;token&#125;
        </code>{" "}
        generado automáticamente al cargarlo.
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-amber-600">{sub}</p>}
    </div>
  );
}
