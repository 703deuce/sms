"use client";

import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  DEFAULT_MESSAGES,
  getCampaignCategory,
  type CampaignCategoryId,
} from "@/lib/campaigns/catalog";
import { cn, estimateSmsSegments } from "@/lib/utils";
import { ArrowLeft, Check, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const FOLLOW_UP_TRIGGERS = [
  "new lead",
  "estimate sent",
  "appointment completed",
  "purchase completed",
  "form submitted",
  "no reply",
  "job completed",
  "event attended",
];

export default function NewCategoryCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = String(params.category || "") as CampaignCategoryId;
  const category = getCampaignCategory(categoryId);

  const [name, setName] = useState(category ? `${category.title}` : "New campaign");
  const [message, setMessage] = useState(
    category ? DEFAULT_MESSAGES[category.id] : DEFAULT_MESSAGES.custom,
  );
  const [audience, setAudience] = useState("All subscribed contacts");
  const [trigger, setTrigger] = useState(FOLLOW_UP_TRIGGERS[0]);
  const [delayHours, setDelayHours] = useState("24");
  const [followUpCount, setFollowUpCount] = useState("2");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [scheduleMode, setScheduleMode] = useState<"draft" | "now" | "later">("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const segments = useMemo(() => estimateSmsSegments(message), [message]);

  if (!category) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Unknown campaign category.</p>
        <Link href="/campaigns" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover">Back to campaigns</Link>
      </div>
    );
  }

  const Icon = CATEGORY_ICONS[category.icon] || Send;
  const needsTrigger = ["follow_up", "welcome", "missed_call", "review", "lead_nurture", "win_back", "status_update", "payment"].includes(
    category.id,
  );
  const needsSequenceOpts = ["follow_up", "lead_nurture", "win_back", "review", "welcome"].includes(
    category.id,
  );

  async function save(activate: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: category!.id,
          type: category!.title,
          audience,
          message,
          activate: activate && scheduleMode === "now",
          scheduledAt: scheduleMode === "later" && scheduledAt ? scheduledAt : undefined,
          config: {
            trigger,
            delayHours: Number(delayHours) || 24,
            followUpCount: Number(followUpCount) || 2,
            stopOnReply,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create campaign");
      setDone(json.data.campaign.id);
      router.push(`/campaigns/${json.data.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={category.title}
        description={category.description}
        actions={
          <Link href="/campaigns" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" />
              All types</Link>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className={cn("rounded-xl p-2.5", category.tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-600">
            Configure this {category.engine} once. Same engine covers:{" "}
            {category.examples.join(", ")}.
          </p>
          <p className="mt-1 text-xs text-slate-500">Options: {category.options.join(" · ")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4 p-5">
          <div>
            <Label htmlFor="name">Campaign name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {needsTrigger && (
            <div>
              <Label htmlFor="trigger">Trigger</Label>
              <Select id="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {FOLLOW_UP_TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {needsSequenceOpts && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="delay">Delay between follow-ups (hours)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  value={delayHours}
                  onChange={(e) => setDelayHours(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="count">Number of follow-ups</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={5}
                  value={followUpCount}
                  onChange={(e) => setFollowUpCount(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={stopOnReply}
                  onChange={(e) => setStopOnReply(e.target.checked)}
                />
                Stop sequence when the contact replies
              </label>
            </div>
          )}

          <div>
            <Label htmlFor="audience">Audience</Label>
            <Select id="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option>All subscribed contacts</option>
              <option>A list (choose after save)</option>
              <option>A segment (choose after save)</option>
              <option>Manual enrollment / webhook</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              {segments.characters} characters · {segments.segments} SMS segment
              {segments.segments === 1 ? "" : "s"} · merge fields like {"{{first_name}}"} supported
            </p>
          </div>

          <div>
            <Label>When to run</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["draft", "Save as draft"],
                  ["now", "Activate now"],
                  ["later", "Schedule"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScheduleMode(id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    scheduleMode === id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {scheduleMode === "later" && (
              <Input
                className="mt-3"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {done && (
            <p className="flex items-center gap-2 text-sm text-violet-700">
              <Check className="h-4 w-4" /> Campaign created
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button disabled={saving} onClick={() => save(scheduleMode !== "draft")}>
              <Send className="h-4 w-4" />
              {saving ? "Saving…" : scheduleMode === "draft" ? "Save draft" : "Create campaign"}
            </Button>
            <Link href="/campaigns" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</Link>
          </div>
        </Card>

        <Card className="h-fit p-5">
          <h3 className="font-semibold text-slate-900">Preview</h3>
          <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-sm text-white">
            <p className="whitespace-pre-wrap">{message}</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Required compliance language is enforced on live sends (STOP/HELP). Always include clear
            identification of your business.
          </p>
        </Card>
      </div>
    </div>
  );
}
