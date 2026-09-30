"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtCallPhone } from "@/lib/voice/calls/display";
import { fetchMctbSetup, saveMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";

export type MctbSetupApiData = {
  consentMode?: "press_1" | "existing_consent";
  businessLineE164?: string | null;
  productionForwardTargetE164?: string | null;
  runtime?: {
    phoneNumberId?: string | null;
    messageTemplate?: string;
    enabled?: boolean;
  };
  messaging?: {
    senderE164?: string | null;
    senderLabel?: string | null;
    canEditRecoveryOpener?: boolean;
  };
  prefills?: { press1Consent?: string };
};

export function useMctbSetupApi() {
  const [data, setData] = useState<MctbSetupApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetchMctbSetup({ force: true });
      setData(json as MctbSetupApiData);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async (patch: Record<string, unknown>) => {
    await saveMctbSetup(patch);
    await reload();
  }, [reload]);

  return { data, loading, reload, save };
}

export function formatSetupPhoneLine(e164?: string | null): string {
  if (!e164?.trim()) return "—";
  return fmtCallPhone(e164);
}
