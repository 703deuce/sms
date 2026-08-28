"use client";

import { AiComposeModal } from "@/components/campaigns/broadcast/ai-compose-modal";
import {
  CampaignPageShell,
  campaignUi,
} from "@/components/campaigns/broadcast/campaign-layout";
import { PhonePreview } from "@/components/campaigns/broadcast/phone-preview";
import { TestMessageModal } from "@/components/campaigns/broadcast/test-message-modal";
import { MediaPicker } from "@/components/messaging/media-picker";
import {
  composeMessageBody,
  defaultComposeDraft,
  estimatedRecipientCount,
  loadComposeDraft,
  saveComposeDraft,
  type AudienceSelection,
  type CampaignComposeDraft,
} from "@/lib/campaigns/compose-draft";
import { seedBroadcastComposeFromPlaybook } from "@/lib/campaigns/playbook-broadcast";
import { cn, estimateSmsSegments, formatNumber, formatPhone } from "@/lib/utils";
import {
  Beaker,
  Braces,
  ChevronDown,
  Image as ImageIcon,
  Link2,
  Paperclip,
  Smile,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type PickerItem = AudienceSelection & { group: string };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MERGE_FIELDS = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{email}}"];

export function CampaignComposeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<CampaignComposeDraft>(defaultComposeDraft);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id: string; number: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; body: string }>>([]);
  const [showAi, setShowAi] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState<{ url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [eligibleCount, setEligibleCount] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  function draftAudiencePayload(d: CampaignComposeDraft) {
    return {
      include: d.audience.map((a) => ({ type: a.type, id: a.id, name: a.name })),
      exclude: d.excludeAudience.map((a) => ({ type: a.type, id: a.id, name: a.name })),
    };
  }

  function toBroadcastPayload(d: CampaignComposeDraft) {
    const body = composeMessageBody(d.message);
    let scheduledAt: string | undefined;
    if (d.scheduleMode === "later" && d.scheduledDate && d.scheduledTime) {
      scheduledAt = new Date(`${d.scheduledDate}T${d.scheduledTime}`).toISOString();
    }
    const category =
      d.playbookCategoryId && ["broadcast", "promotion"].includes(d.playbookCategoryId)
        ? d.playbookCategoryId
        : undefined;
    return {
      name: d.name.trim(),
      message: body,
      audience: draftAudiencePayload(d),
      numberId: d.numberId || undefined,
      scheduleMode: d.scheduleMode,
      scheduledAt,
      timezone: d.timezone,
      recurrence: d.scheduleMode === "recurring" ? d.recurrence : undefined,
      mediaUrls: d.mediaUrls,
      trackLinks: d.trackedLinks.some((l) => l.tracked),
      trackedLinks: d.trackedLinks,
      category,
    };
  }

  useEffect(() => {
    const playbook = searchParams.get("playbook");
    const duplicateId = searchParams.get("duplicate");
    const editId = searchParams.get("edit");
    const fromPlaybook = Boolean(playbook && !duplicateId && !editId);

    let loaded = loadComposeDraft();
    if (fromPlaybook) {
      loaded = { ...defaultComposeDraft(), timezone: loaded.timezone };
    }
    const seeded = seedBroadcastComposeFromPlaybook(
      playbook,
      { name: loaded.name, message: loaded.message },
      { force: fromPlaybook },
    );
    loaded.name = seeded.name;
    loaded.message = seeded.message;
    if (seeded.categoryId) {
      loaded.playbookCategoryId = seeded.categoryId;
    }
    setDraft(loaded);

    const loadId = duplicateId || editId;
    if (loadId) {
      fetch(`/api/mass-texting/campaigns/${loadId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!json?.data) return;
          const c = json.data as {
            id: string;
            name: string;
            body: string;
            scheduledAt?: string | null;
            configJson?: {
              audience?: {
                include?: Array<{ type: AudienceSelection["type"]; id: string; name: string }>;
                exclude?: Array<{ type: AudienceSelection["type"]; id: string; name: string }>;
              };
              numberId?: string;
              mediaUrls?: string[];
              trackedLinks?: CampaignComposeDraft["trackedLinks"];
              scheduleMode?: CampaignComposeDraft["scheduleMode"];
              timezone?: string;
              recurrence?: CampaignComposeDraft["recurrence"];
            };
          };
          const config = c.configJson;
          const include = config?.audience?.include || [];
          const scheduled = c.scheduledAt ? new Date(c.scheduledAt) : null;
          const next: CampaignComposeDraft = {
            ...defaultComposeDraft(),
            campaignId: editId ? c.id : undefined,
            name: duplicateId ? `${c.name} (copy)` : c.name,
            message: c.body.replace(/\n\nReply STOP to opt out\. Msg & data rates may apply\./i, ""),
            audience: include.map((a) => ({
              type: a.type,
              id: a.id,
              name: a.name,
            })),
            excludeAudience: (config?.audience?.exclude || []).map((a) => ({
              type: a.type,
              id: a.id,
              name: a.name,
            })),
            numberId: config?.numberId || "",
            mediaUrls: config?.mediaUrls || [],
            trackedLinks: config?.trackedLinks || [],
            scheduleMode: duplicateId ? "now" : config?.scheduleMode || "now",
            timezone: config?.timezone || loaded.timezone,
            recurrence: config?.recurrence,
            scheduledDate: scheduled ? scheduled.toISOString().slice(0, 10) : undefined,
            scheduledTime: scheduled
              ? scheduled.toTimeString().slice(0, 5)
              : undefined,
          };
          saveComposeDraft(next);
          setDraft(next);
        })
        .catch(() => undefined);
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts?take=100").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/numbers").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/templates").then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([listsJson, segmentsJson, contactsJson, numbersJson, templatesJson]) => {
        const items: PickerItem[] = [
          {
            type: "all",
            id: "all-eligible",
            name: "All Eligible Contacts",
            count: 0,
            group: "EVERYONE",
          },
        ];
        for (const l of listsJson.data || []) {
          items.push({
            type: "list",
            id: l.id,
            name: l.name,
            count: l.contactCount,
            group: "LISTS",
          });
        }
        for (const s of segmentsJson.data || []) {
          items.push({
            type: "segment",
            id: s.id,
            name: s.name,
            count: 0,
            group: "SEGMENTS",
          });
        }
        for (const c of contactsJson.data || []) {
          const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
          items.push({
            type: "contact",
            id: c.id,
            name,
            count: 1,
            group: "CONTACTS",
          });
        }
        setPickerItems(items);
        const numbers = numbersJson.data || [];
        setPhoneNumbers(numbers);
        if (numbers[0] && !draft.numberId) {
          setDraft((d) => ({
            ...d,
            numberId: numbers[0].id,
            senderLabel: numbers[0].number,
          }));
        }
        setTemplates(templatesJson.data || []);
      })
      .catch(() => undefined);
  }, [draft.numberId]);

  useEffect(() => {
    if (draft.audience.length === 0) {
      setEligibleCount(0);
      return;
    }
    let cancelled = false;
    fetch("/api/mass-texting/campaigns/audience-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: draftAudiencePayload(draft),
        campaignId: draft.campaignId,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.data) return;
        setEligibleCount(json.data.eligibleCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setEligibleCount(estimatedRecipientCount(draft.audience));
      });
    return () => {
      cancelled = true;
    };
  }, [draft.audience, draft.excludeAudience, draft.campaignId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const previewBody = composeMessageBody(
    draft.message.replace(/\{\{first_name\}\}/gi, "Anthony"),
  );
  const { characters, segments } = estimateSmsSegments(previewBody);
  const isMms = draft.mediaUrls.length > 0;
  const recipientCount = eligibleCount || estimatedRecipientCount(draft.audience);
  const estimatedCredits = recipientCount * (isMms ? 3 : segments);

  const filteredPicker = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return pickerItems;
    return pickerItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [pickerItems, pickerQuery]);

  const groupedPicker = useMemo(() => {
    const groups = new Map<string, PickerItem[]>();
    for (const item of filteredPicker) {
      const list = groups.get(item.group) || [];
      list.push(item);
      groups.set(item.group, list);
    }
    return groups;
  }, [filteredPicker]);

  function updateDraft(patch: Partial<CampaignComposeDraft>) {
    setDraft((d) => {
      const next = { ...d, ...patch };
      saveComposeDraft(next);
      return next;
    });
  }

  function toggleAudience(item: AudienceSelection) {
    setDraft((d) => {
      const exists = d.audience.some((a) => a.id === item.id);
      const audience = exists
        ? d.audience.filter((a) => a.id !== item.id)
        : [...d.audience, item];
      const next = { ...d, audience };
      saveComposeDraft(next);
      return next;
    });
    setPickerOpen(false);
  }

  function removeAudience(id: string) {
    updateDraft({ audience: draft.audience.filter((a) => a.id !== id) });
  }

  function detectLink(text: string) {
    const match = text.match(/https?:\/\/[^\s]+/);
    if (match && !linkPrompt) setLinkPrompt({ url: match[0] });
  }

  async function saveDraftToApi(): Promise<string | null> {
    const body = composeMessageBody(draft.message);
    if (!draft.name.trim() || !body.trim()) {
      setError("Campaign name and message are required.");
      return null;
    }
    if (draft.audience.length === 0) {
      setError("Select at least one audience.");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      const payload = toBroadcastPayload(draft);
      const url = draft.campaignId
        ? `/api/mass-texting/campaigns/${draft.campaignId}`
        : "/api/mass-texting/campaigns";
      const res = await fetch(url, {
        method: draft.campaignId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save campaign");
      const id = (json.data?.id || draft.campaignId) as string;
      updateDraft({ campaignId: id });
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save campaign");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function goToReview() {
    const id = await saveDraftToApi();
    if (id) router.push(`/campaigns/new/review?id=${id}`);
  }

  return (
    <>
      <CampaignPageShell
        title="Create Campaign"
        breadcrumb={
          <>
            <Link href="/campaigns" className="hover:text-[#6366f1]">
              Campaigns
            </Link>
            <span className="mx-2">/</span>
            <span className="text-[#111827]">Create Campaign</span>
          </>
        }
        right={
          <PhonePreview
            message={previewBody}
            senderLabel={draft.senderLabel}
          />
        }
      >
        <div className={cn(campaignUi.card, "space-y-6 p-6")}>
          <div>
            <label className={campaignUi.label}>Campaign Name</label>
            <p className="mt-0.5 text-[12px] text-[#9ca3af]">
              Used to identify this campaign. Customers won&apos;t see this name.
            </p>
            <input
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
              placeholder="Black Friday Dress Sale"
              className={cn(campaignUi.input, "mt-2")}
            />
          </div>

          <div ref={pickerRef} className="relative">
            <label className={campaignUi.label}>Audience</label>
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className={cn(
                campaignUi.input,
                "mt-2 flex items-center justify-between text-left text-[#9ca3af]",
              )}
            >
              <span className={draft.audience.length ? "text-[#111827]" : ""}>
                {draft.audience.length
                  ? `${draft.audience.length} selected`
                  : "Search lists, segments, contacts…"}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {draft.audience.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.audience.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-3 py-1 text-[12px] font-semibold text-[#6366f1]"
                  >
                    {a.name}
                    <button type="button" onClick={() => removeAudience(a.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {recipientCount > 0 ? (
              <p className="mt-2 text-[13px] text-[#059669]">
                {formatNumber(recipientCount)} eligible recipients (estimated)
              </p>
            ) : null}
            {pickerOpen ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-[320px] overflow-auto rounded-xl border border-[#e5e7eb] bg-white shadow-lg">
                <div className="border-b border-[#f3f4f6] p-3">
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search…"
                    className={campaignUi.input}
                  />
                </div>
                {[...groupedPicker.entries()].map(([group, items]) => (
                  <div key={group}>
                    <p className="px-4 py-2 text-[10px] font-bold tracking-wide text-[#9ca3af]">
                      {group}
                    </p>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          toggleAudience({
                            type: item.type,
                            id: item.id,
                            name: item.name,
                            count: item.count,
                          })
                        }
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] hover:bg-[#f9fafb]"
                      >
                        <span>{item.name}</span>
                        {item.count ? (
                          <span className="text-[#9ca3af]">{formatNumber(item.count)}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className={campaignUi.label}>Message</label>
            <textarea
              value={draft.message}
              onChange={(e) => {
                updateDraft({ message: e.target.value });
                detectLink(e.target.value);
              }}
              placeholder="Write your message…"
              className={cn(campaignUi.textarea, "mt-2")}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <button type="button" className="rounded-lg p-2 hover:bg-[#f3f4f6]" onClick={() => setShowMedia(true)} title="Attachment">
                <Paperclip className="h-4 w-4 text-[#6b7280]" />
              </button>
              <button type="button" className="rounded-lg p-2 hover:bg-[#f3f4f6]" title="Emoji">
                <Smile className="h-4 w-4 text-[#6b7280]" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 hover:bg-[#f3f4f6]"
                title="Merge field"
                onClick={() => updateDraft({ message: draft.message + MERGE_FIELDS[0] })}
              >
                <Braces className="h-4 w-4 text-[#6b7280]" />
              </button>
              <button type="button" className="rounded-lg p-2 hover:bg-[#f3f4f6]" title="Link">
                <Link2 className="h-4 w-4 text-[#6b7280]" />
              </button>
              <button type="button" className="rounded-lg p-2 hover:bg-[#f3f4f6]" onClick={() => setShowAi(true)} title="AI Compose">
                <Sparkles className="h-4 w-4 text-[#6366f1]" />
              </button>
              {templates.length > 0 ? (
                <select
                  className="ml-1 h-8 rounded-lg border border-[#e5e7eb] px-2 text-[12px]"
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) updateDraft({ message: t.body });
                  }}
                >
                  <option value="">Template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#6366f1] hover:bg-[#eef2ff]"
                onClick={() => setShowTest(true)}
              >
                <Beaker className="h-3.5 w-3.5" />
                Send Test
              </button>
            </div>
            {linkPrompt ? (
              <div className="mt-3 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-3 text-[13px]">
                <p className="font-medium text-[#4338ca]">
                  Track this link? <span className="font-normal">{linkPrompt.url}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={campaignUi.outlineBtn}
                    onClick={() => setLinkPrompt(null)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={campaignUi.primaryBtn}
                    onClick={() => {
                      updateDraft({
                        trackedLinks: [
                          ...draft.trackedLinks.filter((l) => l.url !== linkPrompt.url),
                          { url: linkPrompt.url, name: "Link", tracked: true },
                        ],
                      });
                      setLinkPrompt(null);
                    }}
                  >
                    Yes
                  </button>
                </div>
              </div>
            ) : null}
            {draft.mediaUrls.length > 0 ? (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-[#6b7280]">
                <ImageIcon className="h-4 w-4" />
                {draft.mediaUrls.length} attachment(s) · MMS
              </div>
            ) : null}
            <p className="mt-2 text-[12px] text-[#6b7280]">
              {characters} characters · {isMms ? "MMS" : `${segments} SMS segment${segments === 1 ? "" : "s"}`}
              {recipientCount > 0
                ? ` · Est. ${formatNumber(estimatedCredits)} credits`
                : ""}
            </p>
          </div>

          {phoneNumbers.length > 0 ? (
            <div>
              <label className={campaignUi.label}>Send from</label>
              <select
                value={draft.numberId}
                onChange={(e) => {
                  const n = phoneNumbers.find((x) => x.id === e.target.value);
                  updateDraft({ numberId: e.target.value, senderLabel: n?.number || "" });
                }}
                className={cn(campaignUi.input, "mt-2 max-w-sm")}
              >
                {phoneNumbers.map((n) => (
                  <option key={n.id} value={n.id}>
                    {formatPhone(n.number)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className={campaignUi.label}>When to Send</label>
            <div className="mt-2 inline-flex rounded-lg border border-[#e5e7eb] p-1">
              {(["now", "later", "recurring"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateDraft({ scheduleMode: mode })}
                  className={cn(
                    "rounded-md px-5 py-2 text-[13px] font-semibold capitalize transition",
                    draft.scheduleMode === mode
                      ? "bg-[#6366f1] text-white shadow-sm"
                      : "text-[#6b7280] hover:text-[#111827]",
                  )}
                >
                  {mode === "now" ? "Now" : mode === "later" ? "Later" : "Recurring"}
                </button>
              ))}
            </div>

            {draft.scheduleMode === "later" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-[12px] font-medium text-[#6b7280]">Date</label>
                  <input
                    type="date"
                    value={draft.scheduledDate || ""}
                    onChange={(e) => updateDraft({ scheduledDate: e.target.value })}
                    className={cn(campaignUi.input, "mt-1")}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6b7280]">Time</label>
                  <input
                    type="time"
                    value={draft.scheduledTime || ""}
                    onChange={(e) => updateDraft({ scheduledTime: e.target.value })}
                    className={cn(campaignUi.input, "mt-1")}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6b7280]">Timezone</label>
                  <input
                    value={draft.timezone}
                    onChange={(e) => updateDraft({ timezone: e.target.value })}
                    className={cn(campaignUi.input, "mt-1")}
                  />
                </div>
              </div>
            ) : null}

            {draft.scheduleMode === "recurring" ? (
              <RecurringControls
                recurrence={
                  draft.recurrence || {
                    startDate: new Date().toISOString().slice(0, 10),
                    interval: 1,
                    unit: "weeks",
                    sendHour: 4,
                    sendMinute: 30,
                    ampm: "PM",
                    endMode: "never",
                    weekdays: [1, 2, 3, 4, 5],
                  }
                }
                onChange={(recurrence) => updateDraft({ recurrence })}
              />
            ) : null}
          </div>

          {error ? <p className="text-[13px] text-[#dc2626]">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f3f4f6] pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraftToApi()}
              className={campaignUi.outlineBtn}
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void goToReview()}
              className={campaignUi.primaryBtn}
            >
              Review Details
            </button>
          </div>
        </div>

        <div className="mt-6 lg:hidden">
          <PhonePreview message={previewBody} senderLabel={draft.senderLabel} />
        </div>
      </CampaignPageShell>

      <AiComposeModal
        open={showAi}
        onClose={() => setShowAi(false)}
        onUseMessage={(msg) => updateDraft({ message: msg })}
      />
      <TestMessageModal
        open={showTest}
        onClose={() => setShowTest(false)}
        message={previewBody}
        numberId={draft.numberId}
      />
      <MediaPicker
        open={showMedia}
        onClose={() => setShowMedia(false)}
        onConfirm={(urls) => {
          updateDraft({ mediaUrls: urls });
          setShowMedia(false);
        }}
        initialSelected={draft.mediaUrls}
      />
    </>
  );
}

function RecurringControls({
  recurrence,
  onChange,
}: {
  recurrence: NonNullable<CampaignComposeDraft["recurrence"]>;
  onChange: (r: NonNullable<CampaignComposeDraft["recurrence"]>) => void;
}) {
  return (
    <div className="mt-4 space-y-4 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4">
      <p className="text-[13px] font-semibold text-[#111827]">Recurring Send</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[12px] font-medium text-[#6b7280]">Starting On</label>
          <input
            type="date"
            value={recurrence.startDate}
            onChange={(e) => onChange({ ...recurrence, startDate: e.target.value })}
            className={cn(campaignUi.input, "mt-1")}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[12px] font-medium text-[#6b7280]">Repeat Every</label>
            <input
              type="number"
              min={1}
              value={recurrence.interval}
              onChange={(e) =>
                onChange({ ...recurrence, interval: Number(e.target.value) || 1 })
              }
              className={cn(campaignUi.input, "mt-1")}
            />
          </div>
          <div className="flex-1">
            <label className="text-[12px] font-medium text-[#6b7280]">&nbsp;</label>
            <select
              value={recurrence.unit}
              onChange={(e) =>
                onChange({
                  ...recurrence,
                  unit: e.target.value as "days" | "weeks" | "months",
                })
              }
              className={cn(campaignUi.input, "mt-1")}
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[12px] font-medium text-[#6b7280]">Sending At</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            type="number"
            min={1}
            max={12}
            value={recurrence.sendHour}
            onChange={(e) =>
              onChange({ ...recurrence, sendHour: Number(e.target.value) || 1 })
            }
            className={cn(campaignUi.input, "w-16")}
          />
          <input
            type="number"
            min={0}
            max={59}
            value={recurrence.sendMinute}
            onChange={(e) =>
              onChange({ ...recurrence, sendMinute: Number(e.target.value) || 0 })
            }
            className={cn(campaignUi.input, "w-16")}
          />
          <select
            value={recurrence.ampm}
            onChange={(e) =>
              onChange({ ...recurrence, ampm: e.target.value as "AM" | "PM" })
            }
            className={cn(campaignUi.input, "w-20")}
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>
      </div>
      {recurrence.unit === "weeks" ? (
        <div className="flex gap-1">
          {WEEKDAYS.map((d, i) => {
            const active = recurrence.weekdays?.includes(i) ?? false;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const days = recurrence.weekdays || [];
                  const next = active ? days.filter((x) => x !== i) : [...days, i];
                  onChange({ ...recurrence, weekdays: next });
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold",
                  active ? "bg-[#6366f1] text-white" : "bg-[#e5e7eb] text-[#6b7280]",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      ) : null}
      <div>
        <label className="text-[12px] font-medium text-[#6b7280]">Ending</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {(["never", "on", "after"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ ...recurrence, endMode: mode })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize",
                recurrence.endMode === mode
                  ? "bg-[#6366f1] text-white"
                  : "border border-[#e5e7eb] text-[#6b7280]",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
