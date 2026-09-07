"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import { fmtRelativeTime } from "@/lib/smart-routing/display";
import type { NeedsAttentionItem } from "@/lib/platform/needs-attention-types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Member = { id: string; name: string };

export function NeedsAttentionView() {
  const [items, setItems] = useState<NeedsAttentionItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<"all" | "assigned_to_me">("all");
  const [loading, setLoading] = useState(true);
  const [bridgeCaller, setBridgeCaller] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/voice/needs-attention?filter=${filter}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok) {
        setItems(json.data?.items ?? []);
        setMembers(json.data?.members ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markDone(item: NeedsAttentionItem) {
    await fetch("/api/voice/needs-attention", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_done_all",
        events: item.events.map((e) => ({ kind: e.kind, id: e.id })),
      }),
    });
    await load();
  }

  async function claim(item: NeedsAttentionItem) {
    await fetch("/api/voice/needs-attention", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "claim",
        kind: item.primaryKind,
        id: item.primaryRefId,
      }),
    });
    await load();
  }

  async function assign(kind: string, id: string, assignedToUserId?: string) {
    if (kind !== "callback_request" && kind !== "voicemail") return;
    await fetch("/api/voice/needs-attention", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", kind, id, assignedToUserId }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Needs Attention</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One operational inbox for callbacks, voicemails, SMS replies, and missed-call follow-ups.
          Deduplicated by caller — not a CRM.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "primary" : "outline"}
          onClick={() => setFilter("all")}
        >
          All open
        </Button>
        <Button
          size="sm"
          variant={filter === "assigned_to_me" ? "primary" : "outline"}
          onClick={() => setFilter("assigned_to_me")}
        >
          Assigned to me
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Nothing needs attention right now.</Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#111827]">
                      {item.callerName || item.callerE164}
                      {item.repeatCallerCount && item.repeatCallerCount > 1 ? (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          Called {item.repeatCallerCount}× recently
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm font-medium text-[#374151]">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtRelativeTime(item.latestAt)}
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
                    </p>
                    {item.transcriptPreview ? (
                      <p className="mt-2 text-sm text-[#4b5563] line-clamp-2">
                        {item.transcriptPreview}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {bridgeCaller === item.callerE164 ? (
                      <BusinessCallBackButton
                        destinationE164={item.callerE164}
                        contextType={
                          item.primaryKind === "voicemail"
                            ? "voicemail"
                            : item.primaryKind === "callback_request"
                              ? "callback_request"
                              : "missed_call"
                        }
                        contextRefId={item.primaryRefId}
                        size="sm"
                      />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBridgeCaller(item.callerE164)}
                      >
                        Call Back as Business
                      </Button>
                    )}
                    {item.primaryKind === "mctb_reply" || item.primaryKind === "missed_call" ? (
                      <Link
                        href={MCTB_ROUTES.missedCallDetail(item.primaryRefId)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Open missed call
                      </Link>
                    ) : item.primaryKind === "voicemail" ? (
                      <Link
                        href={MCTB_ROUTES.voicemail}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Open voicemail
                      </Link>
                    ) : null}
                    <Button
                      size="sm"
                      variant="primary"
                      className="text-xs"
                      onClick={() => void claim(item)}
                    >
                      I&apos;ll handle this
                    </Button>
                    {(item.primaryKind === "callback_request" || item.primaryKind === "voicemail") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() =>
                          void assign(item.primaryKind, item.primaryRefId)
                        }
                      >
                        Assign to me
                      </Button>
                    ) : null}
                    {(item.primaryKind === "callback_request" || item.primaryKind === "voicemail") &&
                    members.length > 1 ? (
                      <select
                        className="h-8 rounded border px-2 text-xs"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) void assign(item.primaryKind, item.primaryRefId, v);
                        }}
                      >
                        <option value="">Assign to…</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-emerald-700"
                      onClick={() => void markDone(item)}
                    >
                      Mark done
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
