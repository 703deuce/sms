"use client";

import { useEffect, useState } from "react";

type BlockedSender = { id: string; faxE164: string; reason?: string | null; blockedAt: string };

export function FaxBlockedSendersPanel() {
  const [senders, setSenders] = useState<BlockedSender[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/fax/blocked-senders");
    const json = await res.json();
    if (json.data) setSenders(json.data);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function addSender(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch("/api/fax/blocked-senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faxE164: newNumber }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json.error || "Could not block sender");
      return;
    }
    setNewNumber("");
    setStatus("Sender blocked.");
    await load();
  }

  async function unblock(faxE164: string) {
    const ok = window.confirm(`Unblock ${faxE164}?`);
    if (!ok) return;
    await fetch(`/api/fax/blocked-senders?faxE164=${encodeURIComponent(faxE164)}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <section className="mt-8 rounded-lg border p-6">
      <h2 className="font-semibold">Blocked senders</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Blocked inbound senders skip AI processing. Inbound pages may still count against your
        allowance if Telnyx delivers them before filtering.
      </p>
      <form onSubmit={addSender} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="+1 703 555 1212"
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
        />
        <button type="submit" className="rounded-md border px-4 py-2 text-sm font-medium">
          Block number
        </button>
      </form>
      {status ? <p className="mt-2 text-sm text-muted-foreground">{status}</p> : null}
      <ul className="mt-4 divide-y rounded-md border">
        {senders.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">No blocked senders.</li>
        ) : (
          senders.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{s.faxE164}</p>
                {s.reason ? <p className="text-muted-foreground">{s.reason}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => unblock(s.faxE164)}
                className="text-primary hover:underline"
              >
                Unblock
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
