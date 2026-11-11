import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";

const PLANS = [
  { name: "Starter", blurb: "Small businesses just getting going", features: ["1 user", "Core sales & inventory", "Basic reports"] },
  { name: "Business", blurb: "Growing businesses with a small team", features: ["Up to 5 users", "Quotations & purchases", "Full reports"] },
  { name: "Professional", blurb: "Larger businesses", features: ["Up to 15 users", "AI Business Copilot", "Priority support"] },
  { name: "Enterprise", blurb: "Larger/multi-branch organisations", features: ["Unlimited users", "Multi-branch", "Dedicated support"] },
];

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { subscription: true },
  });

  const trialEndsAt = business?.trialEndsAt ?? null;
  const daysLeft = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const currentPlan = business?.subscription?.active ? business.subscription.plan : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Billing & Plans</h1>
          {currentPlan ? (
            <p className="text-sm text-gray-500">
              Currently subscribed to the <span className="font-medium">{currentPlan}</span> plan.
            </p>
          ) : daysLeft !== null ? (
            <p className="text-sm text-gray-500">
              {daysLeft > 0
                ? `You're on a free trial — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`
                : "Your free trial has ended."}
            </p>
          ) : (
            <p className="text-sm text-gray-500">No active subscription or trial on file.</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div key={plan.name} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
              <h2 className="font-semibold text-gray-900">{plan.name}</h2>
              <p className="text-xs text-gray-500 mt-1 mb-3">{plan.blurb}</p>
              <ul className="text-xs text-gray-600 space-y-1 flex-1">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <a
                href={`mailto:sales@gtktechsolutions.com?subject=${encodeURIComponent(
                  `Interested in the ${plan.name} plan`
                )}`}
                className="mt-4 text-center rounded-lg bg-brand-600 text-white text-xs font-medium py-2 hover:bg-brand-700"
              >
                {currentPlan === plan.name.toUpperCase() ? "Current plan" : "Contact us"}
              </a>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Final pricing is still being confirmed with early businesses. Reach out and we&apos;ll get
          you set up — online card/mobile-money payment is coming soon.
        </p>
      </div>
    </div>
  );
}
