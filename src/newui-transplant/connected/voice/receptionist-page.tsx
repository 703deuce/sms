"use client";

import { useEffect, useState } from "react";
import { TransplantVoiceReceptionistPage } from "@/newui-transplant/mirror/routes/voice/receptionist/page";
import type { VoiceReceptionistWired } from "@/newui-transplant/mirror/routes/voice/receptionist/page";

export function NewUiVoiceReceptionistPage() {
  const [wired, setWired] = useState<VoiceReceptionistWired | undefined>(undefined);

  useEffect(() => {
    fetch("/api/voice/overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? j;
        const op = data.operational;
        if (!op) {
          setWired(undefined);
          return;
        }
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
      .catch(() => setWired(undefined));
  }, []);

  return <TransplantVoiceReceptionistPage wired={wired} />;
}
