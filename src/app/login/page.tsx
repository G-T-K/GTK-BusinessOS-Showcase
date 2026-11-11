"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { getLoginBusinesses } from "./actions";

type LoginBusiness = { id: string; name: string; role: string };

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState<LoginBusiness[] | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");

  async function signInToBusiness(businessId: string, role?: string) {
    const res = await signIn("credentials", {
      email,
      password,
      businessId,
      redirect: false,
    });

    if (!res || res.error) {
      setError("We couldn't sign you in. Check your email and password and try again.");
      return;
    }
    const businessRole = role ?? businesses?.find((item) => item.id === businessId)?.role;
    router.push(businessRole === "EMPLOYEE" ? "/payroll/my-payslips" : "/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await getLoginBusinesses(email, password);
      if (result.status === "unavailable") {
        setError("The Supabase database rejected its configured project or pooler user. Update the connection strings in .env and restart the app.");
        return;
      }
      const availableBusinesses = result.status === "ok" ? result.businesses : [];
      if (availableBusinesses.length === 0) {
        setError("We couldn't sign you in. Check your email and password and try again.");
        return;
      }
      if (availableBusinesses.length === 1) {
        await signInToBusiness(availableBusinesses[0].id, availableBusinesses[0].role);
        return;
      }
      setBusinesses(availableBusinesses);
      setSelectedBusinessId(availableBusinesses[0].id);
    } catch {
      setError("Unable to sign in right now. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBusinessId) return;
    setLoading(true);
    setError(null);
    try {
      await signInToBusiness(selectedBusinessId);
    } catch {
      setError("Unable to sign in right now. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900">GTK BusinessOS</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your business.</p>

        {justRegistered && (
          <p className="mt-4 text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
            Account created — your 30-day free trial has started. Log in below.
          </p>
        )}

        {businesses ? (
          <form onSubmit={handleBusinessSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="businessId" className="block text-sm font-medium text-gray-700">
                Choose a business
              </label>
              <select
                id="businessId"
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !selectedBusinessId}
              className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBusinesses(null);
                setError(null);
              }}
              className="w-full text-sm text-brand-600 hover:underline"
            >
              Use a different account
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1">
                <input
                  type={passwordVisible ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                  title={passwordVisible ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
                >
                  {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-gray-500 text-center">
          New here?{" "}
          <Link href="/signup" className="text-brand-600 hover:underline">
            Start a free trial
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
