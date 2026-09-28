"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TransplantMctbAiRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import type { MctbAiRecoveryWired } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import {
  deriveSimplifiedFieldEnabled,
  type AiRecoverySimplifiedField,
} from "@/lib/mctb/ai-recovery/simplified-fields";
import type { LeadRecoveryCollectField, LeadRecoveryScenarioKey } from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";
import { MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI } from "@/lib/mctb/launch-flags";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

const DEFAULT_FIELDS: Record<AiRecoverySimplifiedField, boolean> = {
  NAME: true,
  REASON: true,
  ADDRESS: true,
  URGENCY: true,
  CALLBACK_TIME: false,
};

export function NewUiMctbAiRecoveryPage() {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Pick<
    MctbAiRecoveryWired,
    "senderLabel" | "senderE164" | "businessName" | "services" | "serviceArea" | "hours"
  > | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [bookingLinkEnabled, setBookingLinkEnabled] = useState(false);
  const [bookingLinkId, setBookingLinkId] = useState<string | null>(null);
  const [bookingLinkUrl, setBookingLinkUrl] = useState("");
  const [bookingLinkLabel, setBookingLinkLabel] = useState("");
  const [enabledScenarios, setEnabledScenarios] = useState<Partial<Record<LeadRecoveryScenarioKey, boolean>>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [ctxRes, setupRes] = await Promise.all([
        fetch("/api/mctb/ai-recovery/context", { cache: "no-store" }),
        fetch("/api/mctb/setup", { cache: "no-store" }).catch(() => null),
      ]);
      if (!ctxRes.ok) return;
      const ctxJson = await ctxRes.json();
      const data = ctxJson.data ?? ctxJson;
      const setupJson = setupRes?.ok ? await setupRes.json().catch(() => null) : null;
      const setupData = setupJson?.data ?? setupJson;
      const senderE164 =
        (setupData?.messaging as { senderE164?: string } | undefined)?.senderE164 ??
        (setupData?.runtime as { smsPhoneE164?: string } | undefined)?.smsPhoneE164 ??
        null;
      const bookingLinks = Array.isArray(data.booking?.links) ? data.booking.links : [];

      setMeta({
        senderLabel: data.messaging?.senderLabel,
        senderE164: senderE164 || null,
        businessName: data.business?.name,
        services: data.business?.services?.join(", "),
        serviceArea: data.business?.serviceArea,
        hours: data.business?.hours,
      });
      setEnabled(Boolean(data.recovery?.enabled));

      const rawCaps = data.recovery?.collectCapabilities;
      const caps = (Array.isArray(rawCaps) ? rawCaps : []) as LeadRecoveryCollectField[];
      const derived = deriveSimplifiedFieldEnabled(caps);
      setFields(Object.values(derived).some(Boolean) ? derived : DEFAULT_FIELDS);

      const linkId = (data.recovery?.bookingLinkId as string | null) ?? null;
      const selected = bookingLinks.find((l: { id: string; active?: boolean }) => l.id === linkId);
      const hasLink = Boolean(linkId && selected?.active !== false);
      setBookingLinkEnabled(hasLink);
      setBookingLinkId(linkId);
      setBookingLinkUrl(selected?.url ?? "");
      setBookingLinkLabel(selected?.label ?? "");
      const scenarios = (data.recovery?.enabledScenarios ?? {}) as Partial<
        Record<LeadRecoveryScenarioKey, boolean>
      >;
      setEnabledScenarios(scenarios);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = useCallback(async () => {
    const resolvedLinkId = bookingLinkId;
    await fetch("/api/mctb/ai-recovery/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        fields,
        bookingLinkEnabled: bookingLinkEnabled && Boolean(resolvedLinkId && bookingLinkUrl.trim()),
        bookingLinkId: bookingLinkEnabled ? resolvedLinkId : null,
      }),
    });
    if (enabled) {
      await fetch("/api/mctb/lead-recovery/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, enabledScenarios }),
      });
    }
    await reload();
  }, [
    bookingLinkEnabled,
    bookingLinkId,
    bookingLinkLabel,
    bookingLinkUrl,
    enabled,
    enabledScenarios,
    fields,
    reload,
  ]);

  const scenarioDefs = useMemo(
    () =>
      LEAD_RECOVERY_SCENARIO_DEFS.filter(
        (d) => !(MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI && d.key === "payments"),
      ),
    [],
  );

  const wired: MctbAiRecoveryWired | undefined = useMemo(() => {
    if (loading && !meta) return undefined;
    return {
      ...meta,
      enabled,
      fields,
      bookingLinkEnabled,
      bookingLinkUrl,
      bookingLinkLabel,
      bookingLinkReadOnly: true,
      bookingLinkEditHref: `${MCTB_ROUTES.textBack}?section=booking`,
      onEnabledChange: setEnabled,
      onFieldChange: (key, value) => setFields((f) => ({ ...f, [key]: value })),
      onBookingLinkEnabledChange: setBookingLinkEnabled,
      scenarios: scenarioDefs.map((def) => ({
        key: def.key,
        title: def.title,
        description: def.description,
        enabled: Boolean(enabledScenarios[def.key]),
        onChange: (value: boolean) =>
          setEnabledScenarios((prev) => ({ ...prev, [def.key]: value })),
      })),
      onSave,
    };
  }, [
    loading,
    meta,
    enabled,
    fields,
    bookingLinkEnabled,
    bookingLinkUrl,
    bookingLinkLabel,
    enabledScenarios,
    scenarioDefs,
    onSave,
  ]);

  if (loading && !wired) {
    return <p className="p-6 text-sm text-muted-foreground">Loading AI Recovery…</p>;
  }

  return <TransplantMctbAiRecoveryPage wired={wired} />;
}
