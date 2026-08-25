"use client";

import { SrOutlineButton, SrPrimaryButton } from "@/components/smart-routing/shared";
import { useCallback, useEffect, useState } from "react";

type LinkRow = {
  id: string;
  label: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  authorizedCallerName?: string;
};

export function EmployeeLinksPanel({
  authorizedCallers,
}: {
  authorizedCallers: Array<{ id: string; name: string }>;
}) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [callerId, setCallerId] = useState(authorizedCallers[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/smart-routing/employee-links", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setLinks(json.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLink() {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-routing/employee-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authorizedCallerId: callerId, label }),
      });
      const json = await res.json();
      if (res.ok) {
        setLastUrl(json.data?.url ?? null);
        setLabel("");
        await load();
      }
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/smart-routing/employee-links?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#111827]">Employee links</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Passwordless Business Calls page for team members without dashboard access. Links expire
          and can be revoked.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-lg border px-2 py-1.5 text-sm"
          value={callerId}
          onChange={(e) => setCallerId(e.target.value)}
        >
          {authorizedCallers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          className="rounded-lg border px-2 py-1.5 text-sm"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <SrPrimaryButton type="button" disabled={loading || !callerId} onClick={() => void createLink()}>
          Create link
        </SrPrimaryButton>
      </div>
      {lastUrl ? (
        <div className="rounded-lg bg-[#eef2ff] p-3 text-xs">
          <p className="font-semibold">New link (copy now — shown once):</p>
          <p className="mt-1 break-all font-mono">{lastUrl}</p>
        </div>
      ) : null}
      {links.length > 0 ? (
        <ul className="divide-y rounded-lg border text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span>
                {l.authorizedCallerName ?? "Employee"}
                {l.label ? ` · ${l.label}` : ""}
                <span className="text-muted-foreground">
                  {" "}
                  — expires {new Date(l.expiresAt).toLocaleDateString()}
                </span>
              </span>
              <SrOutlineButton type="button" onClick={() => void revoke(l.id)} className="text-xs">
                Revoke
              </SrOutlineButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
