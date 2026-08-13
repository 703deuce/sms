"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import type { PhoneNumber, Template } from "@/lib/types";
import { cn, estimateSmsSegments, formatCurrency, formatNumber, formatPhone } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Info,
  Megaphone,
  MessageSquare,
  Send,
  Settings2,
  Sparkles,
  Tag,
  UserRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";

const steps = ["Campaign type", "Audience", "Message", "Schedule", "Review", "Send"] as const;

type WizardList = { id: string; name: string; contactCount: number };
type WizardSegment = { id: string; name: string; conditions: unknown };

const typeCards: Array<{
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}> = [
  { id: "SMS", label: "SMS", description: "Send text messages", icon: MessageSquare, tone: "bg-violet-50 text-violet-600" },
  { id: "MMS", label: "MMS", description: "Send image messages", icon: ImageIcon, tone: "bg-indigo-50 text-indigo-600" },
  { id: "Announcement", label: "Announcement", description: "Broadcast updates", icon: Megaphone, tone: "bg-violet-50 text-violet-600" },
  { id: "Promotion", label: "Promotion", description: "Offers and deals", icon: Tag, tone: "bg-orange-50 text-orange-600" },
  { id: "Reminder", label: "Reminder", description: "Appointment reminders", icon: Bell, tone: "bg-indigo-50 text-indigo-600" },
  { id: "Alert", label: "Alert", description: "Urgent notifications", icon: AlertTriangle, tone: "bg-rose-50 text-rose-600" },
  { id: "Customer update", label: "Customer update", description: "Account updates", icon: UserRound, tone: "bg-violet-50 text-violet-600" },
  { id: "Custom", label: "Custom", description: "Build your own", icon: Settings2, tone: "bg-slate-100 text-slate-600" },
];

const FOOTER = "\n\nReply STOP to opt out. Msg & data rates may apply.";

