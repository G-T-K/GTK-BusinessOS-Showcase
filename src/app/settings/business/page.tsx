import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { hasPermission, requirePagePermission } from "@/lib/permissions";
import { BusinessProfileForm } from "./BusinessProfileForm";

export default async function BusinessSettingsPage() {
  const { role } = await requirePagePermission("settings");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const canEdit = hasPermission(role, "settings");
  const business = await prisma.business.findUnique({ where: { id: businessId } });

  if (!business) notFound();

  const logoSrc = business.logo && business.logoMimeType
    ? `data:${business.logoMimeType};base64,${Buffer.from(business.logo).toString("base64")}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Business profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            These details appear on your quotations and invoices.
          </p>
        </div>

        {canEdit ? (
          <BusinessProfileForm
            business={{
              name: business.name,
              address: business.address,
              phone: business.phone,
              email: business.email,
              website: business.website,
            }}
            logoSrc={logoSrc}
          />
        ) : (
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            {logoSrc && <img src={logoSrc} alt={`${business.name} logo`} className="h-16 max-w-40 object-contain" />}
            <h2 className="text-lg font-semibold text-gray-900">{business.name}</h2>
            {business.address && <p className="whitespace-pre-line text-sm text-gray-600">{business.address}</p>}
            {[business.phone, business.email, business.website].filter(Boolean).map((detail) => (
              <p key={detail} className="text-sm text-gray-600">{detail}</p>
            ))}
            <p className="border-t border-gray-100 pt-4 text-xs text-gray-500">
              An Owner or Administrator can update these details.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}