"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import type { MessagingRegistration } from "@/lib/domain";
import type { MessagingRuntimeSettings } from "@/lib/messaging/messaging-settings";
import { defaultBusinessHours } from "@/lib/messaging/messaging-settings";
import { useEffect, useState } from "react";
import { getSettingsTabs } from "@/lib/settings-tabs";

type Props = {
  registration: MessagingRegistration | null;
};

export function MessagingSettingsForm({ registration }: Props) {
  const [saving, setSaving] = useState(false);
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [runtimeSaved, setRuntimeSaved] = useState(false);
  const [runtime, setRuntime] = useState<MessagingRuntimeSettings | null>(null);

  const samples = registration?.sampleMessages || [];
  const sampleMessages =
    samples.length > 0
      ? samples
      : ["Sample message for compliance records. Reply STOP to opt out."];

  useEffect(() => {
    fetch("/api/settings/messaging-runtime")
      .then((r) => r.json())
      .then((json) => setRuntime(json.data))
      .catch(() => undefined);
  }, []);

  async function saveHelpStop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_use_case",
          useCase: registration?.useCase || "Customer care",
          useCaseDescription:
            registration?.useCaseDescription ||
            "SMS notifications and customer support messages for subscribers who opted in.",
          sampleMessages,
          optInDescription:
            registration?.optInDescription ||
            "Subscribers opt in via web form, keyword, or written consent.",
          helpMessage: form.get("helpResponse"),
          stopMessage: form.get("stopResponse"),
          messageVolume: registration?.messageVolume || "",
          vertical: registration?.vertical || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save settings");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveRuntime(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRuntimeSaving(true);
    setError("");
    setRuntimeSaved(false);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/settings/messaging-runtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awayEnabled: form.get("awayEnabled") === "on",
          awayAlways: form.get("awayAlways") === "on",
          awayMessage: String(form.get("awayMessage") || ""),
          timezone: String(form.get("quietTimezone") || "America/Los_Angeles"),
          quietHoursStart: String(form.get("quietStart") || "") || null,
          quietHoursEnd: String(form.get("quietEnd") || "") || null,
          reviewLinkUrl: String(form.get("reviewLinkUrl") || "") || null,
          optOutKeywords: runtime?.optOutKeywords ?? null,
          optInKeywords: runtime?.optInKeywords ?? null,
          helpKeywords: runtime?.helpKeywords ?? null,
          businessHoursJson: runtime?.businessHoursJson || defaultBusinessHours(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save runtime settings");
      setRuntime(json.data);
      setRuntimeSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setRuntimeSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Messaging settings"
        description="Quiet hours, away messages, compliance footers, STOP handling, and send limits for your workspace."
        actions={
          <div className="flex gap-2">
            <Button type="submit" form="messaging-runtime-form" disabled={runtimeSaving}>
              {runtimeSaving ? "Saving…" : runtimeSaved ? "Saved" : "Save away & hours"}
            </Button>
            <Button type="submit" form="messaging-help-stop-form" disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved" : "Save STOP/HELP"}
            </Button>
          </div>
        }
      />

      <Tabs items={getSettingsTabs()} />

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Away message & business hours</CardTitle>
          <form id="messaging-runtime-form" className="mt-4 space-y-4" onSubmit={saveRuntime}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="awayEnabled"
                name="awayEnabled"
                className="rounded border-border"
                checked={runtime?.awayEnabled ?? false}
                onChange={(e) =>
                  setRuntime((r) =>
                    r ? { ...r, awayEnabled: e.target.checked } : r,
                  )
                }
              />
              <Label htmlFor="awayEnabled" className="mb-0">
                Enable away auto-reply for inbound SMS
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="awayAlways"
                name="awayAlways"
                className="rounded border-border"
                checked={runtime?.awayAlways ?? false}
                onChange={(e) =>
                  setRuntime((r) =>
                    r ? { ...r, awayAlways: e.target.checked } : r,
                  )
                }
              />
              <Label htmlFor="awayAlways" className="mb-0">
                Always away (ignore business hours)
              </Label>
            </div>
            <div>
              <Label htmlFor="awayMessage">Away message</Label>
              <Textarea
                id="awayMessage"
                name="awayMessage"
                rows={3}
                placeholder="Thanks for texting us. We're closed — we'll reply during business hours."
                value={runtime?.awayMessage || ""}
                onChange={(e) =>
                  setRuntime((r) =>
                    r ? { ...r, awayMessage: e.target.value } : r,
                  )
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Sent once per contact per day when away is active. STOP/HELP/keywords run first.
              </p>
            </div>
            <div>
              <Label htmlFor="reviewLinkUrl">Review link URL</Label>
              <Input
                id="reviewLinkUrl"
                name="reviewLinkUrl"
                type="url"
                placeholder="https://g.page/r/your-business/review"
                value={runtime?.reviewLinkUrl || ""}
                onChange={(e) =>
                  setRuntime((r) => (r ? { ...r, reviewLinkUrl: e.target.value } : r))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Destination for {"{{review_link}}"} in campaigns and review requests. Overridden by
                the workspace-level review link when set.
              </p>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Quiet hours</CardTitle>
          <form className="mt-4 space-y-4" onSubmit={saveRuntime}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quietStart">Start time</Label>
                <Input
                  id="quietStart"
                  name="quietStart"
                  type="time"
                  value={runtime?.quietHoursStart || "21:00"}
                  onChange={(e) =>
                    setRuntime((r) =>
                      r ? { ...r, quietHoursStart: e.target.value } : r,
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="quietEnd">End time</Label>
                <Input
                  id="quietEnd"
                  name="quietEnd"
                  type="time"
                  value={runtime?.quietHoursEnd || "08:00"}
                  onChange={(e) =>
                    setRuntime((r) =>
                      r ? { ...r, quietHoursEnd: e.target.value } : r,
                    )
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="quietTimezone">Timezone</Label>
              <Select
                id="quietTimezone"
                name="quietTimezone"
                value={runtime?.timezone || "America/Los_Angeles"}
                onChange={(e) =>
                  setRuntime((r) =>
                    r ? { ...r, timezone: e.target.value } : r,
                  )
                }
              >
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Business hours default Mon–Fri 9am–5pm in the selected timezone when away is enabled
              without &quot;always away&quot;.
            </p>
          </form>
        </Card>

        <Card>
          <CardTitle>Opt-out &amp; opt-in keywords</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="optOutKeywords">Opt-out keywords</Label>
              <Input
                id="optOutKeywords"
                name="optOutKeywords"
                placeholder="STOP, UNSUBSCRIBE, CANCEL, END, QUIT"
                value={runtime?.optOutKeywords ?? ""}
                onChange={(e) =>
                  setRuntime((r) => (r ? { ...r, optOutKeywords: e.target.value } : r))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Inbound messages matching these words suppress the contact. Comma-separated. Defaults
                to STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT.
              </p>
            </div>
            <div>
              <Label htmlFor="optInKeywords">Opt-in keywords</Label>
              <Input
                id="optInKeywords"
                name="optInKeywords"
                placeholder="START, YES, UNSTOP"
                value={runtime?.optInKeywords ?? ""}
                onChange={(e) =>
                  setRuntime((r) => (r ? { ...r, optInKeywords: e.target.value } : r))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Re-subscribe keywords. Defaults to START, YES, UNSTOP.
              </p>
            </div>
            <div>
              <Label htmlFor="helpKeywords">Help keywords</Label>
              <Input
                id="helpKeywords"
                name="helpKeywords"
                placeholder="HELP, INFO"
                value={runtime?.helpKeywords ?? ""}
                onChange={(e) =>
                  setRuntime((r) => (r ? { ...r, helpKeywords: e.target.value } : r))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Trigger the HELP response. Defaults to HELP, INFO. Saved with &quot;Save away &amp;
                hours&quot;.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>STOP &amp; HELP</CardTitle>
          <form id="messaging-help-stop-form" className="mt-4 space-y-4" onSubmit={saveHelpStop}>
            <div>
              <Label htmlFor="stopResponse">STOP confirmation</Label>
              <Textarea
                id="stopResponse"
                name="stopResponse"
                defaultValue={registration?.stopMessage || ""}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="helpResponse">HELP response</Label>
              <Textarea
                id="helpResponse"
                name="helpResponse"
                defaultValue={registration?.helpMessage || ""}
                rows={2}
              />
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Email-to-SMS</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Forward emails to SMS using workspace aliases. Configure addresses on the{" "}
            <a href="/settings/email-to-sms" className="text-primary hover:underline">
              Email-to-SMS settings
            </a>{" "}
            page.
          </p>
        </Card>
      </div>
    </div>
  );
}
