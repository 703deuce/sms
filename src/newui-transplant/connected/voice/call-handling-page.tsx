"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TransplantVoiceCallHandlingPage } from "@/newui-transplant/mirror/routes/voice/call-handling/page";
import {
  buildVoiceCallHandlingWired,
  type RecentTransferRow,
  type VoiceCallHandlingWired,
} from "@/lib/newui-transplant/adapters/voice-call-handling";
import { useAppointmentReceptionistWizard } from "@/lib/newui-transplant/hooks/use-appointment-receptionist";
import { addTransferDestination } from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "@/lib/voice-receptionist-wizard/operating-maturity/defaults";
import { OpusCallRoutingIngressPanel } from "@/newui-transplant/components/voice/call-routing-ingress-panel";

export function NewUiVoiceCallHandlingPage() {
  const { state, patch, loading, saveDraft } = useAppointmentReceptionistWizard();
  const [recent, setRecent] = useState<RecentTransferRow[]>([]);

  useEffect(() => {
    fetch("/api/voice/call-handling/recent-transfers?limit=10", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRecent((j.data ?? []) as RecentTransferRow[]))
      .catch(() => setRecent([]));
  }, []);

  const onSwitchChange = useCallback(
    (key: keyof VoiceCallHandlingWired["switches"], value: boolean) => {
      const maturity = state.operatingMaturity ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;
      const whenClosed = { ...maturity.afterHoursBehavior.whenClosed };
      if (key === "ringTeamFirst") whenClosed.allowOfficeTransfer = value;
      if (key === "aiAfterHours") whenClosed.allowOnCallEscalation = value;
      if (key === "emergenciesOnly") whenClosed.allowNormalTransferDestinations = !value;
      if (key === "whisper") patch({ warmTransfer: value });
      if (key === "recordCalls") patch({ callRecording: value });
      if (key === "declineSolicitors") patch({ salesSolicitationEnabled: value });
      if (key === "blockSpam") patch({ spamLikelyPolicy: value ? "BLOCK" : null });
      if (key === "textSummary") patch({ afterHoursNotificationEvents: value });
      if (key === "holidaySchedule") {
        const schedule = maturity.businessSchedule ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule;
        patch({
          operatingMaturity: {
            ...maturity,
            businessSchedule: {
              ...schedule,
              holidays: value ? schedule.holidays : [],
            },
          },
        });
      }
      if (key === "ringTeamFirst" || key === "aiAfterHours" || key === "emergenciesOnly") {
        patch({
          operatingMaturity: {
            ...maturity,
            afterHoursBehavior: {
              ...maturity.afterHoursBehavior,
              whenClosed,
            },
          },
        });
      }
    },
    [patch, state.operatingMaturity],
  );

  const onAddTransferTarget = useCallback(() => {
    patch(addTransferDestination(state));
  }, [patch, state]);

  const wired = useMemo(() => {
    if (loading) return undefined;
    const base = buildVoiceCallHandlingWired(state, recent);
    return {
      ...base,
      onSwitchChange,
      onAddTransferTarget,
      onSave: async () => {
        await saveDraft("call-handling");
      },
    };
  }, [loading, state, recent, onSwitchChange, onAddTransferTarget, saveDraft]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading call handling…</p>;
  }

  return (
    <>
      <TransplantVoiceCallHandlingPage wired={wired} />
      <OpusCallRoutingIngressPanel />
    </>
  );
}
