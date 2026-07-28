"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { lists, phoneNumbers, segments, templates } from "@/lib/mock/data";
import { estimateSmsSegments, formatCurrency, formatNumber, formatPhone } from "@/lib/utils";
import { useMemo, useState } from "react";

const steps = ["Campaign type", "Audience", "Message", "Schedule", "Review", "Send"] as const;
const types = [
  "SMS",
  "MMS",
  "Announcement",
  "Promotion",
  "Reminder",
  "Alert",
  "Customer update",
  "Custom",
];

const FOOTER = "\n\nReply STOP to opt out. Msg & data rates may apply.";

export function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [campaignType, setCampaignType] = useState("SMS");
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("list");
  const [listId, setListId] = useState(lists[0].id);
  const [segmentId, setSegmentId] = useState(segments[0].id);
  const [numberId, setNumberId] = useState(phoneNumbers[0].id);
  const [body, setBody] = useState("Hi {{first_name}}, ");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sent, setSent] = useState(false);

  const recipients = useMemo(() => {
    if (audience === "all") return 1840;
    if (audience === "segment") {
      return segments.find((s) => s.id === segmentId)?.count ?? 0;
    }
    if (audience === "list") {
      return lists.find((l) => l.id === listId)?.count ?? 0;
    }
    if (audience === "tags") return 54;
    if (audience === "individuals") return 3;
    return 0;
  }, [audience, listId, segmentId]);

  const fullBody = body.includes("STOP") ? body : `${body.trim()}${FOOTER}`;
  const { characters, segments: smsSegments } = estimateSmsSegments(fullBody);
  const estimatedCost = recipients * smsSegments * 0.015;

  function next() {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  if (sent) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <StatusChip status={scheduleMode === "later" ? "Scheduled" : "Sending"} />
        <h2 className="mt-4 font-display text-2xl font-semibold">
          {scheduleMode === "later" ? "Campaign scheduled" : "Campaign queued"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatNumber(recipients)} recipients · {smsSegments} segment
          {smsSegments === 1 ? "" : "s"} each · est. {formatCurrency(estimatedCost)}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => { setSent(false); setStep(0); }}>
            Create another
          </Button>
          <a href="/campaigns">
            <Button>View campaigns</Button>
          </a>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardTitle>Steps</CardTitle>
        <ol className="mt-4 space-y-2">
          {steps.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                  i === step ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    i === step ? "bg-primary text-primary-foreground" : "bg-border"
                  }`}
                >
                  {i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        {step === 0 && (
          <div className="space-y-4">
            <CardTitle>Campaign type</CardTitle>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="July service special"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCampaignType(t)}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                    campaignType === t
                      ? "border-primary bg-teal-50 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <CardTitle>Audience</CardTitle>
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">All subscribed contacts</option>
              <option value="list">Contact list</option>
              <option value="segment">Dynamic segment</option>
              <option value="tags">Selected tags</option>
              <option value="individuals">Individual contacts</option>
              <option value="import">Imported temporary audience</option>
            </Select>
            {audience === "list" ? (
              <Select value={listId} onChange={(e) => setListId(e.target.value)}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.count})
                  </option>
                ))}
              </Select>
            ) : null}
            {audience === "segment" ? (
              <Select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </option>
                ))}
              </Select>
            ) : null}
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              Estimated recipients: <strong>{formatNumber(recipients)}</strong>
              <span className="text-muted-foreground"> (unsubscribed & blocked excluded)</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <CardTitle>Message</CardTitle>
            <div>
              <Label>Sending number</Label>
              <Select value={numberId} onChange={(e) => setNumberId(e.target.value)}>
                {phoneNumbers.map((n) => (
                  <option key={n.id} value={n.id}>
                    {formatPhone(n.number)} · {n.friendlyName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Saved template</Label>
              <Select
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) setBody(t.body);
                }}
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Message body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {["{{first_name}}", "{{last_name}}", "{{business_name}}"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="rounded-md border border-border px-2 py-1 hover:bg-muted"
                    onClick={() => setBody((b) => b + f)}
                  >
                    {f}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 hover:bg-muted"
                  onClick={() =>
                    setBody(
                      "Quick update from Harbor Home: schedule your seasonal service this week and save. Reply YES for times.",
                    )
                  }
                >
                  AI assist
                </button>
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-3">
              <div>
                Characters: <strong>{characters}</strong>
              </div>
              <div>
                SMS segments: <strong>{smsSegments}</strong>
              </div>
              <div>
                Est. cost: <strong>{formatCurrency(estimatedCost)}</strong>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Required compliance footer is appended automatically if STOP language is missing.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <CardTitle>Schedule</CardTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScheduleMode("now")}
                className={`rounded-lg border p-4 text-left ${
                  scheduleMode === "now" ? "border-primary bg-teal-50" : "border-border"
                }`}
              >
                <p className="font-medium">Send now</p>
                <p className="mt-1 text-xs text-muted-foreground">Queue immediately after review</p>
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode("later")}
                className={`rounded-lg border p-4 text-left ${
                  scheduleMode === "later" ? "border-primary bg-teal-50" : "border-border"
                }`}
              >
                <p className="font-medium">Schedule</p>
                <p className="mt-1 text-xs text-muted-foreground">Pick a future send time</p>
              </button>
            </div>
            {scheduleMode === "later" ? (
              <div>
                <Label>Send at</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        )}

        {(step === 4 || step === 5) && (
          <div className="space-y-4">
            <CardTitle>{step === 4 ? "Review" : "Send"}</CardTitle>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{name || "Untitled campaign"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">{campaignType}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Recipients</dt>
                <dd className="font-medium">{formatNumber(recipients)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Segments / cost</dt>
                <dd className="font-medium">
                  {smsSegments} · {formatCurrency(estimatedCost)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">When</dt>
                <dd className="font-medium">
                  {scheduleMode === "now" ? "Send now" : scheduledAt || "Not set"}
                </dd>
              </div>
            </dl>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Message preview
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{fullBody}</p>
            </div>
            {step === 5 ? (
              <p className="text-sm text-muted-foreground">
                Final confirmation: unsubscribed and blocked numbers are excluded at queue time.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={back} disabled={step === 0}>
            Back
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Save draft</Button>
            <Button variant="outline">Send test</Button>
            {step < 5 ? (
              <Button onClick={next}>{step === 4 ? "Continue to send" : "Continue"}</Button>
            ) : (
              <Button onClick={() => setSent(true)}>
                {scheduleMode === "later" ? "Schedule campaign" : "Send now"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
