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
          published: data.mode === "active" && op.publicationStatus === "active",
          versionLabel: op.publicationLabel || undefined,
          capabilities: op.capabilities || [],
          editHref: op.manageReceptionistHref || "/voice/receptionist/edit",
        });
      })
      .catch(() => setWired(undefined));
  }, []);

  return <TransplantVoiceReceptionistPage wired={wired} />;
}
