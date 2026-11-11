import Link from "next/link";
import { signUp } from "./actions";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900">Start your free trial</h1>
        <p className="text-sm text-gray-500 mt-1">
          30 days, full access, no payment details needed.
        </p>

        <form action={signUp} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Business name</label>
            <input
              name="businessName"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Your name</label>
            <input
              name="ownerName"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">At least 8 characters.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Currency</label>
            <select
              name="baseCurrency"
              defaultValue="USD"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="USD">USD</option>
              <option value="ZIG">ZiG</option>
              <option value="ZAR">ZAR</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700"
          >
            Start free trial
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
