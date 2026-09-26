"use client";

import { useCallback, useEffect, useState } from "react";
import { TransplantMctbAiRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import type { MctbAiRecoveryWired } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";

export function NewUiMctbAiRecoveryPage() {
  const [wired, setWired] = useState<MctbAiRecoveryWired | undefined>(undefined);

  const reload = useCallback(async () => {
    const res = await fetch("/api/mctb/ai-recovery/context", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const data = json.data ?? json;
    setWired({
      enabled: Boolean(data.recovery?.enabled),
      senderLabel: data.messaging?.senderLabel,
      businessName: data.business?.name,
      services: data.business?.services?.join(", "),
      serviceArea: data.business?.serviceArea,
      hours: data.business?.hours,
      onSave: async (patch) => {
        await fetch("/api/mctb/ai-recovery/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        await reload();
      },
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return <TransplantMctbAiRecoveryPage wired={wired} />;
}
