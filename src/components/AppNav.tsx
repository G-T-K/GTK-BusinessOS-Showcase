import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNavLinks } from "./AppNavLinks";
import { TrialBanner } from "./TrialBanner";

// Server component: looks up the business itself (name + trial status) so
// every page only needs to pass businessId, rather than re-fetching and
// threading businessName + trialEndsAt through each page individually.
export async function AppNav({ businessId }: { businessId: string }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  const [business, membership] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, trialEndsAt: true },
    }),
    userId
      ? prisma.membership.findFirst({
          where: { userId, businessId, active: true },
          select: { role: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <span className="hidden shrink-0 font-semibold text-sm text-gray-900 md:flex">GTK BusinessOS</span>
        <AppNavLinks companyName={business?.name ?? ""} role={membership?.role} />
        <span className="hidden shrink-0 whitespace-nowrap text-sm text-gray-500 md:flex">{business?.name ?? ""}</span>
      </div>
      <TrialBanner trialEndsAt={business?.trialEndsAt ?? null} />
    </header>
  );
}
