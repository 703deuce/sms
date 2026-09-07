"use client";

import { useMemo } from "react";
import { Lock, Play, Save, Trash2 } from "lucide-react";
import { mergeTags, type RecallCampaign } from "../types";

const inputCls =
  "flex h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--ring))]/30 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70";

const labelCls = "mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90";

export function CampaignEditor({
  campaign,
  acting,
  dirty,
  readOnly = false,
  onChange,
  onSave,
  onRun,
  onDelete,
}: {
  campaign: RecallCampaign;
  acting: boolean;
  dirty: boolean;
  readOnly?: boolean;
  onChange: (c: RecallCampaign) => void;
  onSave: () => void;
  onRun: () => void;
  onDelete: () => void;
}) {
  const set = (patch: Partial<RecallCampaign>) => onChange({ ...campaign, ...patch });
  const setSegment = (patch: NonNullable<RecallCampaign["segment"]> | Partial<RecallCampaign["segment"]>) =>
    onChange({ ...campaign, segment: { ...campaign.segment, ...patch } });

  const segments = useMemo(() => estimateSegments(campaign), [campaign]);

  const preview = useMemo(
    () => renderPreview(campaign),
    [campaign],
  );

  const segmentSummary = useMemo(() => {
    const days = campaign.segment?.lastVisitDaysAgo ?? 90;
    const parts = [
      `Contacts whose last visit was at least ${days} days ago`,
    ];
    if (campaign.segment?.appointmentTypeName) {
      parts.push(`whose last appointment was “${campaign.segment.appointmentTypeName}”`);
    }
    if (campaign.segment?.noFutureAppointment !== false) {
      parts.push("and who have no upcoming appointment");
    }
    return parts.join(" ");
  }, [campaign.segment]);

  const disabled = acting || readOnly;

  return (
    <section
      className="surface rounded-xl bg-card lg:col-span-2"
      aria-labelledby="rc-editor-title"
    >
      {/* Editor header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 id="rc-editor-title" className="font-display text-sm font-semibold tracking-tight">
            Edit campaign
          </h2>
          {readOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Read-only
            </span>
          )}
          {dirty && !readOnly && (
            <span className="text-xs font-medium text-[hsl(var(--warning))]">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] font-medium text-foreground/90">
            <span>{campaign.active ? "Active" : "Paused"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={campaign.active}
              aria-label={campaign.active ? "Pause campaign" : "Activate campaign"}
              className={`rc-toggle ${campaign.active ? "on" : ""}`}
              disabled={disabled}
              onClick={() => set({ active: !campaign.active })}
            />
          </label>
        </div>
      </div>

      {readOnly && (
        <div className="rc-banner rc-banner-info mx-5 mt-4" role="status">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            You have view access to recall campaigns. Ask a workspace owner or admin to
            change campaign settings.
          </span>
        </div>
      )}

      <div className="grid gap-6 px-5 py-5 xl:grid-cols-[1fr_300px]">
        {/* Form column */}
        <div className="space-y-5">
          <div>
            <label className={labelCls} htmlFor="rc-name">Name</label>
            <input
              id="rc-name"
              className={inputCls}
              value={campaign.name}
              disabled={readOnly}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. 90-day win-back"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="rc-channel">Channel</label>
              <select
                id="rc-channel"
                className={inputCls}
                value={campaign.channel}
                disabled={readOnly}
                onChange={(e) => set({ channel: e.target.value as "sms" | "email" })}
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="rc-days">Days since last visit</label>
              <input
                id="rc-days"
                type="number"
                min={1}
                className={inputCls}
                value={campaign.segment?.lastVisitDaysAgo ?? 90}
                disabled={readOnly}
                onChange={(e) =>
                  setSegment({ lastVisitDaysAgo: Number(e.target.value) || 90 })
                }
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="rc-type">Appointment type (optional)</label>
            <input
              id="rc-type"
              className={inputCls}
              placeholder="Only contacts whose last visit was this service"
              value={campaign.segment?.appointmentTypeName ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                setSegment({ appointmentTypeName: e.target.value || undefined })
              }
            />
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
              checked={campaign.segment?.noFutureAppointment !== false}
              disabled={readOnly}
              onChange={(e) => setSegment({ noFutureAppointment: e.target.checked })}
            />
            <span>
              Only contacts with no upcoming appointment
              <span className="block text-xs font-normal text-muted-foreground">
                Prevents messaging people who are already booked.
              </span>
            </span>
          </label>

          <div className="rc-seg-preview" aria-live="polite">
            <strong>Audience:</strong> {segmentSummary}.
          </div>

          <div>
            <label className={labelCls} htmlFor="rc-max">Max recipients per run (optional)</label>
            <input
              id="rc-max"
              type="number"
              min={1}
              className={inputCls}
              placeholder="No limit"
              value={campaign.maxRecipients ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                set({ maxRecipients: e.target.value ? Number(e.target.value) : undefined })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Caps each run so you can pace outreach and manage volume.
            </p>
          </div>

          {campaign.channel === "email" && (
            <div>
              <label className={labelCls} htmlFor="rc-subject">Subject</label>
              <input
                id="rc-subject"
                className={inputCls}
                value={campaign.subject ?? ""}
                disabled={readOnly}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="We miss you at {{business_name}}"
              />
            </div>
          )}

          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelCls} htmlFor="rc-message">Message</label>
              <span className="text-xs text-muted-foreground">
                {segments.characters} characters
                {campaign.channel === "sms" ? ` · ${segments.segments} SMS segment${segments.segments === 1 ? "" : "s"}` : ""}
              </span>
            </div>
            <textarea
              id="rc-message"
              className={`${inputCls} min-h-28 py-2.5 leading-relaxed`}
              value={campaign.messageTemplate}
              disabled={readOnly}
              onChange={(e) => set({ messageTemplate: e.target.value })}
            />
            {!readOnly && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Insert:</span>
                {mergeTags.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    className="rc-merge-tag"
                    title={t.description}
                    onClick={() =>
                      set({
                        messageTemplate: campaign.messageTemplate + (campaign.messageTemplate.endsWith(" ") || campaign.messageTemplate === "" ? "" : " ") + t.tag,
                      })
                    }
                  >
                    {t.tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {campaign.channel === "sms" && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Messages are only sent to contacts with SMS consent on file. Contacts who
              have opted out are automatically excluded, and future sends stop if a
              contact replies STOP.
            </p>
          )}

          {/* Danger zone */}
          {!readOnly && (
            <div className="rounded-xl border border-red-200 bg-red-50/40 px-4 py-3.5">
              <p className="text-[13px] font-semibold text-[hsl(var(--danger))]">Danger zone</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Deleting this campaign removes its settings and run history. Contacts
                already messaged are not affected.
              </p>
              <button
                type="button"
                onClick={onDelete}
                disabled={disabled}
                className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-card px-3 text-[13px] font-semibold text-[hsl(var(--danger))] transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete campaign
              </button>
            </div>
          )}
        </div>

        {/* Preview column */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {campaign.channel === "sms" ? "Message preview" : "Email preview"}
          </p>
          {campaign.channel === "sms" ? (
            <div className="rc-phone">
              <div className="rc-phone-notch" aria-hidden="true" />
              <div className="rc-bubble">{preview.body || "Your message will appear here."}</div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Sample with merge tags filled in
              </p>
            </div>
          ) : (
            <div className="rc-email-preview">
              <div className="rc-email-preview-header">
                <div className="text-xs text-muted-foreground">
                  From: <span className="font-medium text-foreground">Bright Dental Studio</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Subject: <span className="font-medium text-foreground">{preview.subject || "(no subject)"}</span>
                </div>
              </div>
              <div className="rc-email-preview-body">
                {preview.body || "Your message will appear here."}
              </div>
            </div>
          )}

          {campaign.lastRunAt && (
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Last run
              </p>
              <p className="mt-1 text-[13px] font-medium">
                {new Date(campaign.lastRunAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {typeof campaign.lastRunSent === "number" && (
                  <span className="text-muted-foreground"> · {campaign.lastRunSent} messages sent</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Run now
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={onSave}
            disabled={acting || !dirty}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[hsl(var(--primary-hover))] disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {acting ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </section>
  );
}

function estimateSegments(c: RecallCampaign) {
  const body = c.messageTemplate ?? "";
  const length = body.length;
  if (length === 0) return { characters: 0, segments: 0 };
  const isUnicode = /[^\x00-\x7F]/.test(body);
  const limit = isUnicode ? 70 : 160;
  const concatLimit = isUnicode ? 67 : 153;
  if (length <= limit) return { characters: length, segments: 1 };
  return { characters: length, segments: Math.ceil(length / concatLimit) };
}

function renderPreview(c: RecallCampaign) {
  const sample: Record<string, string> = {
    "{{first_name}}": "Sarah",
    "{{business_name}}": "Bright Dental Studio",
    "{{booking_link}}": "transovo.com/book/bright-dental",
    "{{appointment_type}}": c.segment?.appointmentTypeName ?? "Cleaning",
  };
  let body = c.messageTemplate ?? "";
  let subject = c.subject ?? "";
  for (const [tag, value] of Object.entries(sample)) {
    body = body.split(tag).join(value);
    subject = subject.split(tag).join(value);
  }
  return { body, subject };
}
