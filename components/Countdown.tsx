"use client";

import { useEffect, useState } from "react";

function getDiff(target: Date) {
  const now = new Date().getTime();
  const diff = target.getTime() - now;
  if (diff <= 0) return null;

  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutos = Math.floor((diff / (1000 * 60)) % 60);

  return { dias, horas, minutos };
}

// Recibe el timestamp en ISO ya combinando fecha + hora + timezone del evento,
// calculado en el servidor para evitar depender del reloj/zona del browser.
export default function Countdown({ targetIso }: { targetIso: string }) {
  const target = new Date(targetIso);
  const [diff, setDiff] = useState(() => getDiff(target));

  useEffect(() => {
    const interval = setInterval(() => setDiff(getDiff(target)), 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);

  if (!diff) {
    return <p className="text-sm text-neutral-500">Este evento ya comenzó o finalizó.</p>;
  }

  return (
    <div className="flex gap-4">
      <TimeBlock value={diff.dias} label="días" />
      <TimeBlock value={diff.horas} label="horas" />
      <TimeBlock value={diff.minutos} label="min" />
    </div>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
      <span className="text-2xl font-semibold">{value}</span>
      <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}
