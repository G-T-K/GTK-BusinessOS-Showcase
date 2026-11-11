import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { CopilotChat } from "./CopilotChat";

export default async function CopilotPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Business Copilot</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ask about your sales, debtors, stock, or expenses — answered from your real data.
        </p>
        <CopilotChat />
      </div>
    </div>
  );
}
