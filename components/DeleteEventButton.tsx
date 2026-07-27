"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "¿Eliminar este evento? Esta acción no se puede deshacer y borrará también todos los invitados asociados."
    );
    if (!confirmed) return;

    setLoading(true);
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    setLoading(false);

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <button onClick={handleDelete} disabled={loading} className="btn-secondary text-red-600">
      {loading ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
