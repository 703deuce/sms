"use client";

import { Loader2, Plus } from "lucide-react";
import { Button } from "./ui/Button";

const providerMeta = {
  google: {
    label: "Google Calendar",
    description:
      "Sync Google calendars to write new appointments, block busy times, and import existing events.",
    badge: "G",
    badgeBg: "#eef4ff",
    badgeColor: "#3538cd",
  },
  microsoft: {
    label: "Microsoft Outlook",
    description:
      "Sync Microsoft 365 / Outlook calendars to write appointments, block busy times, and import events.",
    badge: "M",
    badgeBg: "#f0f9ff",
    badgeColor: "#026aa2",
  },
} as const;

export function ConnectProviderCard({
  provider,
  configured,
  busy,
  onConnect,
}: {
  provider: "google" | "microsoft";
  configured: boolean;
  busy: boolean;
  onConnect: () => void;
}) {
  const meta = providerMeta[provider];
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-4">
      <span
        aria-hidden
        className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-[15px] font-bold"
        style={{ background: meta.badgeBg, color: meta.badgeColor }}
      >
        {meta.badge}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-[var(--foreground)]">{meta.label}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted-foreground)]">
          {configured ? meta.description : `${meta.label} OAuth isn't configured for this workspace yet.`}
        </p>
      </div>
      {configured ? (
        <Button variant="outline" size="sm" onClick={onConnect} disabled={busy}>
          {busy ? <Loader2 className="sb-spin h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          Connect
        </Button>
      ) : (
        <span className="sb-chip sb-chip-neutral">Not configured</span>
      )}
    </div>
  );
}
