"use client";

import { useCallback, useEffect, useState } from "react";
import { rep } from "@/components/reputation/rep-ui";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";

type Row = ReviewQrCampaign & { trackedUrl?: string };

export function AdminQrCampaignsClient() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/qr-campaigns?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRows(json.campaigns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pause(id: string) {
    const res = await fetch("/api/admin/qr-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause", campaignId: id }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Pause failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          className={rep.input + " max-w-md"}
          placeholder="Search name, short code, destination, org…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className={rep.btnSecondary} onClick={() => void load()}>
          Search
        </button>
      </div>
      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
      {loading ? <p className="text-sm text-[#667085]">Loading…</p> : null}
      <div className="overflow-x-auto rounded-xl border border-[#E6EAF0] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Org / Business</th>
              <th className="px-3 py-2">Short code</th>
              <th className="px-3 py-2">Scans</th>
              <th className="px-3 py-2">Bots</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Destination</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 font-medium text-[#101828]">{row.name}</td>
                <td className="px-3 py-2 text-[#667085]">
                  <div className="max-w-[160px] truncate">{row.organizationId ?? "anonymous"}</div>
                  <div className="max-w-[160px] truncate text-xs">{row.businessId ?? "—"}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.shortCode}</td>
                <td className="px-3 py-2 tabular-nums">{row.totalScans}</td>
                <td className="px-3 py-2 tabular-nums">{row.botScans}</td>
                <td className="px-3 py-2 capitalize">{row.status}</td>
                <td className="px-3 py-2">
                  <a
                    className="max-w-[220px] truncate text-[#137752] underline"
                    href={row.destinationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.destinationUrl}
                  </a>
                </td>
                <td className="px-3 py-2 text-right">
                  {row.status === "active" ? (
                    <button type="button" className={rep.btnSecondary} onClick={() => void pause(row.id)}>
                      Pause
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[#667085]">
                  No campaigns found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
