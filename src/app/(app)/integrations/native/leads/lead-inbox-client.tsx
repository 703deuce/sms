"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";

type Submission = {
  id: string;
  phone: string;
  contactId: string | null;
  createdAt: string;
  formName: string;
  formSlug: string | null;
  provider: string | null;
  email: string | null;
  answers: Record<string, unknown>;
};

export function LeadInboxClient() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/native/leads")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setRows(j.data?.submissions || []);
      })
      .catch(() => setError("Failed to load submissions"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Lead inbox"
        description="Typeform and Jotform submissions synced into Transovo — match contacts, call, or SMS without leaving the product."
      />
      <div className="mb-4 text-sm">
        <Link href="/integrations/native" className="underline">
          ← Native integrations
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        {rows.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{s.formName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {s.provider || "form"} · {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <StatusChip status={s.contactId ? "Matched" : "Unmatched"} />
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{s.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{s.email || "—"}</dd>
              </div>
            </dl>
            {Object.keys(s.answers || {}).length ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-xs">
                {JSON.stringify(s.answers, null, 2)}
              </pre>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {s.contactId ? (
                <Link href={`/contacts/${s.contactId}`} className="underline">
                  Open contact
                </Link>
              ) : null}
              <Link href="/conversations" className="underline">
                Messenger
              </Link>
            </div>
          </Card>
        ))}
        {!rows.length && !error ? (
          <p className="text-sm text-muted-foreground">
            No integration form submissions yet. Connect Typeform or Jotform and sync.
          </p>
        ) : null}
      </div>
    </div>
  );
}
