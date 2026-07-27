"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

function itemClass(active: boolean) {
  return [
    "inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition",
    active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
  ].join(" ");
}

function eventIdFromPath(pathname: string) {
  const match = pathname.match(/^\/dashboard\/events\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

export default function DashboardNav() {
  const pathname = usePathname();
  const eventId = eventIdFromPath(pathname);

  const mainItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Eventos",
      match: (path) => path === "/dashboard",
    },
    {
      href: "/dashboard/events/new",
      label: "Nuevo evento",
      match: (path) => path === "/dashboard/events/new",
    },
    {
      href: "/dashboard/settings/email",
      label: "Email",
      match: (path) => path.startsWith("/dashboard/settings/email"),
    },
  ];

  const eventItems: NavItem[] = eventId
    ? [
        {
          href: `/dashboard/events/${eventId}`,
          label: "Resumen",
          match: (path) => path === `/dashboard/events/${eventId}`,
        },
        {
          href: `/dashboard/events/${eventId}/guests`,
          label: "Invitados",
          match: (path) => path.startsWith(`/dashboard/events/${eventId}/guests`),
        },
        {
          href: `/dashboard/events/${eventId}/emails`,
          label: "Invitaciones",
          match: (path) => path.startsWith(`/dashboard/events/${eventId}/emails`),
        },
        {
          href: `/dashboard/events/${eventId}/checkin`,
          label: "Check-in",
          match: (path) => path.startsWith(`/dashboard/events/${eventId}/checkin`),
        },
      ]
    : [];

  const mobileItems = [...mainItems, ...eventItems];

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-200 bg-white px-4 py-5 md:flex md:flex-col">
        <Link href="/dashboard" className="mb-8 px-2 text-lg font-semibold tracking-tight text-neutral-950">
          Event Flow
        </Link>

        <nav className="space-y-1">
          {mainItems.map((item) => (
            <Link key={item.href} href={item.href} className={itemClass(item.match(pathname))}>
              {item.label}
            </Link>
          ))}
        </nav>

        {eventItems.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Este evento
            </p>
            <nav className="space-y-1">
              {eventItems.map((item) => (
                <Link key={item.href} href={item.href} className={itemClass(item.match(pathname))}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div className="mt-auto border-t border-neutral-200 pt-4">
          <LogoutButton className="inline-flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950" />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight text-neutral-950">
            Event Flow
          </Link>
          <LogoutButton />
        </div>
        <nav className="flex gap-2 overflow-x-auto border-t border-neutral-100 px-4 py-2">
          {mobileItems.map((item) => (
            <Link key={item.href} href={item.href} className={`${itemClass(item.match(pathname))} shrink-0`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
