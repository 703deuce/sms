"use client";

import { useState } from "react";
import Link from "next/link";

type SendEstimate = {
  documentPages: number;
  billablePages: number;
  pagesRemaining: number;
  overagePages: number;
  overageCents: number;
  requiresConfirmation: boolean;
  message: string;
};

export function SendFaxForm({ fromNumber }: { fromNumber?: string | null }) {
  const [to, setTo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [estimate, setEstimate] = useState<SendEstimate | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedOverage, setConfirmedOverage] = useState(false);

  async function onFileChange(next: File | null) {
    setFile(next);
    setEstimate(null);
    setConfirmedOverage(false);
    if (!next) return;
    const form = new FormData();
    form.append("document", next);
    const res = await fetch("/api/fax/send/estimate", { method: "POST", body: form });
    const json = await res.json();
    if (res.ok && json.data) setEstimate(json.data);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus("Please choose a PDF document.");
      return;
    }
    if (estimate?.requiresConfirmation && !confirmedOverage) {
      setStatus("Please confirm the estimated overage charge before sending.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("toE164", to);
      form.append("recipientName", recipientName);
      form.append("document", file);
      const res = await fetch("/api/fax/send", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");
      setStatus("Fax queued for delivery.");
      setTo("");
      setRecipientName("");
      setFile(null);
      setEstimate(null);
      setConfirmedOverage(false);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-lg border p-6">
      <div>
        <label className="text-sm font-medium">From</label>
        <input
          className="mt-1 w-full rounded-md border bg-muted px-3 py-2 text-sm"
          value={fromNumber || "No fax number — choose one in Numbers"}
          readOnly
        />
      </div>
      <div>
        <label className="text-sm font-medium">To</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="+1 703 555 1212"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Recipient name (optional)</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Document (PDF)</label>
        <input
          className="mt-1 block w-full text-sm"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          required
        />
        {file ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        ) : null}
      </div>
      {estimate ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p>{estimate.message}</p>
          {estimate.requiresConfirmation ? (
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirmedOverage}
                onChange={(e) => setConfirmedOverage(e.target.checked)}
              />
              I understand and approve the estimated overage charge.
            </label>
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={loading || !fromNumber}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send Fax"}
      </button>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {!fromNumber ? (
        <p className="text-sm">
          <Link href="/fax/numbers" className="text-primary hover:underline">
            Choose your fax number
          </Link>{" "}
          before sending.
        </p>
      ) : null}
    </form>
  );
}
