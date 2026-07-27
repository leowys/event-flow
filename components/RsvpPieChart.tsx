"use client";

type Props = {
  confirmados: number;
  pendientes: number;
  rechazados: number;
};

const COLORS = {
  confirmados: "#16a34a",
  pendientes: "#a3a3a3",
  rechazados: "#dc2626",
};

export default function RsvpPieChart({ confirmados, pendientes, rechazados }: Props) {
  const total = confirmados + pendientes + rechazados;

  const data = [
    { name: "Confirmados", value: confirmados, color: COLORS.confirmados },
    { name: "Pendientes", value: pendientes, color: COLORS.pendientes },
    { name: "Rechazados", value: rechazados, color: COLORS.rechazados },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-neutral-400">
        Todavía no hay invitados cargados.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-neutral-100">
        {data.map((entry) => (
          <div
            key={entry.name}
            style={{
              width: `${Math.max((entry.value / total) * 100, 4)}%`,
              backgroundColor: entry.color,
            }}
          />
        ))}
      </div>
      <div className="w-full min-w-0 space-y-2 text-sm sm:w-auto">
        {data.map((entry) => (
          <div key={entry.name} className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="min-w-0 flex-1 text-neutral-600">{entry.name}</span>
            <span className="font-medium text-neutral-900">{entry.value}</span>
            <span className="text-neutral-400">
              ({Math.round((entry.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
