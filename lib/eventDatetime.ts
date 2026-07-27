import { DateTime } from "luxon";

// PROBLEMA QUE RESUELVE ESTE ARCHIVO:
// `Event.fecha` se guarda como una fecha-hora en UTC medianoche (viene de un
// <input type="date">, que Prisma/JS interpretan como "YYYY-MM-DDT00:00:00Z").
// `Event.horaInicio` es un string "HH:mm" suelto, sin timezone. Y
// `Event.timezone` es la zona horaria del evento (ej.
// "America/Argentina/Buenos_Aires"), no necesariamente la del servidor ni la
// del navegador de cada invitado.
//
// La versión anterior de este código hacía algo como:
//   const d = new Date(event.fecha); d.setHours(hora, minutos)
// eso combina la fecha con la hora usando la ZONA HORARIA LOCAL DEL PROCESO
// QUE EJECUTA EL CÓDIGO (el servidor, o el navegador del invitado) — no la
// zona horaria configurada en el evento. Si el servidor corre en UTC (lo más
// común en Docker) y el evento es a las 19:00 en Buenos Aires (UTC-3), la
// cuenta regresiva/el instante calculado quedaba corrido por esas 3 horas.
// También afectaba a `toLocaleDateString` en el servidor: podía mostrar un
// día distinto al elegido, según el desfase horario del proceso vs UTC.
//
// Acá se resuelve combinando explícitamente fecha + hora en la zona horaria
// GUARDADA en el evento, usando Luxon, para obtener el instante real
// correcto sin importar dónde se ejecute el código.

type EventDateTimeInput = {
  fecha: Date;
  horaInicio: string; // "HH:mm"
  timezone: string; // IANA, ej "America/Argentina/Buenos_Aires"
};

// Devuelve el instante real de inicio del evento, como DateTime de Luxon en
// la zona horaria del evento.
export function getEventStartDateTime(event: EventDateTimeInput): DateTime {
  const [hour, minute] = event.horaInicio.split(":").map(Number);

  // Los componentes año/mes/día se leen en UTC porque así es como se
  // guardó `fecha` (medianoche UTC del día elegido en el formulario) — leer
  // esos componentes en la zona local del servidor podría correr el día.
  return DateTime.fromObject(
    {
      year: event.fecha.getUTCFullYear(),
      month: event.fecha.getUTCMonth() + 1,
      day: event.fecha.getUTCDate(),
      hour: Number.isFinite(hour) ? hour : 0,
      minute: Number.isFinite(minute) ? minute : 0,
    },
    { zone: event.timezone || "UTC" }
  );
}

// Instante real (ISO en UTC) para pasarle a un <Countdown> u otro cálculo
// que compare contra "ahora" — new Date(iso) da el instante correcto sin
// importar en qué timezone corra el navegador que lo reciba.
export function getEventStartIso(event: EventDateTimeInput): string {
  return getEventStartDateTime(event).toUTC().toISO() ?? new Date().toISOString();
}

// Formatea solo la fecha calendario del evento (sin depender de la hora del
// servidor/navegador que renderiza) — usa los mismos componentes año/mes/día
// que se guardaron, sin corrimiento de día.
export function formatEventDate(
  fecha: Date,
  opts: { locale?: string; style?: "full" | "long" | "compact" | "short" } = {}
): string {
  const { locale = "es-AR", style = "long" } = opts;

  const formats: Record<string, Intl.DateTimeFormatOptions> = {
    full: { weekday: "long", day: "2-digit", month: "long", year: "numeric" },
    long: { day: "2-digit", month: "long", year: "numeric" },
    compact: { day: "2-digit", month: "short", year: "numeric" },
    short: { day: "2-digit", month: "2-digit", year: "numeric" },
  };

  // timeZone: "UTC" es la clave acá: fuerza a leer los componentes de fecha
  // tal cual se guardaron (UTC medianoche), sin que el timezone local del
  // proceso corra el día hacia adelante o atrás.
  return new Intl.DateTimeFormat(locale, { ...formats[style], timeZone: "UTC" }).format(fecha);
}
