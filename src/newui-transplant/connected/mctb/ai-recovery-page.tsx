"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransplantMctbAiRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import type { MctbAiRecoveryWired } from "@/newui-transplant/mirror/routes/mctb/ai-recovery/page";
import {
  defaultSmsCollectFields,
  normalizeSmsCollectFields,
} from "@/lib/mctb/ai-recovery/collect-field-schema";
import { parseMctbAiRecoveryGoalType } from "@/lib/mctb/ai-recovery/recovery-goal";
import type { MctbAiRecoveryGoalType, MctbSmsCollectFieldDef } from "@/lib/mctb/lead-recovery/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export function NewUiMctbAiRecoveryPage() {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Pick<MctbAiRecoveryWired, "senderLabel" | "senderE164"> | null>(
    null,
  );
  const [enabled, setEnabled] = useState(false);
  const [smsCollectFields, setSmsCollectFields] = useState<MctbSmsCollectFieldDef[]>(
    defaultSmsCollectFields(),
  );
  const [allowDynamicCustomQuestions, setAllowDynamicCustomQuestions] = useState(true);
  const [recoveryGoalType, setRecoveryGoalType] = useState<MctbAiRecoveryGoalType>("FOLLOW_UP");
  const [customRecoveryGoal, setCustomRecoveryGoal] = useState("");
  const enabledRef = useRef(enabled);
  const smsFieldsRef = useRef(smsCollectFields);
  const allowDynamicRef = useRef(allowDynamicCustomQuestions);
  const goalRef = useRef(recoveryGoalType);
  const customGoalRef = useRef(customRecoveryGoal);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    smsFieldsRef.current = smsCollectFields;
  }, [smsCollectFields]);
  useEffect(() => {
    allowDynamicRef.current = allowDynamicCustomQuestions;
  }, [allowDynamicCustomQuestions]);
  useEffect(() => {
    goalRef.current = recoveryGoalType;
  }, [recoveryGoalType]);
  useEffect(() => {
    customGoalRef.current = customRecoveryGoal;
  }, [customRecoveryGoal]);
  const [bookingLinkEnabled, setBookingLinkEnabled] = useState(false);
  const [bookingLinkId, setBookingLinkId] = useState<string | null>(null);
  const [bookingLinkUrl, setBookingLinkUrl] = useState("");
  const [bookingLinkLabel, setBookingLinkLabel] = useState("");
  const [aboutBusiness, setAboutBusiness] = useState("");
  const aboutRef = useRef(aboutBusiness);
  useEffect(() => {
    aboutRef.current = aboutBusiness;
  }, [aboutBusiness]);
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
      });
      setEnabled(Boolean(data.recovery?.enabled));

      setSmsCollectFields(normalizeSmsCollectFields(data.recovery?.smsCollectFields));
      setAllowDynamicCustomQuestions(data.recovery?.allowDynamicCustomQuestions !== false);

      const goal =
        parseMctbAiRecoveryGoalType(data.recovery?.recoveryGoalType) ?? "FOLLOW_UP";
      setRecoveryGoalType(goal);
      setCustomRecoveryGoal(
        typeof data.recovery?.customRecoveryGoal === "string"
          ? data.recovery.customRecoveryGoal
          : "",
      );

      const linkId = (data.recovery?.bookingLinkId as string | null) ?? null;
      const selected = bookingLinks.find((l: { id: string; active?: boolean }) => l.id === linkId);
      const hasLink = Boolean(linkId && selected?.active !== false);
      setBookingLinkEnabled(hasLink);
      setBookingLinkId(linkId);
      setBookingLinkUrl(selected?.url ?? "");
      setBookingLinkLabel(selected?.label ?? "");
      setAboutBusiness(
        typeof data.business?.aboutBusiness === "string" ? data.business.aboutBusiness : "",
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
    const goalNow = goalRef.current;
    const bookingEnabledForSave =
      goalNow === "SCHEDULE" && bookingLinkEnabled && Boolean(resolvedLinkId && bookingLinkUrl.trim());
    const res = await fetch("/api/mctb/ai-recovery/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: enabledNow,
        smsCollectFields: smsFieldsRef.current,
        allowDynamicCustomQuestions: allowDynamicRef.current,
        recoveryGoalType: goalNow,
        customRecoveryGoal: customGoalRef.current,
        bookingLinkEnabled: bookingEnabledForSave,
        bookingLinkId: bookingEnabledForSave ? resolvedLinkId : null,
        aboutBusiness: aboutRef.current,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as { error?: string }).error || "Could not save AI Recovery");
    }
    const runtimeArmed = (json as { data?: { runtimeArmed?: boolean } }).data?.runtimeArmed;
    if (enabledNow && runtimeArmed === false) {
      throw new Error(
        "AI Recovery is on, but business knowledge is empty. Add business knowledge and save again.",
      );
    }

    await reload();
  }, [bookingLinkEnabled, bookingLinkId, bookingLinkUrl, reload]);

  const wired: MctbAiRecoveryWired | undefined = useMemo(() => {
    if (loading && !meta) return undefined;
    return {
      ...meta,
      enabled,
      smsCollectFields,
      onSmsCollectFieldsChange: setSmsCollectFields,
      allowDynamicCustomQuestions,
      onAllowDynamicCustomQuestionsChange: setAllowDynamicCustomQuestions,
      recoveryGoalType,
      onRecoveryGoalTypeChange: (value) => {
        goalRef.current = value;
        setRecoveryGoalType(value);
        if (value === "SCHEDULE" && bookingLinkUrl.trim()) {
          setBookingLinkEnabled(true);
        }
      },
      customRecoveryGoal,
      onCustomRecoveryGoalChange: (value) => {
        customGoalRef.current = value;
        setCustomRecoveryGoal(value);
      },
      bookingLinkEnabled,
      bookingLinkUrl,
      bookingLinkLabel,
      bookingLinkReadOnly: true,
      bookingLinkEditHref: `${MCTB_ROUTES.textBack}?section=booking`,
      aboutBusiness,
      onAboutBusinessChange: setAboutBusiness,
      onEnabledChange: (value) => {
        enabledRef.current = value;
        setEnabled(value);
      },
      onBookingLinkEnabledChange: setBookingLinkEnabled,
      onSave,
    };
  }, [
    loading,
    meta,
    enabled,
    smsCollectFields,
    allowDynamicCustomQuestions,
    recoveryGoalType,
    customRecoveryGoal,
    bookingLinkEnabled,
    bookingLinkUrl,
    bookingLinkLabel,
    aboutBusiness,
    onSave,
  ]);

  if (loading && !wired) {
    return <p className="p-6 text-sm text-muted-foreground">Loading AI Recovery…</p>;
  }

  if (loadError && !wired) {
    return (
      <p className="p-6 text-sm text-destructive" role="alert">
        {loadError}
      </p>
    );
  }

  return <TransplantMctbAiRecoveryPage wired={wired} />;
}
