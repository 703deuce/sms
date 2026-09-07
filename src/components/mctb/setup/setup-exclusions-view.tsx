"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { useCallback, useEffect, useState } from "react";

type ExclusionRow = {
  id: string;
  phone: string;
  reason: string | null;
  source: string;
};

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

export function MctbSetupExclusionsView() {
  const [loading, setLoading] = useState(true);
  const [exclusions, setExclusions] = useState<ExclusionRow[]>([]);
  const [exclusionPhone, setExclusionPhone] = useState("");
  const [exclusionReason, setExclusionReason] = useState("Do not text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExclusions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/exclusions", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) setExclusions(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExclusions();
  }, [loadExclusions]);

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Exclusions"
      description="Numbers on this list will not receive automated missed-call recovery texts."
      showSave={false}
      error={error}
    >
      <div className="ref-card space-y-4 p-5">
        <h2 className="mctb-section-title">Do-not-text list</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-[180px] flex-1"
            placeholder="Phone number"
            value={exclusionPhone}
            onChange={(e) => setExclusionPhone(e.target.value)}
          />
          <Input
            className="min-w-[200px] flex-1"
            placeholder="Reason"
            value={exclusionReason}
            onChange={(e) => setExclusionReason(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy || !exclusionPhone.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await fetch("/api/mctb/exclusions", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ phone: exclusionPhone, reason: exclusionReason }),
                });
                if (!res.ok) throw new Error("Could not add number");
                setExclusionPhone("");
                await loadExclusions();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not add number");
              } finally {
                setBusy(false);
              }
            }}
          >
            Add number
          </Button>
        </div>
        {exclusions.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No exclusions yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border border-gray-100 text-[13px]">
            {exclusions.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-foreground">{fmtPhone(row.phone)}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {row.reason || "Excluded"}
                    {row.source === "personal_blocked" ? " · personal block" : ""}
                  </p>
                </div>
                {row.source === "mctb_exclusion" ? (
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-rose-600 hover:underline"
                    onClick={async () => {
                      await fetch(`/api/mctb/exclusions?id=${row.id}`, { method: "DELETE" });
                      await loadExclusions();
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </MctbSetupSectionLayout>
  );
}
