"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton({
  className = "text-sm text-neutral-500 hover:text-neutral-900",
}: {
  className?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className={className}>
      Cerrar sesión
    </button>
  );
}
