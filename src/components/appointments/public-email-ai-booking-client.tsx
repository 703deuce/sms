"use client";

import { useState } from "react";

export function PublicEmailAiBookingClient({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !message.trim()) {
      setError("Email and message are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/email-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not process your request");
      const text =
        json.data?.reply ||
        json.data?.message ||
        json.data?.body ||
        "Thanks — we received your scheduling request and will follow up by email.";
      setReply(String(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Email scheduling request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe when you&apos;d like to book. We&apos;ll reply with available options.
        </p>
      </header>

      {reply ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          <p className="font-semibold">Response</p>
          <p className="mt-2 whitespace-pre-wrap">{reply}</p>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground">Your email *</span>
          <input
            type="email"
            className="mt-1 h-9 w-full rounded-md border px-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Subject — optional</span>
          <input
            type="text"
            className="mt-1 h-9 w-full rounded-md border px-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">What would you like to book? *</span>
          <textarea
            rows={5}
            className="mt-1 w-full rounded-md border px-2 py-1.5"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Example: I need a training session next Tuesday afternoon."
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        onClick={() => void submit()}
      >
        {busy ? "Sending…" : "Send request"}
      </button>
    </main>
  );
}