export function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [campaignType, setCampaignType] = useState("SMS");
  const [name, setName] = useState("New campaign");
  const [audience, setAudience] = useState("list");
  const [listId, setListId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [numberId, setNumberId] = useState("");
  const [body, setBody] = useState("Hi {{first_name}}, ");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sent, setSent] = useState(false);
  const [lists, setLists] = useState<WizardList[]>([]);
  const [segments, setSegments] = useState<WizardSegment[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [pools, setPools] = useState<{ id: string; name: string }[]>([]);
  const [senderPoolId, setSenderPoolId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("/api/contacts/lists")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.length) {
          setLists(json.data);
          setListId(json.data[0].id);
        }
      })
      .catch(() => undefined);
    fetch("/api/contacts/segments")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.length) {
          setSegments(json.data);
          setSegmentId(json.data[0].id);
        }
      })
      .catch(() => undefined);
    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.length) {
          setPhoneNumbers(json.data);
          setNumberId(json.data[0].id);
        }
      })
      .catch(() => undefined);
    fetch("/api/numbers/pools")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setPools(json.data);
      })
      .catch(() => undefined);
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setTemplates(json.data);
      })
      .catch(() => undefined);
  }, []);

  const recipients = useMemo(() => {
    if (audience === "all") return 0;
    if (audience === "segment") {
      const seg = segments.find((s) => s.id === segmentId);
      return seg ? 0 : 0;
    }
    if (audience === "list") {
      const list = lists.find((l) => l.id === listId);
      return list?.contactCount ?? 0;
    }
    if (audience === "tags") return 0;
    if (audience === "individuals") return 0;
    return 0;
  }, [audience, listId, segmentId, lists, segments]);

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
      <div className="surface mx-auto max-w-xl rounded-[12px] bg-card p-8 text-center">
        <StatusChip status={scheduleMode === "later" ? "Scheduled" : "Sending"} />
        <h2 className="mt-4 text-2xl font-bold">
          {scheduleMode === "later" ? "Campaign scheduled" : "Campaign queued"}
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {formatNumber(recipients)} recipients · {smsSegments} segment
          {smsSegments === 1 ? "" : "s"} each · est. {formatCurrency(estimatedCost)}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => { setSent(false); setStep(0); }}>
            Create another
          </Button>
          <Link href="/campaigns">
            <Button>View campaigns</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">New campaign</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Build a compliant campaign with audience estimate, message preview, and scheduling.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/send/quick">
            <Button variant="outline" className="h-9 rounded-[10px]">
              <Zap className="h-3.5 w-3.5" />
              Quick text
            </Button>
          </Link>
          <Link href="/send/test">
            <Button variant="outline" className="h-9 rounded-[10px]">
              <Send className="h-3.5 w-3.5" />
              Send test
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
        <div className="surface h-fit rounded-[12px] bg-card p-4">
          <p className="text-[13px] font-bold text-foreground">Steps</p>
          <ol className="relative mt-4 space-y-0">
            {steps.map((label, i) => (
              <li key={label} className="relative flex gap-3 pb-5 last:pb-0">
                {i < steps.length - 1 ? (
                  <span className="absolute left-[13px] top-7 h-[calc(100%-18px)] w-px bg-border" />
                ) : null}
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "relative z-[1] flex w-full items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 text-left text-[13px] transition",
                    i === step ? "bg-violet-50 font-semibold text-violet-700" : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      i === step
                        ? "bg-primary text-white"
                        : i < step
                          ? "bg-indigo-100 text-violet-700"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="surface rounded-[12px] bg-card p-5 sm:p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="campaign-name">Campaign name</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="campaign-name"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 100))}
                    className="h-11 rounded-[10px] pr-16"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                    {name.length} / 100
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[13px] font-semibold text-foreground">Select campaign type</p>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {typeCards.map((t) => {
                    const Icon = t.icon;
                    const selected = campaignType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCampaignType(t.id)}
                        className={cn(
                          "relative rounded-[12px] border bg-card p-3.5 text-left transition",
                          selected
                            ? "border-primary shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                            : "border-border hover:border-primary/40 hover:bg-muted/30",
                        )}
                      >
                        {selected ? (
                          <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : null}
                        <span className={cn("flex h-9 w-9 items-center justify-center rounded-[10px]", t.tone)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <p className="mt-3 text-[13px] font-bold">{t.label}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-indigo-100 bg-indigo-50 px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] text-indigo-900">
                  <Info className="h-4 w-4 shrink-0 text-indigo-600" />
                  Not sure which type to choose? Learn more about campaign types
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-indigo-600" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold">Audience</h2>
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">All subscribed contacts</option>
                <option value="list">Contact list</option>
                <option value="segment">Dynamic segment</option>
                <option value="tags">Selected tags</option>
                <option value="individuals">Individual contacts</option>
                <option value="import">Imported temporary audience</option>
              </Select>
              {audience === "list" ? (
                lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lists yet. Create a list under Contacts.</p>
                ) : (
                  <Select value={listId} onChange={(e) => setListId(e.target.value)}>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.contactCount})
                      </option>
                    ))}
                  </Select>
                )
              ) : null}
              {audience === "segment" ? (
                segments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No segments yet.</p>
                ) : (
                  <Select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )
              ) : null}
              <div className="rounded-[12px] bg-muted px-3 py-2 text-[13px]">
                Estimated recipients: <strong>{formatNumber(recipients)}</strong>
                <span className="text-muted-foreground"> (unsubscribed & blocked excluded)</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold">Message</h2>
              <div>
                <Label>Sending number</Label>
                {phoneNumbers.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">No phone numbers provisioned.</p>
                ) : (
                  <Select
                    value={numberId}
                    onChange={(e) => setNumberId(e.target.value)}
                    disabled={senderPoolId !== ""}
                  >
                    {phoneNumbers.map((n) => (
                      <option key={n.id} value={n.id}>
                        {formatPhone(n.number)} · {n.friendlyName}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {pools.length > 0 ? (
                <div>
                  <Label>Sender pool (optional)</Label>
                  <Select value={senderPoolId} onChange={(e) => setSenderPoolId(e.target.value)}>
                    <option value="">Use single number above</option>
                    {pools.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Rotate sends across all numbers in the pool for higher throughput.
                  </p>
                </div>
              ) : null}
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
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
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
                </div>
              </div>
              <div className="grid gap-2 rounded-[12px] border border-border bg-muted/40 p-3 text-[13px] sm:grid-cols-3">
                <div>Characters: <strong>{characters}</strong></div>
                <div>SMS segments: <strong>{smsSegments}</strong></div>
                <div>Est. cost: <strong>{formatCurrency(estimatedCost)}</strong></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold">Schedule</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setScheduleMode("now")}
                  className={cn(
                    "rounded-[12px] border p-4 text-left",
                    scheduleMode === "now" ? "border-primary bg-violet-50" : "border-border",
                  )}
                >
                  <p className="font-semibold">Send now</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">Queue immediately after review</p>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("later")}
                  className={cn(
                    "rounded-[12px] border p-4 text-left",
                    scheduleMode === "later" ? "border-primary bg-violet-50" : "border-border",
                  )}
                >
                  <p className="font-semibold">Schedule</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">Pick a future send time</p>
                </button>
              </div>
              {scheduleMode === "later" ? (
                <div>
                  <Label>Send at</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              ) : null}
            </div>
          )}

          {(step === 4 || step === 5) && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold">{step === 4 ? "Review" : "Send"}</h2>
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-semibold">{name || "Untitled campaign"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-semibold">{campaignType}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Recipients</dt>
                  <dd className="font-semibold">{formatNumber(recipients)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Segments / cost</dt>
                  <dd className="font-semibold">
                    {smsSegments} · {formatCurrency(estimatedCost)}
                  </dd>
                </div>
              </dl>
              <div className="rounded-[12px] border border-border bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Message preview
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[13px]">{fullBody}</p>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-[10px]">Save draft</Button>
              <Button variant="outline" className="rounded-[10px]">
                <Send className="h-3.5 w-3.5 text-primary" />
                Send test
              </Button>
              {step < 5 ? (
                <Button className="rounded-[10px]" onClick={next}>
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="rounded-[10px]" onClick={() => setSent(true)}>
                  {scheduleMode === "later" ? "Schedule campaign" : "Send now"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
