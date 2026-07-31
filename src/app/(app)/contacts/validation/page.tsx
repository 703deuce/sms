"use client";

import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
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
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const res = await fetch("/api/contacts/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const json = await res.json();
    setData(json.data);
    setRunning(false);
  }

  useEffect(() => { run(); }, []);

  return (
    <div>
      <PageHeader
        title="List validation"
        description="Normalize numbers, flag landlines, dedupe, and estimate campaign savings before send."
        actions={<Button variant="outline" onClick={run} disabled={running}>{running ? "Running…" : "Re-run validation"}</Button>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={String(data?.total ?? 0)} />
        <StatCard label="Valid mobile" value={String(data?.valid ?? 0)} />
        <StatCard label="Invalid" value={String(data?.invalid ?? 0)} />
        <StatCard label="Possible landline" value={String(data?.landline ?? 0)} />
      </div>
      <Card className="p-5 text-sm text-muted-foreground">
        Est. savings by excluding bad numbers: ${((data?.estimatedSavingsCents ?? 0) / 100).toFixed(2)} per campaign wave.
        Carrier lookup API can be wired when Telnyx number lookup is enabled.
      </Card>
    </div>
  );
}
