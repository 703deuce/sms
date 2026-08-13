import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Transovo AI LLC in Woodbridge, Virginia for business messaging support.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
          <Link href="/" className="font-semibold text-slate-900">
            Transovo AI
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-medium">
            <Link href="/privacy" className="text-slate-600 hover:text-indigo-600">
              Privacy
            </Link>
            <Link href="/terms" className="text-slate-600 hover:text-indigo-600">
              Terms
            </Link>
            <Link href="/acceptable-use" className="text-slate-600 hover:text-indigo-600">
              Acceptable Use
            </Link>
            <Link href="/" className="text-indigo-600 hover:underline">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-12">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Contact</h1>
        <p className="mb-6 text-[15px] leading-7 text-slate-600">
          Transovo AI LLC provides business messaging software for permission-based SMS marketing
          and customer communication. For support, compliance questions, or account help, reach us
          using the details below.
        </p>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Support email</p>
          <a
            href="mailto:support@transovo.ai"
            className="mt-2 block break-all text-xl font-semibold text-slate-900 hover:text-indigo-600 sm:text-2xl"
          >
            support@transovo.ai
          </a>
          <p className="mt-4 text-sm text-slate-600">
            Legal business name: <strong className="text-slate-900">Transovo AI LLC</strong>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Location: <strong className="text-slate-900">Woodbridge, Virginia, United States</strong>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Customers receiving business texts can reply STOP to opt out or HELP for assistance.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
          <Link href="/privacy" className="text-indigo-600 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-indigo-600 hover:underline">
            Terms of Service
          </Link>
          <Link href="/acceptable-use" className="text-indigo-600 hover:underline">
            Acceptable Use Policy
          </Link>
          <Link href="/login" className="text-indigo-600 hover:underline">
            Log In
          </Link>
        </div>
      </main>
      <footer className="border-t border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        © 2026 Transovo AI LLC. Woodbridge, Virginia. All rights reserved.
      </footer>
    </div>
  );
}
