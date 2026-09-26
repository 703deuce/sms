"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TransplantMctbAiRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import type { MctbAiRecoveryWired } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import {
  deriveSimplifiedFieldEnabled,
  type AiRecoverySimplifiedField,
} from "@/lib/mctb/ai-recovery/simplified-fields";
import type { LeadRecoveryCollectField } from "@/lib/mctb/lead-recovery/types";

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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [ctxRes, cfgRes] = await Promise.all([
        fetch("/api/mctb/ai-recovery/context", { cache: "no-store" }),
        fetch("/api/mctb/lead-recovery/config", { cache: "no-store" }),
      ]);
      if (!ctxRes.ok || !cfgRes.ok) return;
      const ctxJson = await ctxRes.json();
      const cfgJson = await cfgRes.json();
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

      const rawCaps = cfgJson.data?.config?.collectCapabilities;
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
    await reload();
  }, [
    bookingLinkEnabled,
    bookingLinkId,
    bookingLinkLabel,
    bookingLinkUrl,
    enabled,
    fields,
    reload,
  ]);

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
    onSave,
  ]);

  if (loading && !wired) {
    return <p className="p-6 text-sm text-muted-foreground">Loading AI Recovery…</p>;
  }

  return <TransplantMctbAiRecoveryPage wired={wired} />;
}
