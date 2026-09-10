"use client";

import Link from "next/link";

export function AppointmentSegmentsCanonicalClient() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Segments moved to canonical homes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customer segments and recall-specific views now live in their proper destinations. This temporary route
          remains for compatibility only.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border p-5 space-y-2">
          <h2 className="text-base font-semibold">General customer segments</h2>
          <p className="text-sm text-muted-foreground">
            Filter contacts by attributes, appointment history, packages, memberships, and custom fields.
          </p>
          <Link href="/contacts/segments" className="text-sm font-medium text-primary hover:underline">
            Open Contacts → Segments
          </Link>
        </article>

        <article className="rounded-xl border p-5 space-y-2">
          <h2 className="text-base font-semibold">Recall saved views</h2>
          <p className="text-sm text-muted-foreground">
            Save recall filters such as overdue service or due-by-type views for follow-up workflows.
          </p>
          <Link href="/appointments/recalls" className="text-sm font-medium text-primary hover:underline">
            Open Recalls → Saved views
          </Link>
        </article>
      </div>
    </div>
  );
}
