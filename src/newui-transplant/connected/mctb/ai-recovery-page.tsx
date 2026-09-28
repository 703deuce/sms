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
    "senderLabel" | "businessName" | "services" | "serviceArea" | "hours"
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
      const ctxRes = await fetch("/api/mctb/ai-recovery/context", { cache: "no-store" });
      if (!ctxRes.ok) return;
      const ctxJson = await ctxRes.json();
      const data = ctxJson.data ?? ctxJson;
      const bookingLinks = Array.isArray(data.booking?.links) ? data.booking.links : [];

      setMeta({
        senderLabel: data.messaging?.senderLabel,
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
    let resolvedLinkId = bookingLinkId;
    if (bookingLinkEnabled && !resolvedLinkId && bookingLinkUrl.trim()) {
      const createRes = await fetch("/api/mctb/booking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: bookingLinkLabel.trim() || "Booking",
          url: bookingLinkUrl.trim(),
          active: true,
          isDefault: true,
        }),
      });
      const created = await createRes.json();
      if (createRes.ok && created.data?.id) resolvedLinkId = created.data.id as string;
    }
    await fetch("/api/mctb/ai-recovery/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        fields,
        bookingLinkEnabled: bookingLinkEnabled && Boolean(resolvedLinkId || bookingLinkUrl.trim()),
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
      onEnabledChange: setEnabled,
      onFieldChange: (key, value) => setFields((f) => ({ ...f, [key]: value })),
      onBookingLinkEnabledChange: setBookingLinkEnabled,
      onBookingLinkUrlChange: setBookingLinkUrl,
      onBookingLinkLabelChange: setBookingLinkLabel,
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
