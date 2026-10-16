"use client";

import { useEffect, useState } from "react";
import { TransplantVoiceReceptionistPage } from "@/newui-transplant/mirror/routes/voice/receptionist/page";
import type { VoiceReceptionistWired } from "@/newui-transplant/mirror/routes/voice/receptionist/page";

export function NewUiVoiceReceptionistPage() {
  const [wired, setWired] = useState<VoiceReceptionistWired | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch("/api/voice/overview", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load receptionist overview");
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        const data = j.data ?? j;
        if (data.mode === "first_run" || !data.operational) {
          setWired({
            editHref: "/voice/receptionist/edit",
            published: false,
            agentName: "AI Receptionist",
            setupProblems: ["Finish setup to publish your receptionist."],
          });
          return;
        }
        const op = data.operational;
        setWired({
          agentId: op.agentId || undefined,
          agentInitial: (op.receptionistName || "R").slice(0, 1),
          agentName: op.receptionistName || "Receptionist",
          voiceLabel: op.voiceLabel || "Voice profile",
          greeting: op.openingGreeting || undefined,
          assignedPhoneE164: op.assignedPhoneE164 || undefined,
          answerWhenLabel: op.answerWhenLabel || undefined,
          businessHoursLabel: op.businessHours?.label || undefined,
          calendarLabel: op.calendar?.label || undefined,
          transferSummary: op.transferSummary || undefined,
          callbackSummary: op.callbackSummary || undefined,
          livekitStatus: op.livekitStatus || undefined,
          setupProblems: op.setupProblems || [],
          published: data.mode === "active" && op.liveSyncStatus === "live",
          versionLabel: op.liveSyncLabel || op.publicationLabel || undefined,
          liveSyncStatus: op.liveSyncStatus,
          liveSyncLabel: op.liveSyncLabel,
          capabilities: op.capabilities || [],
          editHref: op.manageReceptionistHref || "/voice/receptionist/edit",
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Load failed");
          setWired(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading receptionist…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm">
        <p className="text-destructive">{loadError}</p>
        <button
          type="button"
          className="text-primary underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return <TransplantVoiceReceptionistPage wired={wired} />;
}
