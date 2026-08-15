"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PremiumSearchResult } from "@/lib/premium-numbers/types";
import { useState } from "react";

const INDUSTRY_OPTIONS = [
  "",
  "roofing",
  "plumbing",
  "hvac",
  "lawn_care",
  "junk_removal",
  "moving",
  "legal",
  "dental",
  "auto",
];

export function PremiumNumberSearchClient() {
  const [areaCode, setAreaCode] = useState("703");
  const [industry, setIndustry] = useState("roofing");
  const [customKeywords, setCustomKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PremiumSearchResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function onSearch() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/dev/premium-number-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          areaCode,
          industry: industry || undefined,
          customKeywords: customKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          limit: 50,
        }),
      });
      const data = (await res.json()) as PremiumSearchResult | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : `HTTP ${res.status}`);
      }
      setResult(data as PremiumSearchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Vanity Number Hunter (dev)</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Read-only Telnyx inventory search + deterministic scoring. Does not purchase numbers.
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="areaCode">Area code</Label>
          <Input id="areaCode" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <select
            id="industry"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt || "— none —"}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="keywords">Custom keywords (comma-separated)</Label>
          <Input
            id="keywords"
            placeholder="roof, roofer"
            value={customKeywords}
            onChange={(e) => setCustomKeywords(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={onSearch} disabled={loading}>
        {loading ? "Searching Telnyx…" : "Search"}
      </Button>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 text-sm">
            <p>
              <strong>Status:</strong> {result.status}
            </p>
            {result.message && <p className="text-muted-foreground">{result.message}</p>}
            <p className="mt-2">
              Telnyx searches: {result.statistics.telnyxSearchesAttempted} attempted,{" "}
              {result.statistics.telnyxSearchesSucceeded} ok,{" "}
              {result.statistics.telnyxSearchesFailed} failed
            </p>
            <p>
              Unique candidates: {result.statistics.uniqueCandidates} · Highest:{" "}
              {result.statistics.highestScore} · Average: {result.statistics.averageScore}
            </p>
            <p className="mt-2 font-mono text-xs">
              Keywords:{" "}
              {result.keywords.map((k) => `${k.word}=${k.digits}`).join(", ") || "—"}
            </p>
          </div>

          <div className="space-y-3">
            {result.candidates.map((c, idx) => (
              <div key={c.phoneNumber} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-lg font-semibold">{idx + 1}. {c.formattedNumber}</span>
                    <span className="text-muted-foreground ml-2 text-sm">
                      {c.score}/100 · {c.tier}
                    </span>
                  </div>
                  {c.telnyxCost?.monthlyCost && (
                    <span className="text-muted-foreground text-xs">
                      ${c.telnyxCost.monthlyCost}/mo
                      {c.telnyxCost.upfrontCost ? ` · $${c.telnyxCost.upfrontCost} upfront` : ""}
                    </span>
                  )}
                </div>
                {c.matchedWords.length > 0 && (
                  <p className="mt-2 text-sm">
                    <strong>Words:</strong> {c.matchedWords.join(", ")}
                  </p>
                )}
                {c.matchedPatterns.length > 0 && (
                  <p className="text-sm">
                    <strong>Patterns:</strong> {c.matchedPatterns.join("; ")}
                  </p>
                )}
                <ul className="mt-2 space-y-0.5 text-sm">
                  {c.reasons.map((r) => (
                    <li key={`${r.label}-${r.points}`}>
                      {r.points >= 0 ? "+" : ""}{r.points} {r.label}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="text-muted-foreground mt-2 text-xs underline"
                  onClick={() =>
                    setExpanded(expanded === c.phoneNumber ? null : c.phoneNumber)
                  }
                >
                  {expanded === c.phoneNumber ? "Hide raw Telnyx" : "Show raw Telnyx"}
                </button>
                {expanded === c.phoneNumber && c.rawTelnyx && (
                  <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 text-xs">
                    {JSON.stringify(c.rawTelnyx, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
