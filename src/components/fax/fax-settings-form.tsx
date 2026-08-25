"use client";

import { useState } from "react";

export function FaxSettingsForm({
  initial,
}: {
  initial: {
    notifyEmail: string;
    notifyOnInbound: boolean;
    notifyOnFailedOutbound: boolean;
    autoAnalyzeInbound: boolean;
  };
}) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/fax/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setStatus(res.ok ? "Settings saved." : "Save failed.");
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-4 rounded-lg border p-6">
      <div>
        <label className="text-sm font-medium">Notification email</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          type="email"
          value={form.notifyEmail}
          onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.notifyOnInbound}
          onChange={(e) => setForm({ ...form, notifyOnInbound: e.target.checked })}
        />
        Email me when I receive a fax
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.notifyOnFailedOutbound}
          onChange={(e) => setForm({ ...form, notifyOnFailedOutbound: e.target.checked })}
        />
        Email me when an outbound fax fails
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.autoAnalyzeInbound}
          onChange={(e) => setForm({ ...form, autoAnalyzeInbound: e.target.checked })}
        />
        Automatically analyze incoming faxes with AI
      </label>
      <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Save
      </button>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </form>
  );
}
