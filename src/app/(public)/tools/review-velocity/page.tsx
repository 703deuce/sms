"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useState } from "react";

export default function PublicReviewVelocityPage() {
  const [placeId, setPlaceId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/review-velocity/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: placeId.trim(),
          businessName: businessName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Check failed");
        return;
      }
      setResult(json);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Review Velocity checker</h1>
        <p className="mt-2 text-sm text-slate-600">
          See how fast your Google reviews are arriving compared to recent history. Free preview —
          no account required.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <label className="block text-sm font-medium text-slate-800">
          Google Place ID
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="ChIJ..."
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Business name (optional)
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Acme Dental"
          />
        </label>
        <Button type="button" disabled={loading || !placeId.trim()} onClick={runCheck}>
          {loading ? "Checking…" : "Check velocity"}
        </Button>
        {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}
      </Card>

      {result ? (
        <Card className="space-y-3 p-6 text-sm text-slate-800">
          <p className="font-medium">Results</p>
          <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs">
            {JSON.stringify(result.metrics ?? result, null, 2)}
          </pre>
          {result.velocityWarning ? (
            <p className="text-amber-700">{String(result.velocityWarning)}</p>
          ) : null}
        </Card>
      ) : null}

      <p className="text-sm text-slate-600">
        Want ongoing monitoring and review requests?{" "}
        <Link href="/signup" className="font-medium text-violet-700 underline">
          Start with Transovo Reviews
        </Link>
        .
      </p>
    </main>
  );
}
