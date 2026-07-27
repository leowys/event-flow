import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EventsBarChart from "@/components/EventsBarChart";
import { formatEventDate } from "@/lib/eventDatetime";

const estadoLabel: Record<string, string> = {
  BORRADOR: "Borrador",
  ACTIVO: "Publicado",
  FINALIZADO: "Finalizado",
};

const estadoStyle: Record<string, string> = {
  BORRADOR: "bg-neutral-100 text-neutral-600",
  ACTIVO: "bg-green-100 text-green-700",
  FINALIZADO: "bg-neutral-100 text-neutral-500",
};

export default async function DashboardPage() {
  const session = await getSession();
  const userId = session!.userId;

  const events = await prisma.event.findMany({
    where: { userId },
    orderBy: { fecha: "asc" },
    include: { guests: { select: { estadoRsvp: true } } },
  });

  const totalInvitados = events.reduce((acc, e) => acc + e.guests.length, 0);
  const totalConfirmados = events.reduce(
    (acc, e) => acc + e.guests.filter((g) => g.estadoRsvp === "CONFIRMADO").length,
    0
  );
  const totalPendientes = events.reduce(
    (acc, e) => acc + e.guests.filter((g) => g.estadoRsvp === "PENDIENTE").length,
    0
  );
  const proximosEventos = events.filter(
    (e) => e.fecha >= new Date() && e.estado !== "FINALIZADO"
  ).length;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Resumen de todos tus eventos.
          </p>
        </div>
        <Link href="/dashboard/events/new" className="btn-primary">
          + Nuevo evento
        </Link>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Eventos" value={events.length} />
        <StatCard label="Próximos" value={proximosEventos} />
        <StatCard label="Invitados" value={totalInvitados} />
        <StatCard label="Confirmados" value={totalConfirmados} sub={`${totalPendientes} pendientes`} />
      </div>

      {events.some((e) => e.guests.length > 0) && (
        <div className="card mb-10">
          <h2 className="mb-4 text-sm font-medium text-neutral-500">Respuestas por evento</h2>
          <EventsBarChart
            data={events
              .filter((e) => e.guests.length > 0)
              .map((e) => ({
                nombreEvento: e.nombreEvento,
                confirmados: e.guests.filter((g) => g.estadoRsvp === "CONFIRMADO").length,
                pendientes: e.guests.filter((g) => g.estadoRsvp === "PENDIENTE").length,
                rechazados: e.guests.filter((g) => g.estadoRsvp === "RECHAZADO").length,
              }))}
          />
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium text-neutral-500">Tus eventos</h2>

      {events.length === 0 ? (
        <div className="card text-center text-sm text-neutral-500">
          Todavía no creaste ningún evento.{" "}
          <Link href="/dashboard/events/new" className="font-medium text-neutral-900">
            Creá el primero
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Invitados</th>
                <th className="px-5 py-3 font-medium">Confirmados</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const confirmados = event.guests.filter((g) => g.estadoRsvp === "CONFIRMADO").length;
                return (
                  <tr key={event.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      {event.nombreEvento}
                    </td>
                    <td className="px-5 py-3 text-neutral-500">
                      {formatEventDate(event.fecha, { style: "compact" })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoStyle[event.estado]}`}
                      >
                        {estadoLabel[event.estado]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-neutral-500">{event.guests.length}</td>
                    <td className="px-5 py-3 text-neutral-500">{confirmados}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/events/${event.id}`}
                        className="text-neutral-500 hover:text-neutral-900"
                      >
                        Gestionar →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
