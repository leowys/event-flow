"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="h-44 w-44 shrink-0 sm:h-52 sm:w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} (${Math.round((value / total) * 100)}%)`,
                name,
              ]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>
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
