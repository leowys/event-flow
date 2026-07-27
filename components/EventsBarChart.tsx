"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EventStat = {
  nombreEvento: string;
  confirmados: number;
  pendientes: number;
  rechazados: number;
};

export default function EventsBarChart({ data }: { data: EventStat[] }) {
  if (data.length === 0) return null;

  // Trunca nombres largos para que no rompan el eje X.
  const chartData = data.map((d) => ({
    ...d,
    label: d.nombreEvento.length > 16 ? `${d.nombreEvento.slice(0, 15)}…` : d.nombreEvento,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#737373" }}
            axisLine={{ stroke: "#e5e5e5" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#737373" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 13 }}
            cursor={{ fill: "#fafafa" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="confirmados" name="Confirmados" stackId="a" fill="#16a34a" />
          <Bar dataKey="pendientes" name="Pendientes" stackId="a" fill="#a3a3a3" />
          <Bar dataKey="rechazados" name="Rechazados" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
