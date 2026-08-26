"use client";

import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { AttachedMediaThumbs, MediaPicker } from "@/components/messaging/media-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  DEFAULT_MESSAGES,
  getCampaignCategory,
  type CampaignCategoryId,
} from "@/lib/campaigns/catalog";
import { MASS_TEXT_MMS_CREDIT_MULTIPLIER } from "@/lib/mass-texting/pricing";
import { cn, estimateSmsSegments } from "@/lib/utils";
import { ArrowLeft, Check, ImagePlus, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";

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
  const [audience, setAudience] = useState("list");
  const [listIds, setListIds] = useState<string[]>([]);
  const [lists, setLists] = useState<Array<{ id: string; name: string; contactCount?: number }>>([]);
  const [trigger, setTrigger] = useState(FOLLOW_UP_TRIGGERS[0]);
  const [delayHours, setDelayHours] = useState("24");
  const [followUpCount, setFollowUpCount] = useState("2");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [scheduleMode, setScheduleMode] = useState<"draft" | "now" | "later">("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [showMedia, setShowMedia] = useState(false);

  const segments = useMemo(() => estimateSmsSegments(message), [message]);

  useEffect(() => {
    fetch("/api/contacts/lists")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.length) {
          setLists(json.data);
          setListIds((current) => (current.length ? current : [json.data[0].id]));
        }
      })
      .catch(() => undefined);
  }, []);

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
          activate: false,
          scheduledAt: scheduleMode === "later" && scheduledAt ? scheduledAt : undefined,
          listId: listIds[0],
          config: {
            trigger,
            delayHours: Number(delayHours) || 24,
            followUpCount: Number(followUpCount) || 2,
            stopOnReply,
            listIds,
            productSource: "mass_text",
            massTexting: true,
            mediaUrls,
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
            <Label htmlFor="audience">Audience lists</Label>
            {lists.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                No lists yet. <Link href="/contacts/imports" className="underline">Import contacts</Link> first.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {lists.map((list) => (
                  <label key={list.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={listIds.includes(list.id)}
                      onChange={(e) => {
                        setListIds((current) =>
                          e.target.checked
                            ? [...current, list.id]
                            : current.filter((id) => id !== list.id),
                        );
                      }}
                    />
                    {list.name}
                    {typeof list.contactCount === "number" ? ` (${list.contactCount})` : ""}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => setShowMedia(true)}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Add pictures
                {mediaUrls.length ? ` (${mediaUrls.length})` : ""}
              </button>
            </div>
            <Textarea
              id="message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <AttachedMediaThumbs
              urls={mediaUrls}
              onRemove={(url) => setMediaUrls((prev) => prev.filter((u) => u !== url))}
            />
            <p className="mt-1 text-xs text-slate-500">
              {mediaUrls.length
                ? `Pictures send as MMS · ${MASS_TEXT_MMS_CREDIT_MULTIPLIER} credits per recipient for this message (follow-ups stay SMS unless they have their own pictures)`
                : `${segments.characters} characters · ${segments.segments} SMS segment${
                    segments.segments === 1 ? "" : "s"
                  } · merge fields like {{first_name}} supported`}
            </p>
          </div>

          <div>
            <Label>When to run</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["draft", "Save as draft"],
                  ["now", "Review & send"],
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
            {mediaUrls.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {mediaUrls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-md object-cover"
                  />
                ))}
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Required compliance language is enforced on live sends (STOP/HELP). Always include clear
            identification of your business.
            {mediaUrls.length
              ? ` Picture messages use ${MASS_TEXT_MMS_CREDIT_MULTIPLIER} credits each.`
              : ""}
          </p>
        </Card>
      </div>
      <MediaPicker
        open={showMedia}
        onClose={() => setShowMedia(false)}
        initialSelected={mediaUrls}
        onConfirm={setMediaUrls}
      />
    </div>
  );
}
