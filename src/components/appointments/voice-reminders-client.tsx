"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { toSmartRoutingCustomerError } from "@/lib/smart-routing/customer-errors";
import {
  DEFAULT_HUMAN_SCRIPT,
  DEFAULT_KEYPAD_OPTIONS,
  DEFAULT_VOICEMAIL_SCRIPT,
  type VoiceKeypadOption,
  type VoiceReminderTemplate,
} from "@/lib/appointment-voice-reminders/types";
import { Check, Loader2, Phone, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CallerIdUi = {
  verification: {
    status: string;
    publicBusinessE164: string | null;
    method: string | null;
    verifiedAt?: string | null;
  };
  outboundCallerId: string | null;
  outboundSource: string | null;
  transovoNumbers: Array<{ id: string; e164: string; friendlyName?: string | null }>;
  provisionedPhoneNumberId: string | null;
};

type VoiceRemindersData = {
  enabled?: boolean;
  defaultTemplateId?: string;
  templates: VoiceReminderTemplate[];
  provisionedPhoneNumberId?: string;
  defaultTransferE164?: string;
  callerId: CallerIdUi;
  businessPhone?: string | null;
};

function newTemplate(index: number): VoiceReminderTemplate {
  return {
    id: `template_${Date.now()}_${index}`,
    name: `Voice reminder ${index + 1}`,
    contentMode: "tts",
    humanScript: DEFAULT_HUMAN_SCRIPT,
    voicemailScript: DEFAULT_VOICEMAIL_SCRIPT,
    keypadOptions: DEFAULT_KEYPAD_OPTIONS.map((o) => ({ ...o })),
    retryRules: {
      noAnswer: { mode: "retry", maxAttempts: 1, delayMinutes: 30 },
      busy: { mode: "retry", delayMinutes: 15 },
      voicemail: { mode: "delivered" },
    },
  };
}

function keypadSummary(options: VoiceKeypadOption[]): string {
  const parts = options
    .filter((o) => o.action !== "none")
    .map((o) => `${o.digit} = ${o.label || o.action}`);
  return parts.join(" · ") || "No keypad actions";
}

export function VoiceRemindersClient() {
  const [data, setData] = useState<VoiceRemindersData | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState({ human: "", voicemail: "" });
  const [previewLoading, setPreviewLoading] = useState(false);

  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyCode, setVerifyCode] = useState("");

  const selectedTemplate = useMemo(
    () => data?.templates.find((t) => t.id === selectedTemplateId) || data?.templates[0] || null,
    [data, selectedTemplateId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/voice-reminders");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load voice reminders");
      const payload = json.data as VoiceRemindersData;
      setData(payload);
      setSelectedTemplateId(payload.defaultTemplateId || payload.templates[0]?.id || "");
      setVerifyPhone(payload.callerId.verification.publicBusinessE164 || payload.businessPhone || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedTemplate) return;
    let cancelled = false;
    setPreviewLoading(true);
    void fetch("/api/appointments/voice-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview",
        humanScript: selectedTemplate.humanScript,
        voicemailScript: selectedTemplate.voicemailScript,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setPreview({
          human: json.data?.human || "",
          voicemail: json.data?.voicemail || "",
        });
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate?.humanScript, selectedTemplate?.voicemailScript, selectedTemplate]);

  function updateTemplate(patch: Partial<VoiceReminderTemplate>) {
    if (!data || !selectedTemplate) return;
    const templates = data.templates.map((t) =>
      t.id === selectedTemplate.id ? { ...t, ...patch } : t,
    );
    setData({ ...data, templates });
  }

  function updateKeypad(index: number, patch: Partial<VoiceKeypadOption>) {
    if (!selectedTemplate) return;
    const keypadOptions = selectedTemplate.keypadOptions.map((o, i) =>
      i === index ? { ...o, ...patch } : o,
    );
    updateTemplate({ keypadOptions });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/voice-reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: data.enabled,
        defaultTemplateId: selectedTemplateId,
        templates: data.templates,
        provisionedPhoneNumberId: data.provisionedPhoneNumberId,
        defaultTransferE164: data.defaultTransferE164,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save");
      return;
    }
    await load();
  }

  async function startVerification() {
    setVerifyLoading(true);
    setVerifyError("");
    setVerifyMessage("");
    try {
      const res = await fetch("/api/appointments/voice-reminders/caller-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", phoneE164: verifyPhone, method: "call" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setVerifyError(toSmartRoutingCustomerError(json.error || "Verification failed"));
        return;
      }
      setVerifyMessage(
        "Answer your phone and press 1 when prompted. We will mark your number verified automatically.",
      );
      await load();
    } finally {
      setVerifyLoading(false);
    }
  }

  async function submitVerificationCode() {
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/appointments/voice-reminders/caller-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_code", code: verifyCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setVerifyError(toSmartRoutingCustomerError(json.error || "Code rejected"));
        return;
      }
      setVerifyMessage("Your business number is verified.");
      setVerifyCode("");
      await load();
    } finally {
      setVerifyLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading voice reminders…</div>;
  }

  if (!data || !selectedTemplate) {
    return (
      <div className="p-8 text-sm text-red-600">{error || "Voice reminders could not be loaded."}</div>
    );
  }

  const verified = data.callerId.verification.status === "verified";
  const pending = data.callerId.verification.status === "pending";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Voice Reminders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automated appointment reminder calls with keypad confirmation, reschedule, and cancel options.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.enabled !== false}
              onChange={(e) => setData({ ...data, enabled: e.target.checked })}
            />
            Enabled
          </label>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-base font-semibold">Outbound caller ID</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Appointment reminder calls display your verified business number when available.
          </p>
        </div>

        {verified ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <Check className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Business number verified</p>
              <p className="text-sm text-emerald-800">
                {fmtPhoneDisplay(
                  data.callerId.verification.publicBusinessE164 ||
                    data.callerId.outboundCallerId ||
                    verifyPhone,
                )}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Customers will see this number when Transovo places reminder calls.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Business number</Label>
              <Input
                value={verifyPhone}
                onChange={(e) => setVerifyPhone(e.target.value)}
                placeholder="(571) 555-0199"
                className="mt-1.5 max-w-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Add the number your customers already know. We&apos;ll verify you control it with a quick
                press-1 call.
              </p>
            </div>
            <Button disabled={verifyLoading || !verifyPhone.trim()} onClick={() => void startVerification()}>
              {verifyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
              Verify number
            </Button>
            {pending ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Verification in progress — answer your phone and press 1. If you received a code instead,
                  enter it below.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Code"
                    className="w-32"
                    maxLength={8}
                  />
                  <Button variant="outline" disabled={verifyLoading || !verifyCode} onClick={() => void submitVerificationCode()}>
                    Submit code
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {verifyMessage ? <p className="text-sm text-emerald-700">{verifyMessage}</p> : null}
        {verifyError ? <p className="text-sm text-red-600">{verifyError}</p> : null}

        {data.callerId.transovoNumbers.length > 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <p className="font-medium">Transovo voice number</p>
            <p className="text-muted-foreground">
              {fmtPhoneDisplay(data.callerId.transovoNumbers[0].e164)} — used as fallback caller ID and
              for inbound voice features.
            </p>
            {data.callerId.transovoNumbers.length > 1 ? (
              <div className="mt-2">
                <Label>Fallback outbound number</Label>
                <Select
                  value={data.provisionedPhoneNumberId || ""}
                  onChange={(e) => setData({ ...data, provisionedPhoneNumberId: e.target.value })}
                  className="mt-1.5 max-w-sm"
                >
                  {data.callerId.transovoNumbers.map((n) => (
                    <option key={n.id} value={n.id}>{fmtPhoneDisplay(n.e164)}</option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Templates</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const t = newTemplate(data.templates.length);
                setData({ ...data, templates: [...data.templates, t] });
                setSelectedTemplateId(t.id);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {data.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplateId(t.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  t.id === selectedTemplate.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{keypadSummary(t.keypadOptions)}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <Input
              value={selectedTemplate.name}
              onChange={(e) => updateTemplate({ name: e.target.value })}
              className="max-w-md font-medium"
            />
            {data.templates.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const templates = data.templates.filter((t) => t.id !== selectedTemplate.id);
                  setData({ ...data, templates });
                  setSelectedTemplateId(templates[0]?.id || "");
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div>
            <Label>Human answer script (text-to-speech)</Label>
            <Textarea
              value={selectedTemplate.humanScript}
              onChange={(e) => updateTemplate({ humanScript: e.target.value })}
              rows={4}
              className="mt-1.5 font-mono text-xs"
            />
          </div>

          <div>
            <Label>Voicemail script</Label>
            <Textarea
              value={selectedTemplate.voicemailScript}
              onChange={(e) => updateTemplate({ voicemailScript: e.target.value })}
              rows={3}
              className="mt-1.5 font-mono text-xs"
            />
          </div>

          <div className="rounded-lg bg-muted/40 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Script preview</p>
            {previewLoading ? (
              <p className="mt-2 text-muted-foreground">Rendering preview…</p>
            ) : (
              <>
                <p className="mt-2 whitespace-pre-wrap">{preview.human}</p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">Voicemail version</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{preview.voicemail}</p>
              </>
            )}
          </div>

          <div>
            <Label>Default transfer number (press 0)</Label>
            <Input
              value={data.defaultTransferE164 || ""}
              onChange={(e) => setData({ ...data, defaultTransferE164: e.target.value })}
              placeholder={data.businessPhone || "Office phone"}
              className="mt-1.5 max-w-sm"
            />
          </div>

          <div className="space-y-3">
            <Label>Keypad options</Label>
            {selectedTemplate.keypadOptions.map((option, index) => (
              <div key={`${option.digit}-${index}`} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4">
                <Input
                  value={option.digit}
                  onChange={(e) => updateKeypad(index, { digit: e.target.value.replace(/\D/g, "").slice(0, 1) })}
                  placeholder="Key"
                />
                <Select
                  value={option.action}
                  onChange={(e) =>
                    updateKeypad(index, { action: e.target.value as VoiceKeypadOption["action"] })
                  }
                >
                  <option value="confirm">Confirm</option>
                  <option value="reschedule">Reschedule</option>
                  <option value="cancel">Cancel</option>
                  <option value="transfer">Transfer</option>
                  <option value="none">None</option>
                </Select>
                <Input
                  value={option.label || ""}
                  onChange={(e) => updateKeypad(index, { label: e.target.value })}
                  placeholder="Label"
                  className="sm:col-span-2"
                />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>No answer</Label>
              <Select
                value={selectedTemplate.retryRules?.noAnswer.mode || "retry"}
                onChange={(e) =>
                  updateTemplate({
                    retryRules: {
                      ...selectedTemplate.retryRules,
                      noAnswer: {
                        ...selectedTemplate.retryRules?.noAnswer,
                        mode: e.target.value as "none" | "retry",
                      },
                      busy: selectedTemplate.retryRules?.busy || { mode: "retry", delayMinutes: 15 },
                      voicemail: selectedTemplate.retryRules?.voicemail || { mode: "delivered" },
                    },
                  })
                }
                className="mt-1.5"
              >
                <option value="none">Do not retry</option>
                <option value="retry">Retry</option>
              </Select>
            </div>
            <div>
              <Label>Retry delay (minutes)</Label>
              <Input
                type="number"
                min={5}
                value={selectedTemplate.retryRules?.noAnswer.delayMinutes ?? 30}
                onChange={(e) =>
                  updateTemplate({
                    retryRules: {
                      ...selectedTemplate.retryRules,
                      noAnswer: {
                        mode: selectedTemplate.retryRules?.noAnswer.mode || "retry",
                        maxAttempts: selectedTemplate.retryRules?.noAnswer.maxAttempts ?? 1,
                        delayMinutes: Number(e.target.value) || 30,
                      },
                      busy: selectedTemplate.retryRules?.busy || { mode: "retry", delayMinutes: 15 },
                      voicemail: selectedTemplate.retryRules?.voicemail || { mode: "delivered" },
                    },
                  })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Voicemail</Label>
              <Select
                value={selectedTemplate.retryRules?.voicemail.mode || "delivered"}
                onChange={(e) =>
                  updateTemplate({
                    retryRules: {
                      ...selectedTemplate.retryRules,
                      noAnswer: selectedTemplate.retryRules?.noAnswer || {
                        mode: "retry",
                        maxAttempts: 1,
                        delayMinutes: 30,
                      },
                      busy: selectedTemplate.retryRules?.busy || { mode: "retry", delayMinutes: 15 },
                      voicemail: { mode: e.target.value as "delivered" | "retry" },
                    },
                  })
                }
                className="mt-1.5"
              >
                <option value="delivered">Consider delivered</option>
                <option value="retry">Retry later</option>
              </Select>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
