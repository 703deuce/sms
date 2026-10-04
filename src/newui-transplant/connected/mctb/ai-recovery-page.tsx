"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransplantMctbAiRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import type { MctbAiRecoveryWired } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import {
  defaultSmsCollectFields,
  normalizeSmsCollectFields,
} from "@/lib/mctb/ai-recovery/collect-field-schema";
import type { LeadRecoveryScenarioKey, MctbSmsCollectFieldDef } from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";
import { MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI } from "@/lib/mctb/launch-flags";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export function NewUiMctbAiRecoveryPage() {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Pick<
    MctbAiRecoveryWired,
    "senderLabel" | "senderE164" | "businessName" | "services" | "serviceArea" | "hours"
  > | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [smsCollectFields, setSmsCollectFields] = useState<MctbSmsCollectFieldDef[]>(
    defaultSmsCollectFields(),
  );
  const [allowDynamicCustomQuestions, setAllowDynamicCustomQuestions] = useState(true);
  const enabledRef = useRef(enabled);
  const smsFieldsRef = useRef(smsCollectFields);
  const allowDynamicRef = useRef(allowDynamicCustomQuestions);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    smsFieldsRef.current = smsCollectFields;
  }, [smsCollectFields]);
  useEffect(() => {
    allowDynamicRef.current = allowDynamicCustomQuestions;
  }, [allowDynamicCustomQuestions]);
  const [bookingLinkEnabled, setBookingLinkEnabled] = useState(false);
  const [bookingLinkId, setBookingLinkId] = useState<string | null>(null);
  const [bookingLinkUrl, setBookingLinkUrl] = useState("");
  const [bookingLinkLabel, setBookingLinkLabel] = useState("");
  const [enabledScenarios, setEnabledScenarios] = useState<Partial<Record<LeadRecoveryScenarioKey, boolean>>>({});
  const [aboutBusiness, setAboutBusiness] = useState("");
  const [emergencyCriteria, setEmergencyCriteria] = useState("");
  const aboutRef = useRef(aboutBusiness);
  const emergencyRef = useRef(emergencyCriteria);
  const scenariosRef = useRef(enabledScenarios);
  useEffect(() => {
    aboutRef.current = aboutBusiness;
  }, [aboutBusiness]);
  useEffect(() => {
    emergencyRef.current = emergencyCriteria;
  }, [emergencyCriteria]);
  useEffect(() => {
    scenariosRef.current = enabledScenarios;
  }, [enabledScenarios]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ctxRes, setupRes] = await Promise.all([
        fetch("/api/mctb/ai-recovery/context", { cache: "no-store" }),
        fetch("/api/mctb/setup", { cache: "no-store" }).catch(() => null),
      ]);
      const ctxJson = await ctxRes.json().catch(() => ({}));
      if (!ctxRes.ok) {
        throw new Error((ctxJson as { error?: string }).error || "Could not load AI Recovery");
      }
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

      setSmsCollectFields(
        normalizeSmsCollectFields(data.recovery?.smsCollectFields),
      );
      setAllowDynamicCustomQuestions(
        data.recovery?.allowDynamicCustomQuestions !== false,
      );

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
      setAboutBusiness(
        typeof data.business?.aboutBusiness === "string" ? data.business.aboutBusiness : "",
      );
      setEmergencyCriteria(
        typeof data.business?.emergencyCriteria === "string"
          ? data.business.emergencyCriteria
          : "",
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load AI Recovery");
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = useCallback(async () => {
    const enabledNow = enabledRef.current;
    const resolvedLinkId = bookingLinkId;
    const settingsRes = await fetch("/api/mctb/ai-recovery/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: enabledNow,
        smsCollectFields: smsFieldsRef.current,
        allowDynamicCustomQuestions: allowDynamicRef.current,
        bookingLinkEnabled: bookingLinkEnabled && Boolean(resolvedLinkId && bookingLinkUrl.trim()),
        bookingLinkId: bookingLinkEnabled ? resolvedLinkId : null,
      }),
    });
    const settingsJson = await settingsRes.json().catch(() => ({}));
    if (!settingsRes.ok) {
      throw new Error(
        (settingsJson as { error?: string }).error || "Could not save AI Recovery settings",
      );
    }
    const scenariosNow = scenariosRef.current;
    const emergenciesOn = Boolean(scenariosNow.emergencies);
    const knowledgeRes = await fetch("/api/mctb/ai-recovery/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aboutBusiness: aboutRef.current,
        emergencyCriteria: emergencyRef.current,
        emergencyDetectionEnabled: emergenciesOn,
      }),
    });
    const knowledgeJson = await knowledgeRes.json().catch(() => ({}));
    if (!knowledgeRes.ok) {
      throw new Error(
        (knowledgeJson as { error?: string }).error || "Could not save business knowledge",
      );
    }

    if (enabledNow) {
      const lrRes = await fetch("/api/mctb/lead-recovery/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, enabledScenarios: scenariosNow }),
      });
      const lrJson = await lrRes.json().catch(() => ({}));
      if (!lrRes.ok) {
        throw new Error(
          (lrJson as { error?: string }).error || "Could not save lead recovery scenarios",
        );
      }
    }
    await reload();
  }, [
    bookingLinkEnabled,
    bookingLinkId,
    bookingLinkLabel,
    bookingLinkUrl,
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
      smsCollectFields,
      onSmsCollectFieldsChange: setSmsCollectFields,
      allowDynamicCustomQuestions,
      onAllowDynamicCustomQuestionsChange: setAllowDynamicCustomQuestions,
      bookingLinkEnabled,
      bookingLinkUrl,
      bookingLinkLabel,
      bookingLinkReadOnly: true,
      bookingLinkEditHref: `${MCTB_ROUTES.textBack}?section=booking`,
      aboutBusiness,
      onAboutBusinessChange: setAboutBusiness,
      emergencyCriteria,
      onEmergencyCriteriaChange: setEmergencyCriteria,
      emergenciesScenarioEnabled: Boolean(enabledScenarios.emergencies),
      onEnabledChange: (value) => {
        enabledRef.current = value;
        setEnabled(value);
      },
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
    smsCollectFields,
    allowDynamicCustomQuestions,
    bookingLinkEnabled,
    bookingLinkUrl,
    bookingLinkLabel,
    enabledScenarios,
    aboutBusiness,
    emergencyCriteria,
    scenarioDefs,
    onSave,
  ]);

  if (loading && !wired) {
    return <p className="p-6 text-sm text-muted-foreground">Loading AI Recovery…</p>;
  }

  if (loadError && !wired) {
    return <p className="p-6 text-sm text-destructive" role="alert">{loadError}</p>;
  }

  return <TransplantMctbAiRecoveryPage wired={wired} />;
}
