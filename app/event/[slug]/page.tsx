import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Countdown from "@/components/Countdown";
import { getEventStartIso, formatEventDate } from "@/lib/eventDatetime";

export default async function PublicEventPage({ params }: { params: { slug: string } }) {
  const event = await prisma.event.findUnique({ where: { slugPublico: params.slug } });

  if (!event) notFound();

  const targetIso = getEventStartIso(event);

  return (
    <main>
      <section
        className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center text-white"
        style={{
          background: `linear-gradient(135deg, ${event.colorPrincipal}, ${event.colorSecundario})`,
        }}
      >
        {event.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.logo} alt="Logo" className="mb-6 h-16 w-16 rounded-full object-cover" />
        )}
        <span className="mb-3 text-sm uppercase tracking-widest opacity-80">
          {event.tipoEvento}
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {event.nombreEvento}
        </h1>
        <p className="mt-4 text-lg opacity-90">
          {formatEventDate(event.fecha, { style: "full" })} · {event.horaInicio}hs
        </p>

        <div className="mt-8">
          <Countdown targetIso={targetIso} />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-16">
        {event.descripcion && (
          <p className="mb-8 text-center text-neutral-600">{event.descripcion}</p>
        )}

        {event.nombreLugar && (
          <div className="card mb-8 text-center">
            <h2 className="font-medium">{event.nombreLugar}</h2>
            {event.direccion && <p className="mt-1 text-sm text-neutral-500">{event.direccion}</p>}
            {event.mapaUrl && (
              <a
                href={event.mapaUrl}
                target="_blank"
                className="mt-3 inline-block text-sm font-medium underline"
              >
                Ver en el mapa
              </a>
            )}
          </div>
        )}

        <div className="text-center text-sm text-neutral-500">
          Si recibiste una invitación por email, usá el enlace personalizado de tu invitación
          para confirmar tu asistencia.
        </div>
      </section>
    </main>
  );
}
