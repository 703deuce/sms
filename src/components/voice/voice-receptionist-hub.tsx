"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useEffect, useState } from "react";

type SetupPayload = {
  agentId: string | null;
  status: string;
  state: {
    agentName?: string;
    solutionName?: string;
    capabilities?: string[];
    openingGreeting?: string;
  } | null;
};

/**
 * Transitional Receptionist destination (Pass 1).
 * Uses PageHeader + status rows only — final layout awaits approved page spec.
 */
export function VoiceReceptionistHub() {
  const [data, setData] = useState<SetupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/solutions/appointment-receptionist")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const state = data?.state;
  const published = (data?.status || "DRAFT") === "ACTIVE";

  return (
    <div>
      <PageHeader
        title="Receptionist"
        description="Summary of your AI receptionist. Full editing remains in setup until the permanent editor is approved."
        actions={
          <>
            <Button asChild size="sm" variant="primary">
              <Link href={MCTB_ROUTES.voiceAgent}>
                {data?.agentId ? "Continue setup" : "Start setup"}
              </Link>
            </Button>
            {data?.agentId ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`${MCTB_ROUTES.voiceAgent}?agentId=${data.agentId}`}>
                  Open setup editor
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading receptionist…</p>
      ) : error ? (
        <p className="text-sm text-destructive">Could not load receptionist status. Try again later.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <dl className="divide-y divide-border text-sm">
            <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <dt className="font-medium text-muted-foreground">Publish status</dt>
              <dd className="font-medium text-foreground">
                {published ? "Published" : "Draft — publish required for live changes"}
              </dd>
            </div>
            <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <dt className="font-medium text-muted-foreground">Receptionist name</dt>
              <dd className="font-medium text-foreground">
                {state?.agentName?.trim() || "Not configured"}
              </dd>
            </div>
            <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <dt className="font-medium text-muted-foreground">Greeting</dt>
              <dd className="max-w-xl text-foreground">
                {state?.openingGreeting?.trim() || "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <dt className="font-medium text-muted-foreground">Capabilities</dt>
              <dd className="text-foreground">
                {state?.capabilities?.length
                  ? state.capabilities.map((c) => c.replace(/_/g, " ")).join(", ")
                  : "None selected"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
