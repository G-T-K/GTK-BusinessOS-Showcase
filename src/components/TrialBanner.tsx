import Link from "next/link";

export function TrialBanner({ trialEndsAt }: { trialEndsAt: Date | null }) {
  if (!trialEndsAt) return null;

  const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft > 7) return null; // only surface it once it's actually approaching

  const expired = daysLeft <= 0;

  return (
    <div
      className={`text-sm px-6 py-2 text-center ${
        expired ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
      }`}
    >
      {expired
        ? "Your free trial has ended. "
        : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. `}
      <Link href="/settings/billing" className="underline font-medium">
        {expired ? "Subscribe to keep using GTK BusinessOS" : "View plans"}
      </Link>
    </div>
  );
}
