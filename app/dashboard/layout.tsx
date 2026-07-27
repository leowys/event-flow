import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardNav from "@/components/DashboardNav";
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
    <div className="min-h-screen bg-neutral-50">
      <DashboardNav />
      <div className="md:pl-64">
        {user && !user.emailVerified && <VerificationBanner />}
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-40 sm:px-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
