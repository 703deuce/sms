import Link from "next/link";

export function LegalShell({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate?: string;
  children: React.ReactNode;
}) {
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
            <Link href="/contact" className="text-slate-600 hover:text-indigo-600">
              Contact
            </Link>
            <Link href="/" className="text-indigo-600 hover:underline">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-12">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {effectiveDate ? (
          <p className="mb-6 text-sm text-slate-500">Effective date: {effectiveDate}</p>
        ) : null}
        <div className="space-y-4 text-[15px] leading-7 text-slate-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 sm:[&_h2]:text-xl [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_a]:text-indigo-600 [&_a]:underline">
          {children}
        </div>
      </main>
      <footer className="border-t border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        <p className="mb-3">
          <Link href="/privacy" className="mx-2 text-indigo-600 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="mx-2 text-indigo-600 hover:underline">
            Terms of Service
          </Link>
          <Link href="/acceptable-use" className="mx-2 text-indigo-600 hover:underline">
            Acceptable Use Policy
          </Link>
          <Link href="/contact" className="mx-2 text-indigo-600 hover:underline">
            Contact
          </Link>
        </p>
        <p>© 2026 Transovo AI LLC. Woodbridge, Virginia. All rights reserved.</p>
      </footer>
    </div>
  );
}
