"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { useEffect, useState } from "react";

export function IntegrationReportsClient() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports/integrations")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j.data || null);
      })
      .catch(() => setError("Failed to load"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Integration analytics"
        description="Normalized dimensions across connected providers. Revenue attribution is never claimed without a real order or deal mapping."
      />
      <div className="mb-4 text-sm">
        <Link href="/reports" className="underline">
          ← Reports
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <CardTitle className="text-base">Contacts imported by provider</CardTitle>
            <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(data.contactsImportedByProvider, null, 2)}</pre>
          </Card>
          <Card className="p-4">
            <CardTitle className="text-base">Action success / failure</CardTitle>
            <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(data.integrationActionSuccessFailure, null, 2)}</pre>
          </Card>
          <Card className="p-4">
            <CardTitle className="text-base">Automation runs by provider</CardTitle>
            <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(data.automationRunsByProvider, null, 2)}</pre>
          </Card>
          <Card className="p-4">
            <CardTitle className="text-base">Sync failures by provider</CardTitle>
            <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(data.syncFailuresByProvider, null, 2)}</pre>
          </Card>
          <Card className="p-4">
            <CardTitle className="text-base">Follow-up completion</CardTitle>
            <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(data.followUpCompletion, null, 2)}</pre>
          </Card>
          <Card className="p-4">
            <CardTitle className="text-base">Synced objects</CardTitle>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Appointments: {String(data.appointmentsSynced)}</li>
              <li>Form submissions: {String(data.formSubmissionsSynced)}</li>
              <li>Orders: {String(data.ordersSynced)}</li>
            </ul>
          </Card>
          <Card className="p-4 lg:col-span-2">
            <CardTitle className="text-base">Prepared report dimensions</CardTitle>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {(data.reportsPrepared as string[]).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              {(data.revenueAttribution as { reason?: string })?.reason}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
