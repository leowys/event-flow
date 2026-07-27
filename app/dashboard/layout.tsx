import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import VerificationBanner from "@/components/VerificationBanner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { emailVerified: true },
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Event Flow
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings/email" className="text-sm text-neutral-500 hover:text-neutral-900">
              Ajustes de email
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      {user && !user.emailVerified && <VerificationBanner />}
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
