"use client";

import { useState } from "react";

type Candidate = { e164: string; nationalNumber: string };

export function FaxNumberSetup() {
  const [areaCode, setAreaCode] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/fax/numbers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setCandidates(json.data || []);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function order(e164: string) {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/fax/numbers/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ e164 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Order failed");
      setStatus(`Fax number ${e164} is being activated.`);
      window.location.reload();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Order failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-6 space-y-4 max-w-xl">
      <h2 className="font-semibold">Choose a fax number</h2>
      <p className="text-sm text-muted-foreground">
        Your Transovo fax number is a real business phone number assigned to your account. You may
        request to port it to another provider later, subject to normal carrier requirements.
      </p>
      <div className="flex gap-2">
        <input
          className="w-24 rounded-md border px-3 py-2 text-sm"
          placeholder="703"
          maxLength={3}
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
        />
        <button
          type="button"
          onClick={search}
          disabled={loading || areaCode.length !== 3}
          className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Search
        </button>
      </div>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li key={c.e164} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{c.nationalNumber || c.e164}</span>
            <button
              type="button"
              onClick={() => order(c.e164)}
              disabled={loading}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              Select
            </button>
          </li>
        ))}
      </ul>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
