"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useState } from "react";

export default function ContactValidationPage() {
  const [data, setData] = useState<{
    total: number;
    valid: number;
    invalid: number;
    landline: number;
    duplicate: number;
    estimatedSavingsCents: number;
  } | null>(null);
  const [cleanup, setCleanup] = useState<{
    suppressed: number;
    invalidMarked: number;
    unsubscribedMarked: number;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  async function run() {
    setRunning(true);
    const res = await fetch("/api/contacts/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = await res.json();
    setData(json.data);
    setRunning(false);
  }

  async function runCleanup() {
    setCleaning(true);
    const res = await fetch("/api/contacts/cleanup", { method: "POST" });
    const json = await res.json();
    setCleanup(json.data);
    setCleaning(false);
    await run();
  }

  useEffect(() => {
    run();
  }, []);

  return (
    <div>
      <PageHeader
        title="List validation"
        description="Normalize numbers, flag landlines, dedupe, and estimate campaign savings before send."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={run} disabled={running}>
              {running ? "Running…" : "Re-run validation"}
            </Button>
            <Button onClick={runCleanup} disabled={cleaning}>
              {cleaning ? "Cleaning…" : "Run cleanup"}
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={String(data?.total ?? 0)} />
        <StatCard label="Valid mobile" value={String(data?.valid ?? 0)} />
        <StatCard label="Invalid" value={String(data?.invalid ?? 0)} />
        <StatCard label="Possible landline" value={String(data?.landline ?? 0)} />
      </div>
      {cleanup ? (
        <Card className="mb-6 p-5 text-sm text-muted-foreground">
          Cleanup: {cleanup.suppressed} suppressed, {cleanup.invalidMarked} invalid,{" "}
          {cleanup.unsubscribedMarked} unsubscribed (repeated failures).
        </Card>
      ) : null}
      <Card className="p-5 text-sm text-muted-foreground">
        Est. savings by excluding bad numbers: ${((data?.estimatedSavingsCents ?? 0) / 100).toFixed(2)}{" "}
        per campaign wave. Daily list cleanup runs automatically for INVALID contacts and repeated
        send failures.
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  );
}
