import Link from "next/link";

export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link href="/" className="font-semibold text-slate-900">
            Transovo AI
          </Link>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <div className="space-y-4 text-[15px] leading-7 text-slate-600 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_a]:text-blue-600 [&_a]:underline">
          {children}
        </div>
      </main>
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © 2026 Transovo AI LLC. All rights reserved.
      </footer>
    </div>
  );
}
