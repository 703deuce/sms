"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Paperclip, Smile, Braces, Sparkles, Send, ChevronRight, Megaphone, HelpCircle, Loader2 } from "lucide-react";
import AudiencePicker from "./AudiencePicker";
import AIComposeModal from "./AIComposeModal";
import PhonePreview from "./PhonePreview";
import { MediaPicker } from "@/components/messaging/media-picker";
import { TestMessageModal } from "@/components/campaigns/broadcast/test-message-modal";
import {
  composeMessageBody,
  defaultComposeDraft,
  loadComposeDraft,
  saveComposeDraft,
  startFreshComposeDraft,
  type CampaignComposeDraft,
} from "@/lib/campaigns/compose-draft";
import { getCampaignCategory } from "@/lib/campaigns/catalog";
import { seedBroadcastComposeFromPlaybook } from "@/lib/campaigns/playbook-broadcast";
import { estimateSmsSegments } from "@/lib/utils";
import { V1Breadcrumb, V1PageHeader } from "@/components/v1/v1-polish";
import { PLAYBOOK_EMOJIS } from "@/lib/v1/playbook-emojis";
import RecurringModal from "./RecurringModal";
import { formatRecurrenceSummary, validateRecurrence } from "@/lib/campaigns/recurrence-format";
import { zonedIsoToLocalDateTime } from "@/lib/campaigns/schedule-time";
import {
  loadDefaultSendingNumber,
  previewAudience,
  saveCampaignDraft,
  draftAudiencePayload,
  type CampaignNavPaths,
} from "@/lib/campaigns/kimi-campaigns-adapter";

type SendMode = "Now" | "Later" | "Recurring";

const COMMON_EMOJIS = ["😀", "🎉", "❤️", "👍", "🔥", "✨", "📣", "🎁", "💰", "📅", "👋", "⭐"];

const MERGE_FIELDS = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Company", value: "{{company}}" },
  { label: "Email", value: "{{email}}" },
];

function modeToSchedule(mode: SendMode): CampaignComposeDraft["scheduleMode"] {
  if (mode === "Later") return "later";
  if (mode === "Recurring") return "recurring";
  return "now";
}

function scheduleToMode(mode: CampaignComposeDraft["scheduleMode"]): SendMode {
  if (mode === "later") return "Later";
  if (mode === "recurring") return "Recurring";
  return "Now";
}

