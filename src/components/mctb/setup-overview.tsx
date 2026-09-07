"use client";

import { Button } from "@/components/ui/button";
import {
  MCTB_CONSENT_MODE_LABELS,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./kimi-ui/reference.css";

type SetupPayload = {
  runtime: {
    enabled: boolean;
    phoneNumberId: string | null;
    messageTemplate: string;
    sendAfterNoAnswer: boolean;
    sendAfterBusy: boolean;
    sendAfterRejected: boolean;
    sendAfterTimeout: boolean;
    cooldownMinutes: number;
  };
  consentMode: MctbConsentMode;
  compliance: { messagingReady: boolean; requiredActions: string[] };
  businessLineE164?: string | null;
  schedule?: { paused: boolean; pauseUntil?: string | null };
  solution: { status: string } | null;
};

type SetupRow = {
  id: string;
  title: string;
  summary: string;
  href: string;
  status: "ready" | "attention" | "unknown";
};

function RowStatus({ status }: { status: SetupRow["status"] }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Ready
      </span>
    );
  }
  if (status === "attention") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-800">
        <CircleAlert className="h-3.5 w-3.5" aria-hidden />
        Needs attention
      </span>
    );
  }
  return <span className="text-[12px] text-muted-foreground">Not configured</span>;
}

export function MctbSetupOverview() {
  const [data, setData] = useState<SetupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error("load failed");
      setData(json.data as SetupPayload);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo((): SetupRow[] => {
    if (!data) return [];
    const r = data.runtime;
    const triggersOn =
      r.sendAfterNoAnswer ||
      r.sendAfterBusy ||
      r.sendAfterRejected ||
      r.sendAfterTimeout;
    const paused = data.schedule?.paused ?? !r.enabled;
    const hasLine = Boolean(data.businessLineE164?.trim());
    const hasSender = Boolean(r.phoneNumberId);
    const messagingReady = data.compliance.messagingReady;

    return [
      {
        id: "phone",
        title: "Phone & Forwarding",
        summary: hasLine
          ? `Business line ${data.businessLineE164}`
          : "Connect your business line and verify forwarding",
        href: MCTB_ROUTES.setupPhone,
        status: hasLine && hasSender ? "ready" : "attention",
      },
      {
        id: "rules",
        title: "Missed-call rules",
        summary: triggersOn
          ? "At least one missed-call trigger is enabled"
          : "Choose which call outcomes create missed-call events",
        href: MCTB_ROUTES.setupMissedCallRules,
        status: triggersOn ? "ready" : "attention",
      },
      {
        id: "text-back",
        title: "Text Back",
        summary: r.messageTemplate.trim()
          ? "Recovery message configured"
          : "Set your recovery message",
        href: MCTB_ROUTES.setupTextBack,
        status: r.messageTemplate.trim() ? "ready" : "attention",
      },
      {
        id: "consent",
        title: "Consent",
        summary: MCTB_CONSENT_MODE_LABELS[data.consentMode]?.title || "Choose how permission is established",
        href: MCTB_ROUTES.setupConsent,
        status: data.consentMode ? "ready" : "attention",
      },
      {
        id: "recovery",
        title: "Recovery controls",
        summary: paused
          ? "Recovery is paused"
          : `Active · ${r.cooldownMinutes} min repeat-caller cooldown`,
        href: MCTB_ROUTES.setupRecovery,
        status: paused ? "attention" : "ready",
      },
      {
        id: "voicemail",
        title: "Voicemail",
        summary: "Greeting and voicemail behavior",
        href: MCTB_ROUTES.setupVoicemail,
        status: "ready",
      },
      {
        id: "exclusions",
        title: "Exclusions",
        summary: "Do-not-text numbers",
        href: MCTB_ROUTES.setupExclusions,
        status: "ready",
      },
      {
        id: "test",
        title: "Test & diagnostics",
        summary: messagingReady
          ? "Run an end-to-end test before going live"
          : `Messaging blocked: ${data.compliance.requiredActions[0] || "complete sender registration"}`,
        href: MCTB_ROUTES.setupTest,
        status: messagingReady ? "ready" : "attention",
      },
    ];
  }, [data]);

  const setupIncomplete = rows.some((row) => row.status === "attention");

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner max-w-3xl">
          <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading setup">
            <div className="h-8 w-40 rounded bg-muted" />
            <div className="ref-card h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner max-w-3xl">
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Setup</h1>
          <div className="ref-card mt-6 p-6">
            <p className="text-sm font-medium">Setup couldn&apos;t be loaded.</p>
            <Button type="button" size="sm" className="mt-4" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Setup</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Configure forwarding, consent, recovery messages, and operational controls.
            </p>
          </div>
          {setupIncomplete ? (
            <Link
              href={MCTB_ROUTES.setupStart}
              className="inline-flex h-10 shrink-0 items-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Continue setup
            </Link>
          ) : (
            <Link
              href={MCTB_ROUTES.setupTest}
              className="inline-flex h-10 shrink-0 items-center rounded-xl border border-gray-200 bg-white px-4 text-[13px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Run test
            </Link>
          )}
        </div>

        {setupIncomplete ? (
          <div className="ref-card mt-6 border-amber-200 bg-amber-50/60 p-4" role="status">
            <p className="text-sm font-semibold text-amber-950">Setup is not complete</p>
            <p className="mt-1 text-[13px] text-amber-900">
              Finish the sections marked below so missed calls can be recovered reliably.
            </p>
          </div>
        ) : (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
            <span>
              <span className="font-medium text-foreground">Configured</span> — review any section
              below to make changes.
            </span>
          </p>
        )}

        <div className="ref-card mt-4 overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{row.title}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{row.summary}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <RowStatus status={row.status} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-[13px] text-muted-foreground">
          <Link href={MCTB_ROUTES.complianceConsent} className="font-semibold text-primary hover:underline">
            View consent history
          </Link>
          {" · "}
          <Link href={MCTB_ROUTES.numbers} className="font-semibold text-primary hover:underline">
            Manage numbers
          </Link>
        </p>
      </div>
    </div>
  );
}
