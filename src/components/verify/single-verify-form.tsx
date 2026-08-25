"use client";

import { useState } from "react";

type VerifyResult = {
  normalizedE164: string | null;
  lineType: string;
  carrier: string | null;
  country: string | null;
  ported: string | null;
  lookupStatus: string;
  smsSuitability: string | null;
  creditsCharged: number;
  cacheHit: boolean;
};

export function SingleVerifyForm() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/verify/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
        <div>
          <label className="text-sm font-medium">Phone number</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="7035551212 or +17035551212"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify Number"}
        </button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="rounded-lg border p-6 text-sm">
          <h3 className="text-lg font-semibold">{result.normalizedE164 || phone}</h3>
          <dl className="mt-4 grid gap-2">
            <Row label="Valid format" value={result.lookupStatus === "success" ? "✓" : "—"} />
            <Row label="Line type" value={result.lineType} />
            <Row label="Carrier" value={result.carrier || "Unknown"} />
            <Row label="Country" value={result.country || "Unknown"} />
            <Row label="Ported" value={result.ported || "Unknown"} />
            <Row label="SMS suitability" value={result.smsSuitability || "Unknown"} />
            <Row label="Credits used" value={String(result.creditsCharged)} />
            {result.cacheHit ? <Row label="Source" value="Cached result" /> : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
