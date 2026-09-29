"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { saveMctbSetup, fetchMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import {
  useMctbNotificationsWiring,
  useMctbRecoveryWiring,
  useMctbVoicemailWiring,
} from "@/newui-transplant/connected/mctb/setup-wiring-hooks";
import { OPUS_CARD, OPUS_INSET_LIST } from "@/newui-transplant/components/app/opus-surfaces";
import { Panel, Pill, SettingRow } from "@/newui-transplant/components/app/kit";
import { SimpleSelect } from "@/newui-transplant/components/app/simple-select";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import type { MctbHandoffConfigDto, MctbNotificationRecipientDto } from "@/lib/mctb/handoff/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbOnboardingController } from "@/newui-transplant/connected/mctb/mctb-onboarding-opus-view";
import { useMctbWizardFooter } from "@/newui-transplant/connected/mctb/mctb-onboarding-wizard-shell";

function delayLabelFromSeconds(sec: number): string {
  if (sec <= 0) return "Immediately";
  if (sec === 30) return "30 seconds";
  if (sec === 60) return "1 minute";
  if (sec === 300) return "5 minutes";
  return `${sec} seconds`;
}

function secondsFromDelayLabel(label: string): number {
  if (label === "Immediately") return 0;
  if (label === "30 seconds") return 30;
  if (label === "1 minute") return 60;
  if (label === "5 minutes") return 300;
  return 30;
}

function cooldownLabelFromMinutes(min: number): string {
  if (min === 30) return "30 minutes";
  if (min === 60) return "1 hour";
  if (min === 180) return "3 hours";
  if (min === 360) return "6 hours";
  if (min === 720) return "12 hours";
  if (min === 1440) return "24 hours";
  if (min === 10080) return "7 days";
  return `${min} minutes`;
}

function minutesFromCooldownLabel(label: string): number {
  if (label === "30 minutes") return 30;
  if (label === "1 hour") return 60;
  if (label === "3 hours") return 180;
  if (label === "6 hours") return 360;
  if (label === "12 hours") return 720;
  if (label === "24 hours") return 1440;
  if (label === "7 days") return 10080;
  return 1440;
}

type RecoveryWiring = ReturnType<typeof useMctbRecoveryWiring>;

export function useOnboardingRecoveryBundle() {
  const r = useMctbRecoveryWiring();
  const saveAll = useCallback(
    async (messageTemplate: string) => {
      await r.save();
      await persistOnboardingRecoveryAndTemplate(messageTemplate);
    },
    [r],
  );
  return { r, saveAll };
}

