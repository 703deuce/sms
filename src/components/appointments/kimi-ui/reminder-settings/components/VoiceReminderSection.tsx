"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import type { VoiceReminderTemplate } from "@/lib/appointment-voice-reminders/types";

type VoiceData = {
  enabled?: boolean;
  defaultTemplateId?: string;
  templates: VoiceReminderTemplate[];
  callerId?: {
    verification: { status: string; publicBusinessE164: string | null };
    outboundCallerId: string | null;
  };
};

export default function VoiceReminderSection({
  selectedTemplateId,
  onSelectTemplate,
}: {
  selectedTemplateId?: string;
  onSelectTemplate?: (id: string) => void;
}) {
  const [data, setData] = useState<VoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments/voice-reminders");
      const json = await res.json();
      if (res.ok) setData(json.data as VoiceData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = data?.templates.find((t) => t.id === selectedTemplateId) || data?.templates[0];

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#5925dc]" />
            <h2 className="text-[15px] font-semibold text-foreground">Voice reminder channel</h2>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Configure call scripts, keypad actions, and caller ID for voice reminder steps.
          </p>
        </div>
        <Link href="/appointments/voice-reminders" className="text-[12.5px] font-medium text-[#4f46e5] hover:underline">
          Advanced voice settings
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-[12.5px] text-muted-foreground">Loading voice templates…</p>
      ) : !data?.templates.length ? (
        <p className="mt-4 text-[12.5px] text-muted-foreground">
          No voice templates yet. Create one in advanced voice settings.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-[12px] font-medium text-foreground">Default voice template</label>
            <select
              value={selected?.id || ""}
              onChange={(e) => onSelectTemplate?.(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px]"
            >
              {data.templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selected ? (
              <p className="mt-2 text-[11px] text-muted-foreground line-clamp-3">{selected.humanScript}</p>
            ) : null}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[12px]">
            <p className="font-medium text-foreground">Caller ID</p>
            <p className="mt-1 text-muted-foreground">
              {data.callerId?.outboundCallerId || data.callerId?.verification.publicBusinessE164 || "Not configured"}
              {data.callerId?.verification.status === "verified" ? " · Verified" : ""}
            </p>
            <p className="mt-3 font-medium text-foreground">Retry behavior</p>
            <p className="mt-1 text-muted-foreground">
              If a reminder call cannot connect, Transovo may retry automatically according to your voice reminder settings.
            </p>
            {selected?.keypadOptions?.length ? (
              <>
                <p className="mt-3 font-medium text-foreground">Customer actions during call</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {selected.keypadOptions
                    .filter((o) => o.action !== "none")
                    .map((o) => (
                      <li key={o.digit}>Press {o.digit} — {o.label || o.action}</li>
                    ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
