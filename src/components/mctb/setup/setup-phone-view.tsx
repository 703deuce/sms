"use client";

import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { MctbPhoneForwardingPanel } from "@/components/mctb/wizard/mctb-phone-forwarding-panel";
import { MCTB_CARRIER_GUIDES, type CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PhoneOption = {
  id: string;
  e164: string;
  friendlyName: string | null;
  messagingStatus?: { approved: boolean; label: string };
};

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

const DEFAULT_CARRIERS: CarrierForwardingGuide[] = MCTB_CARRIER_GUIDES;

export function MctbSetupPhoneView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneOption[]>([]);
  const [businessLineE164, setBusinessLineE164] = useState("");
  const [productionForwardE164, setProductionForwardE164] = useState<string | null>(null);
  const [messagingReady, setMessagingReady] = useState(false);
  const [carrier, setCarrier] = useState<MctbForwardingCarrier>("verizon");
  const [forwardRingSeconds, setForwardRingSeconds] = useState(15);
  const [paused, setPaused] = useState(false);
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      const d = json.data;
      setPhoneNumberId(d.runtime.phoneNumberId);
      setPhoneNumbers(d.phoneNumbers || []);
      setBusinessLineE164(d.businessLineE164 || d.adminTest?.businessLineE164 || "");
      setProductionForwardE164(d.productionForwardTargetE164 || null);
      setMessagingReady(Boolean(d.compliance?.messagingReady));
      setPaused(Boolean(d.schedule?.paused));
      setPauseKind(d.schedule?.pauseKind ?? null);
      setPauseUntil(d.schedule?.pauseUntil ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => phoneNumbers.find((n) => n.id === phoneNumberId) || null,
    [phoneNumbers, phoneNumberId],
  );

  const forwardTarget = selected?.e164 || productionForwardE164;
  const forwardDisplay = forwardTarget ? fmtPhone(forwardTarget) : "—";

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          businessLineE164: businessLineE164.trim() || null,
          activate: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mctb-page voice-theme">
        <div className="mctb-page-inner">
          <div className="voice-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Phone & Forwarding"
      description="Connect your public business line and forward unanswered calls to Transovo."
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      {paused ? (
        <MctbPausedNotice pauseKind={pauseKind} pauseUntil={pauseUntil} variant="banner" />
      ) : null}

      {!messagingReady ? (
        <div className="voice-card border-amber-200 bg-amber-50/60 p-4 text-[13px] text-amber-950">
          <p className="font-semibold">Messaging setup incomplete</p>
          <p className="mt-1">
            Complete sender verification before going live.{" "}
            <Link href="/compliance" className="font-semibold underline">Open Messaging Compliance</Link>
          </p>
        </div>
      ) : (
        <div className="voice-card border-emerald-200 bg-emerald-50/50 p-4 text-[13px] text-emerald-950">
          <p className="font-semibold">Messaging ready</p>
          <p className="mt-1">Your text-back sender can send recovery messages once forwarding is verified.</p>
        </div>
      )}

      <div className="voice-card space-y-3 p-4 sm:p-5">
        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-foreground">Text-back sender</span>
          <select
            className="flex h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm"
            value={phoneNumberId || ""}
            onChange={(e) => setPhoneNumberId(e.target.value || null)}
          >
            <option value="">Select a number…</option>
            {phoneNumbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.friendlyName ? `${n.friendlyName} · ` : ""}
                {fmtPhone(n.e164)}
                {n.messagingStatus ? ` — ${n.messagingStatus.label}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Link href={MCTB_ROUTES.numbers} className="text-[13px] font-semibold text-primary hover:underline">
          Manage numbers →
        </Link>
      </div>

      <div className="voice-card p-4 sm:p-6">
        <MctbPhoneForwardingPanel
          businessNumber={businessLineE164}
          onBusinessNumberChange={setBusinessLineE164}
          carrier={carrier}
          onCarrierChange={setCarrier}
          carriers={DEFAULT_CARRIERS}
          forwardDisplay={forwardDisplay}
          forwardE164={forwardTarget}
          forwardRingSeconds={forwardRingSeconds}
          onForwardRingSecondsChange={setForwardRingSeconds}
          verification={null}
          connectionStatus={forwardTarget && businessLineE164 ? "pending" : "unknown"}
        />
      </div>

      <p className="text-[13px] text-muted-foreground">
        Run guided verification in{" "}
        <Link href={MCTB_ROUTES.setupTest} className="font-semibold text-primary hover:underline">
          Test & diagnostics
        </Link>
        .
      </p>
    </MctbSetupSectionLayout>
  );
}