export function OnboardingRecoveryControlsSection({ wiring }: { wiring: RecoveryWiring }) {
  const r = wiring;
  const delayLabel = delayLabelFromSeconds(r.delaySeconds);
  const cooldownLabel = cooldownLabelFromMinutes(r.cooldownMinutes);

  if (r.loading) {
    return <p className="text-sm text-muted-foreground">Loading recovery controls…</p>;
  }

  return (
    <div className={`mt-6 space-y-4 bg-muted/10 p-4 ${OPUS_CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Recovery behavior</p>
        <Pill tone={r.paused ? "warning" : "success"}>{r.paused ? "Paused" : "On"}</Pill>
      </div>
      <p className="text-xs text-muted-foreground">
        Pausing stops automated recovery texts. Forwarded calls still reach your voicemail fallback.
      </p>
      {r.paused ? (
        <Button type="button" size="sm" variant="outline" onClick={() => void saveMctbSetup({ enabled: true })}>
          Resume recovery
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => void r.pausePreset("Indefinitely")}>
          Pause recovery
        </Button>
      )}
      <div className={`${OPUS_INSET_LIST} px-5`}>
        <SettingRow
          title="Send delay"
          description="Wait before texting in case your team calls back"
          control={
            <SimpleSelect
              label="Send delay"
              className="w-40"
              value={delayLabel}
              options={["Immediately", "30 seconds", "1 minute", "5 minutes"].map((o) => ({ value: o, label: o }))}
              onChange={(v) => r.setDelaySeconds(secondsFromDelayLabel(v))}
            />
          }
        />
        <SettingRow
          title="Cooldown"
          description="Do not text the same caller again within this window"
          control={
            <SimpleSelect
              label="Cooldown"
              className="w-40"
              value={cooldownLabel}
              options={["30 minutes", "1 hour", "3 hours", "6 hours", "12 hours", "24 hours", "7 days"].map((o) => ({
                value: o,
                label: o,
              }))}
              onChange={(v) => r.setCooldownMinutes(minutesFromCooldownLabel(v))}
            />
          }
        />
        <SettingRow
          title="Max automated recovery texts"
          description="Same caller within the cooldown window. Does not include Press-1 compliance texts."
          control={
            <SimpleSelect
              label="Max automated recovery texts"
              className="w-24"
              value={String(r.maxMessages)}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(v) => r.setMaxMessages(Number(v) || 3)}
            />
          }
        />
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={() => void r.save()}>
        Save recovery controls
      </Button>
    </div>
  );
}

export async function persistOnboardingRecoveryAndTemplate(messageTemplate: string): Promise<void> {
  const data = await fetchMctbSetup({ force: true });
  const phoneNumberId = (data.runtime as { phoneNumberId?: string })?.phoneNumberId;
  const senderMode = (data.messaging as { senderMode?: string })?.senderMode;
  if (senderMode === "PLATFORM") {
    const { listMctbPlatformRecoveryOpenerChoices } = await import(
      "@/lib/mctb/platform-recovery-template-choices"
    );
    const match =
      listMctbPlatformRecoveryOpenerChoices().find((c) => c.body === messageTemplate.trim()) ??
      listMctbPlatformRecoveryOpenerChoices()[0];
    if (match) {
      await saveMctbSetup({ platformRecoveryTemplateId: match.id });
    }
    return;
  }
  if (phoneNumberId && messageTemplate.trim()) {
    await saveMctbSetup({
      phoneNumberId,
      messageTemplate: messageTemplate.trim(),
      activate: false,
    });
  }
}

type NotificationsStepProps = {
  c: MctbOnboardingController;
  caps: MctbCapabilities | null;
  compact?: boolean;
};

export function OnboardingNotificationsStep({ c, caps, compact }: NotificationsStepProps) {
  const n = useMctbNotificationsWiring();
  const primary = n.recipients[0];
  const [name, setName] = useState(primary?.name || c.businessName || "");
  const [email, setEmail] = useState(primary?.email || "");
  const [mobile, setMobile] = useState(primary?.mobileE164 || "");
  const [callerReplyEmail, setCallerReplyEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!n.config) return;
    const matrix = n.config.routingMatrix.caller_replied;
    setCallerReplyEmail(matrix?.email ?? true);
  }, [n.config]);

  const saveNotifications = useCallback(async () => {
    if (!n.config) throw new Error("Notifications not loaded");
    if (!email.trim()) throw new Error("Notification email is required.");
    const recipient: MctbNotificationRecipientDto = {
      id: primary?.id || `onb-${Date.now()}`,
      name: name.trim() || "Primary contact",
      email: email.trim(),
      mobileE164: mobile.trim() || null,
      roleDescription: null,
      eventChannels: primary?.eventChannels || {},
      enabled: true,
      sortOrder: 0,
    };
    const recipients =
      n.recipients.length > 0
        ? [recipient, ...n.recipients.slice(1)]
        : [recipient];
    const config: MctbHandoffConfigDto = {
      ...n.config,
      routingMatrix: {
        ...n.config.routingMatrix,
        caller_replied: {
          ...(n.config.routingMatrix.caller_replied || {}),
          email: callerReplyEmail,
          sms: false,
        },
      },
    };
    const res = await fetch("/api/mctb/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config, recipients }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Could not save notifications");
    }
  }, [callerReplyEmail, email, mobile, name, n.config, n.recipients, primary]);

  const recoveryPaid = Boolean(caps?.recoveryPaid);
  const aiEntitled = Boolean(caps?.aiRecoveryEntitled);

  useMctbWizardFooter(
    compact && !n.loading
      ? {
          back: true,
          primary: {
            label: "Continue",
            disabled: c.saving || !email.trim(),
            onClick: () => {
              void (async () => {
                setError(null);
                try {
                  await saveNotifications();
                  await c.post({ action: "complete_notifications" });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Save failed");
                }
              })();
            },
          },
        }
      : null,
  );

  if (n.loading) {
    return <p className="text-sm text-muted-foreground">Loading notifications…</p>;
  }

  const body = (
    <>
      {compact ? (
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Step 5</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Where should we notify you?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll use these details when a missed-call lead replies or needs your attention.
          </p>
        </div>
      ) : null}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="onb-notify-email">Notification email</Label>
          <Input
            id="onb-notify-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Standard missed-call reply notifications — who texted back and what they said.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onb-notify-mobile">Mobile number</Label>
          <Input
            id="onb-notify-mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+1…"
          />
          <p className="text-xs text-muted-foreground">
            Separate from reply email: used only for urgent / high-priority SMS alerts when your plan includes them.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <Checkbox
          id="onb-caller-reply-email"
          checked={callerReplyEmail}
          onCheckedChange={(v) => setCallerReplyEmail(Boolean(v))}
        />
        <Label htmlFor="onb-caller-reply-email">Email me when a caller replies (standard reply notification)</Label>
      </div>

      <div className="mt-8 border-t pt-6 text-sm">
        <p className="mb-3 font-medium">Included</p>
        <ul className="space-y-2 text-muted-foreground">
          <li>✓ Caller reply notifications</li>
          <li>
            {recoveryPaid ? "✓" : "🔒"} Urgent reply detection
            {!recoveryPaid ? " — Available with Recovery" : ""}
          </li>
          <li>
            {recoveryPaid ? "✓" : "🔒"} Immediate urgent alerts
            {!recoveryPaid ? " — Available with Recovery" : ""}
          </li>
          <li>
            {aiEntitled ? "✓" : "🔒"} AI follow-up conversations
            {!aiEntitled ? " — Available with AI Recovery" : ""}
          </li>
        </ul>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {!compact ? (
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button type="button" variant="outline" disabled={c.saving} onClick={() => void c.post({ step: "voicemail" })}>
            Back
          </Button>
          <Button
            type="button"
            disabled={c.saving || !email.trim()}
            onClick={() => {
              void (async () => {
                setError(null);
                try {
                  await saveNotifications();
                  await c.post({ action: "complete_notifications" });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Save failed");
                }
              })();
            }}
          >
            Continue
          </Button>
        </footer>
      ) : null}
    </>
  );

  if (compact) return body;

  return (
    <Panel
      title="Business notifications"
      description="Where your team gets alerted when callers reply or something needs attention."
    >
      {body}
    </Panel>
  );
}

function OnboardingAiRecoverySection({ caps }: { caps: MctbCapabilities | null }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const entitled = Boolean(caps?.aiRecoveryEntitled);

  useEffect(() => {
    if (!entitled) {
      setLoading(false);
      return;
    }
    void fetch("/api/mctb/ai-recovery/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? j;
        setEnabled(Boolean(data.recovery?.enabled));
      })
      .finally(() => setLoading(false));
  }, [entitled]);

  if (!entitled) {
    return (
      <div className={`mt-6 flex items-start gap-2 bg-muted/20 p-4 text-sm text-muted-foreground ${OPUS_CARD}`}>
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium text-foreground">AI Recovery</p>
          <p className="mt-1">Automatically continue the conversation with callers. Requires AI Recovery.</p>
        </div>
      </div>
    );
  }

  if (loading) return null;

  return (
    <div className={`mt-6 p-4 text-sm ${OPUS_CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">AI Recovery</p>
        <label className="flex items-center gap-2">
          <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
          <span>Enabled</span>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Uses your existing AI Recovery settings.{" "}
        <Link href={MCTB_ROUTES.aiRecovery} className="text-primary hover:underline">
          Advanced settings
        </Link>
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() =>
          void fetch("/api/mctb/ai-recovery/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled }),
          })
        }
      >
        Save AI Recovery
      </Button>
    </div>
  );
}