export default function CreateCampaign({
  onCancel,
  paths,
}: {
  onCancel: () => void;
  paths?: CampaignNavPaths;
}) {
  const router = useRouter();
  const homePath = paths?.homePath ?? "/campaigns";
  const reviewPath = paths?.reviewPath ?? ((id: string) => `/campaigns/new/review?id=${id}`);
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<CampaignComposeDraft>(defaultComposeDraft);
  const [mode, setMode] = useState<SendMode>("Now");
  const [showAI, setShowAI] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringSummary, setRecurringSummary] = useState("");
  const [trackPrompt, setTrackPrompt] = useState<string | null>(null);
  const [pendingTrackUrl, setPendingTrackUrl] = useState<string | null>(null);
  const [linkName, setLinkName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [error, setError] = useState("");
  const [audiencePreviewError, setAudiencePreviewError] = useState("");
  const [eligibleCount, setEligibleCount] = useState(0);
  const [playbookId, setPlaybookId] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Array<{ id: string; number: string }>>([]);

  useEffect(() => {
    const playbook = searchParams.get("playbook");
    const duplicateId = searchParams.get("duplicate");
    const editId = searchParams.get("edit");
    const segmentId = searchParams.get("segmentId");
    const loadId = duplicateId || editId;
    const fromPlaybook = Boolean(playbook && !duplicateId && !editId);
    const isFreshCreate = !loadId && !fromPlaybook && !segmentId;
    setPlaybookId(fromPlaybook ? playbook : null);

    let loaded = isFreshCreate || segmentId ? startFreshComposeDraft() : loadComposeDraft();
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

    const applySegmentAudience = (seg: { id: string; name: string }) => {
      setDraft((d) => {
        const next: CampaignComposeDraft = {
          ...d,
          name: d.name || `${seg.name} Campaign`,
          audience: [{ type: "segment", id: seg.id, name: seg.name }],
        };
        saveComposeDraft(next);
        return next;
      });
    };

    if (segmentId) {
      fetch("/api/contacts/segments")
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const seg = (json?.data || []).find((s: { id: string; name: string }) => s.id === segmentId);
          if (seg) applySegmentAudience(seg);
        })
        .catch(() => undefined);
    }

    if (loadId) {
      setLoadingCampaign(true);
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
                include?: Array<{ type: CampaignComposeDraft["audience"][0]["type"]; id: string; name: string }>;
                exclude?: Array<{ type: CampaignComposeDraft["audience"][0]["type"]; id: string; name: string }>;
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
          const tz = config?.timezone || loaded.timezone;
          const scheduleMode = duplicateId ? "now" : config?.scheduleMode || "now";
          let scheduledDate: string | undefined;
          let scheduledTime: string | undefined;
          if (c.scheduledAt && scheduleMode === "later") {
            const local = zonedIsoToLocalDateTime(c.scheduledAt, tz);
            scheduledDate = local.date;
            scheduledTime = local.time;
          }
          const next: CampaignComposeDraft = {
            ...defaultComposeDraft(),
            campaignId: editId ? c.id : undefined,
            name: duplicateId ? `${c.name} (copy)` : c.name,
            message: c.body.replace(/\n\nReply STOP to opt out\. Msg & data rates may apply\./i, ""),
            audience: include.map((a) => ({ type: a.type, id: a.id, name: a.name })),
            excludeAudience: (config?.audience?.exclude || []).map((a) => ({
              type: a.type,
              id: a.id,
              name: a.name,
            })),
            numberId: config?.numberId || "",
            mediaUrls: config?.mediaUrls || [],
            trackedLinks: config?.trackedLinks || [],
            scheduleMode,
            timezone: tz,
            recurrence: config?.recurrence,
            scheduledDate,
            scheduledTime,
          };
          saveComposeDraft(next);
          setDraft(next);
          setMode(scheduleToMode(next.scheduleMode));
          if (next.recurrence) {
            setRecurringSummary(formatRecurrenceSummary(next.recurrence, next.timezone));
          }
        })
        .catch(() => setError("Could not load campaign"))
        .finally(() => setLoadingCampaign(false));
    } else {
      setDraft(loaded);
      setMode(scheduleToMode(loaded.scheduleMode));
      if (loaded.recurrence) {
        setRecurringSummary(formatRecurrenceSummary(loaded.recurrence, loaded.timezone));
      }
    }

    loadDefaultSendingNumber().then((num) => {
      if (!num) return;
      setDraft((d) => {
        if (d.numberId) return d;
        const next = { ...d, numberId: num.id, senderLabel: num.number };
        saveComposeDraft(next);
        return next;
      });
    });

    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        const rows = (json.data || []).map((n: { id: string; number: string }) => ({
          id: n.id,
          number: n.number,
        }));
        setNumbers(rows);
      })
      .catch(() => setNumbers([]));
  }, [searchParams]);

  useEffect(() => {
    if (draft.audience.length === 0) {
      setEligibleCount(0);
      setAudiencePreviewError("");
      return;
    }
    let cancelled = false;
    setAudiencePreviewError("");
    previewAudience(draftAudiencePayload(draft), draft.campaignId)
      .then((count) => { if (!cancelled) setEligibleCount(count); })
      .catch((err) => {
        if (!cancelled) {
          setEligibleCount(0);
          setAudiencePreviewError(err instanceof Error ? err.message : "Could not preview audience");
        }
      });
    return () => { cancelled = true; };
  }, [draft.audience, draft.excludeAudience, draft.campaignId]);

  function updateDraft(patch: Partial<CampaignComposeDraft>) {
    setDraft((d) => {
      const next = { ...d, ...patch };
      saveComposeDraft(next);
      return next;
    });
  }

  const previewBody = composeMessageBody(
    draft.message.replace(/\{\{first_name\}\}/gi, "Anthony"),
  );
  const { characters, segments } = estimateSmsSegments(previewBody);
  const isMms = draft.mediaUrls.length > 0;
  const limit = isMms ? 1600 : 402;

  const handleMessageChange = (v: string) => {
    updateDraft({ message: v });
    const m = v.match(/(https?:\/\/[^\s]+|www\.[a-z0-9.-]+\.[a-z]{2,})/i);
    if (m && !v.includes("stxt.io")) setTrackPrompt(m[1]);
    else setTrackPrompt(null);
  };

  const insertTag = (tag: string) => {
    updateDraft({ message: `${draft.message} ${tag}`.trim() });
    setShowMerge(false);
  };

  const insertEmoji = (emoji: string) => {
    updateDraft({ message: `${draft.message}${emoji}` });
    setShowEmoji(false);
  };

  async function persistDraft(): Promise<string | null> {
    setSaving(true);
    setError("");
    try {
      const id = await saveCampaignDraft(draft);
      updateDraft({ campaignId: id });
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save campaign");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    const id = await persistDraft();
    if (id) router.push(homePath);
  }

  async function handleReview() {
    const next = { ...draft, scheduleMode: modeToSchedule(mode) };
    setDraft(next);
    saveComposeDraft(next);
    setSaving(true);
    setError("");
    try {
      const id = await saveCampaignDraft(next);
      router.push(reviewPath(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save campaign");
    } finally {
      setSaving(false);
    }
  }

  const laterIncomplete =
    mode === "Later" && (!draft.scheduledDate || !draft.scheduledTime);
  const recurringIncomplete =
    mode === "Recurring" && Boolean(validateRecurrence(draft.recurrence));
  const canReview =
    !loadingCampaign &&
    !saving &&
    Boolean(draft.name.trim()) &&
    Boolean(draft.message.trim()) &&
    draft.audience.length > 0 &&
    Boolean(draft.numberId) &&
    !laterIncomplete &&
    !recurringIncomplete;

  const scheduleModes: SendMode[] = ["Now", "Later", "Recurring"];

  const playbookCategory = playbookId ? getCampaignCategory(playbookId) : undefined;
  const playbookEmoji =
    playbookCategory && playbookCategory.id in PLAYBOOK_EMOJIS
      ? PLAYBOOK_EMOJIS[playbookCategory.id as keyof typeof PLAYBOOK_EMOJIS]
      : "📣";
  const messageHasMergeFields = /\{\{[^}]+\}\}/.test(draft.message);

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb] px-10 py-8">
      {showAI && (
        <AIComposeModal
          onClose={() => setShowAI(false)}
          onUse={(m) => { updateDraft({ message: m }); setShowAI(false); }}
        />
      )}
      <TestMessageModal
        open={showTest}
        onClose={() => setShowTest(false)}
        message={composeMessageBody(draft.message)}
        numberId={draft.numberId}
      />
      {showMedia && (
        <MediaPicker
          open={showMedia}
          onClose={() => setShowMedia(false)}
          initialSelected={draft.mediaUrls}
          onConfirm={(urls) => { updateDraft({ mediaUrls: urls }); setShowMedia(false); }}
        />
      )}
      {recurringOpen ? (
        <RecurringModal
          timezone={draft.timezone}
          initial={draft.recurrence}
          onClose={() => setRecurringOpen(false)}
          onSet={(recurrence, summary) => {
            updateDraft({ recurrence, scheduleMode: "recurring" });
            setRecurringSummary(summary);
            setRecurringOpen(false);
          }}
        />
      ) : null}

      <div className="mx-auto max-w-[1100px]">
        {playbookCategory ? (
          <V1Breadcrumb
            items={[
              { label: "Playbooks", href: "/playbooks" },
              { label: playbookCategory.title },
            ]}
          />
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-slate-400">
              Campaigns <span className="mx-1 text-slate-300">/</span>{" "}
              <span className="font-medium text-slate-600">Create Campaign</span>
            </p>
            <a
              href="https://docs.textingplatform.com/campaigns"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              aria-label="Campaign help"
            >
              <HelpCircle className="h-4 w-4 text-slate-400" />
            </a>
          </div>
        )}

      <div className="mt-4 grid grid-cols-[1fr_360px] gap-14">
        <div>
          {playbookCategory ? (
            <V1PageHeader
              emoji={playbookEmoji}
              title={playbookCategory.title}
              description={`${playbookCategory.description} Pre-filled name and message — customize before sending.`}
            />
          ) : (
            <>
              <h1 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-50">
                  <Megaphone className="h-5 w-5 text-indigo-600" />
                </span>
                Create Campaign
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Create a campaign to reach your contacts at scale.
              </p>
            </>
          )}

          <label className="block text-[13px] font-semibold text-slate-700 mt-7 mb-1.5">Campaign Name</label>
          <input
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="Black Friday Dress Sale"
            className="input-field max-w-md"
          />

          <label className="block text-[13px] font-semibold text-slate-700 mt-5 mb-1.5">Send From</label>
          <div className="max-w-md">
            <select
              value={draft.numberId}
              onChange={(e) => {
                const selected = numbers.find((n) => n.id === e.target.value);
                updateDraft({
                  numberId: e.target.value,
                  senderLabel: selected?.number || "",
                });
              }}
              className="input-field !text-[13px]"
            >
              <option value="">Select a number</option>
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.number}
                </option>
              ))}
            </select>
          </div>

          <label className="block text-[13px] font-semibold text-slate-700 mt-5 mb-1.5">Audience</label>
          <div className="max-w-md">
            <AudiencePicker
              selected={draft.audience}
              onChange={(audience) => updateDraft({ audience })}
            />
            {eligibleCount > 0 && (
              <p className="mt-1.5 text-[12px] text-emerald-600">{eligibleCount.toLocaleString()} eligible contacts</p>
            )}
            {audiencePreviewError ? (
              <p className="mt-1.5 text-[12px] text-red-600">{audiencePreviewError}</p>
            ) : null}
          </div>

          <label className="block text-[13px] font-semibold text-slate-700 mt-5 mb-1.5">
            Exclude from audience
            <span className="ml-1.5 text-[11px] font-normal text-slate-400">(optional)</span>
          </label>
          <div className="max-w-md">
            <AudiencePicker
              mode="exclude"
              selected={draft.excludeAudience}
              onChange={(excludeAudience) => updateDraft({ excludeAudience })}
            />
          </div>

          <div className="flex items-center justify-between max-w-md mt-5 mb-1.5">
            <label className="text-[13px] font-semibold text-slate-700">Message</label>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
              {characters}/{limit} <span className="segment-badge">{segments}</span>
            </span>
          </div>
          <div className="max-w-md composer-box">
            <textarea
              value={draft.message}
              onChange={(e) => handleMessageChange(e.target.value)}
              placeholder="Write your message here. Use {{first_name}} to personalize each text."
              className="w-full h-36 resize-none outline-none p-3 text-[13.5px] leading-relaxed text-slate-800 placeholder:text-slate-400 rounded-t-xl bg-transparent"
            />
            {messageHasMergeFields ? (
              <p className="border-t border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[12px] leading-relaxed text-indigo-800">
                Starter template — replace placeholders like{" "}
                <span className="font-mono text-[11px]">{"{{first_name}}"}</span> with your own
                wording before sending.
              </p>
            ) : null}
            {trackPrompt && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/60">
                <span className="text-[12px] text-slate-500">Track the <span className="font-medium text-slate-700">{trackPrompt}</span> link?</span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingTrackUrl(trackPrompt);
                      setLinkName(trackPrompt);
                      setTrackPrompt(null);
                    }}
                    className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Yes
                  </button>
                  <button type="button" onClick={() => setTrackPrompt(null)} className="text-[12px] font-semibold text-slate-400 hover:text-slate-600">No</button>
                </span>
              </div>
            )}
            {pendingTrackUrl !== null && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50/60">
                <input
                  autoFocus
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Name your link"
                  className="flex-1 text-[12px] outline-none border-b border-indigo-300 focus:border-indigo-500 py-1 bg-transparent transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pendingTrackUrl) {
                      const tracked = [
                        ...draft.trackedLinks,
                        {
                          url: pendingTrackUrl,
                          name: linkName.trim() || pendingTrackUrl,
                          tracked: true,
                        },
                      ];
                      updateDraft({ trackedLinks: tracked });
                      setPendingTrackUrl(null);
                      setLinkName("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!pendingTrackUrl) return;
                    const tracked = [
                      ...draft.trackedLinks,
                      {
                        url: pendingTrackUrl,
                        name: linkName.trim() || pendingTrackUrl,
                        tracked: true,
                      },
                    ];
                    updateDraft({ trackedLinks: tracked });
                    setPendingTrackUrl(null);
                    setLinkName("");
                  }}
                  className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingTrackUrl(null);
                    setLinkName("");
                  }}
                  className="text-[12px] font-semibold text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="composer-toolbar relative flex items-center gap-1.5 px-2.5 py-2 border-t border-slate-100">
              <button type="button" title="Attach a File" aria-label="Attach a file" onClick={() => setShowMedia(true)}><Paperclip className="w-4 h-4" /></button>
              <div className="relative">
                <button type="button" title="Emojis" aria-label="Insert emoji" onClick={() => { setShowEmoji(!showEmoji); setShowMerge(false); }}><Smile className="w-4 h-4" /></button>
                {showEmoji && (
                  <div className="absolute bottom-9 left-0 z-20 grid grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-indigo-50 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button type="button" title="Merge Tags" aria-label="Insert merge tag" onClick={() => { setShowMerge(!showMerge); setShowEmoji(false); }}><Braces className="w-4 h-4" /></button>
                {showMerge && (
                  <div className="absolute bottom-9 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 w-64 p-2 fade-in">
                    {MERGE_FIELDS.map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => insertTag(t.value)}
                        className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-indigo-50 text-[13px] text-slate-700 transition-colors"
                      >
                        {t.label} <span className="text-[11px] text-slate-400 font-mono">{t.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" title="AI Compose" aria-label="AI compose" className="ai" onClick={() => setShowAI(true)}><Sparkles className="w-4 h-4" /></button>
              <button type="button" title="Send a Test" aria-label="Send test message" className="ml-auto" onClick={() => setShowTest(true)}><Send className="w-4 h-4" /></button>
            </div>
          </div>

          <label className="block text-[13px] font-semibold text-slate-700 mt-6 mb-2">When to Send</label>
          <div className="seg-toggle max-w-md">
            {scheduleModes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  updateDraft({ scheduleMode: modeToSchedule(m) });
                  if (m === "Recurring") setRecurringOpen(true);
                }}
                className={`flex-1 ${mode === m ? "on" : ""}`}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === "Later" && (
            <div className="flex flex-col gap-3 mt-4 max-w-md fade-in">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={draft.scheduledDate || ""}
                    onChange={(e) => updateDraft({ scheduledDate: e.target.value })}
                    className="input-field !text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={draft.scheduledTime || ""}
                    onChange={(e) => updateDraft({ scheduledTime: e.target.value })}
                    className="input-field !text-[13px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Timezone</label>
                <input
                  value={draft.timezone}
                  onChange={(e) => updateDraft({ timezone: e.target.value })}
                  className="input-field !text-[13px]"
                  placeholder="America/New_York"
                />
              </div>
            </div>
          )}

          {mode === "Recurring" ? (
            <div className="mt-4 max-w-md fade-in">
              {recurringSummary ? (
                <p className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-[12px] text-indigo-800">
                  <span>{recurringSummary}</span>
                  <button
                    type="button"
                    onClick={() => setRecurringOpen(true)}
                    className="ml-2 shrink-0 font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Edit
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setRecurringOpen(true)}
                  className="btn-ghost w-full border border-dashed border-indigo-200 text-indigo-600"
                >
                  Configure recurring schedule
                </button>
              )}
            </div>
          ) : null}

          {draft.mediaUrls.length > 0 ? (
            <p className="mt-3 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              MMS attachments may be blocked at review until MMS is enabled for your workspace.
            </p>
          ) : null}

          {!draft.numberId ? (
            <p className="mt-3 max-w-md text-[13px] text-amber-700">Select a send-from number before continuing.</p>
          ) : null}

          {laterIncomplete ? (
            <p className="mt-3 text-[13px] text-amber-700">Select a date and time to schedule this campaign.</p>
          ) : null}

          {recurringIncomplete ? (
            <p className="mt-3 text-[13px] text-amber-700">
              {validateRecurrence(draft.recurrence)}
            </p>
          ) : null}

          {error ? <p className="mt-4 text-[13px] text-red-600">{error}</p> : null}

          {loadingCampaign ? (
            <p className="mt-4 flex items-center gap-2 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading campaign…
            </p>
          ) : null}

          <div className="flex items-center justify-between max-w-md mt-12">
            <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={saving}
                className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => void handleReview()}
                disabled={!canReview}
                className="btn-primary flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Review <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <PhonePreview message={previewBody} mediaUrls={draft.mediaUrls} />
      </div>
      </div>
    </div>
  );
}
