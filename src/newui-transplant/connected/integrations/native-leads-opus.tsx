"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

type Submission = {
  id: string;
  phone: string;
  contactId: string | null;
  createdAt: string;
  formName: string;
  provider: string | null;
  email: string | null;
  answers: Record<string, unknown>;
};

export function NativeLeadsOpus() {
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
    <div className="space-y-4">
      <Panel title="Lead inbox" description="Typeform and Jotform submissions synced into Transovo.">
        <ButtonLink href="/integrations/native" variant="outline">← Native integrations</ButtonLink>
      </Panel>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {rows.length === 0 ? (
        <Panel><p className="text-sm text-muted-foreground">No submissions yet.</p></Panel>
      ) : (
        rows.map((s) => (
          <Panel key={s.id} title={s.formName} description={`${s.provider || "form"} · ${new Date(s.createdAt).toLocaleString()}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={s.contactId ? "success" : "warning"}>{s.contactId ? "Matched" : "Unmatched"}</Pill>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Phone</dt><dd>{s.phone}</dd></div>
              <div><dt className="text-muted-foreground">Email</dt><dd>{s.email || "—"}</dd></div>
            </dl>
            {Object.keys(s.answers || {}).length ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-muted/40 p-2 text-xs">
                {JSON.stringify(s.answers, null, 2)}
              </pre>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {s.contactId ? <Link href={`/contacts/${s.contactId}`} className="text-primary hover:underline">Open contact</Link> : null}
              <Link href="/conversations" className="text-primary hover:underline">Open conversations</Link>
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}