export function OnboardingVoicemailStep({ c }: { c: MctbOnboardingController }) {
  const vm = useMctbVoicemailWiring();
  const [mode, setMode] = useState<"default" | "custom">("default");
  const press1 = c.consentMode === "press_1";

  const ensureDefault = useCallback(async () => {
    if (!vm.phoneNumberId) return;
    await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_number_box", phoneNumberId: vm.phoneNumberId }),
    });
  }, [vm.phoneNumberId]);

  return (
    <Panel title="Voicemail & call fallback" description="What callers hear when recovery cannot proceed or you pause MCTB.">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={mode === "default" ? "default" : "outline"} onClick={() => setMode("default")}>
          Use Transovo default
        </Button>
        <Button type="button" variant={mode === "custom" ? "default" : "outline"} onClick={() => setMode("custom")}>
          Customize greeting
        </Button>
      </div>
      {mode === "default" ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Platform default greeting</p>
          <p className="mt-2 text-muted-foreground">
            Ensures every forwarded call has a safe terminal experience — including when recovery is paused.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Label htmlFor="onb-vm-greeting">Greeting text</Label>
          <Textarea
            id="onb-vm-greeting"
            rows={3}
            value={vm.greetingText}
            onChange={(e) => vm.setGreetingText(e.target.value)}
            disabled={vm.loading}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => void vm.saveGreeting()}>
            Save greeting
          </Button>
        </div>
      )}
      <aside className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Pause safety</p>
        <p className="mt-1 text-muted-foreground">
          {press1
            ? "Press-1 callers who do not consent hear this greeting. If you pause recovery, forwarded callers still hear it — no recovery SMS."
            : "Existing-consent callers hear this greeting on the voice path; recovery SMS follows your consent mode when active."}
        </p>
      </aside>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={c.saving} onClick={() => void c.post({ step: "notifications" })}>
          Back
        </Button>
        <Button
          type="button"
          disabled={c.saving || vm.loading}
          onClick={() =>
            void (async () => {
              if (mode === "default") await ensureDefault();
              else if (vm.greetingText.trim()) await vm.saveGreeting();
              await c.post({ action: "mark_voicemail_configured" });
            })()
          }
        >
          Continue
        </Button>
      </footer>
    </Panel>
  );
}
