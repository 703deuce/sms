import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { CampaignLaunchReview } from "@/components/campaigns/campaign-launch-review";
import { V1Breadcrumb, V1PageHeader } from "@/components/v1/v1-polish";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  buildCampaignTimeline,
  campaignStatusEmoji,
  formatCampaignDateTime,
} from "@/lib/campaigns/campaign-detail-helpers";
import { campaignLooksLikeMassText } from "@/lib/campaigns/mass-text-detection";
import { mediaUrlsFromCampaignConfig } from "@/lib/mass-texting/mms";
import { MASS_TEXT_MMS_CREDIT_MULTIPLIER } from "@/lib/mass-texting/pricing";
import type { Campaign } from "@/lib/types";
import {
  estimateSmsSegments,
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import { Clock, MessageSquare, MousePointerClick, Reply, UserMinus } from "lucide-react";
import Link from "next/link";

type AuditLogRow = {
  id: string;
  event: string;
  detail?: string | null;
  at: string;
};

type Props = {
  campaign: Campaign;
  campaignId: string;
  activity: AuditLogRow[];
};

function KpiCard({
  emoji,
  label,
  value,
  hint,
}: {
  emoji: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
      <p className="text-[12px] font-medium text-muted-foreground">
        {emoji} {label}
      </p>
      <p className="mt-1 text-[24px] font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-emerald-600">{hint}</p> : null}
    </div>
  );
}

export function CampaignDetailView({ campaign, campaignId, activity }: Props) {
  const deliveryRate = campaign.sent > 0 ? (campaign.delivered / campaign.sent) * 100 : 0;
  const replyRate = campaign.delivered > 0 ? (campaign.replies / campaign.delivered) * 100 : 0;
  const clickRate = campaign.delivered > 0 ? (campaign.clicks / campaign.delivered) * 100 : 0;
  const optOutRate = campaign.delivered > 0 ? (campaign.optOuts / campaign.delivered) * 100 : 0;
  const segments = estimateSmsSegments(campaign.body);
  const timeline = buildCampaignTimeline(campaign);
  const attachedMedia = mediaUrlsFromCampaignConfig(campaign.configJson);

  return (
    <div className="mx-auto max-w-[1200px] px-1 pb-10">
      <V1Breadcrumb items={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]} />

      <V1PageHeader
        emoji={campaignStatusEmoji(campaign.status)}
        title={campaign.name}
        description={`${campaign.type} campaign · ${campaign.audience}`}
        actions={
          <>
            <Link href="/campaigns">
              <Button variant="outline">← Back</Button>
            </Link>
            {campaign.status === "Draft" ? (
              <Link href={`/campaigns/new?edit=${campaignId}`}>
                <Button>Continue editing</Button>
              </Link>
            ) : (
              <Link href={`/campaigns/new?duplicate=${campaignId}`}>
                <Button variant="outline">Duplicate</Button>
              </Link>
            )}
            <CampaignActions
              campaignId={campaignId}
              status={campaign.status}
              isMassText={campaignLooksLikeMassText(campaign.configJson)}
            />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChip status={campaign.status} />
        <span className="text-[13px] text-muted-foreground">
          Created by {campaign.createdBy || "—"}
        </span>
        {campaign.scheduledAt ? (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatCampaignDateTime(campaign.scheduledAt)}
          </span>
        ) : null}
      </div>

      <div className="mb-6">
        <CampaignLaunchReview campaignId={campaignId} status={campaign.status} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard emoji="📤" label="Sent" value={formatNumber(campaign.sent)} />
        <KpiCard emoji="✅" label="Delivered" value={formatNumber(campaign.delivered)} hint={formatPercent(deliveryRate)} />
        <KpiCard emoji="💬" label="Replies" value={formatNumber(campaign.replies)} hint={formatPercent(replyRate)} />
        <KpiCard emoji="👆" label="Clicks" value={formatNumber(campaign.clicks)} hint={formatPercent(clickRate)} />
        <KpiCard emoji="🚫" label="Opt-outs" value={formatNumber(campaign.optOuts)} hint={formatPercent(optOutRate)} />
        <KpiCard emoji="💰" label="Cost" value={formatCurrency(campaign.cost)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span>📊</span> Summary
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                { label: "Type", value: campaign.type },
                { label: "Audience", value: campaign.audience },
                { label: "Scheduled", value: formatCampaignDateTime(campaign.scheduledAt) },
                {
                  label: "Segments per message",
                  value: `${segments.segments} (${segments.characters} chars)`,
                },
              ].map((row) => (
                <div key={row.label} className="rounded-[10px] bg-muted/30 px-3 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-[13px] font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span>📱</span> Message preview
            </h2>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="mx-auto w-full max-w-[280px] shrink-0 rounded-[24px] border-[6px] border-slate-800 bg-slate-900 p-3 shadow-lg">
                <div className="min-h-[200px] rounded-[16px] bg-slate-50 px-3 py-4">
                  {campaign.body ? (
                    <div className="ml-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-[13px] leading-relaxed text-white">
                      {campaign.body}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-[12px] text-muted-foreground">No message body yet.</p>
                  )}
                  {attachedMedia.length > 0 ? (
                    <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                      {attachedMedia.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 text-[12px] leading-relaxed text-muted-foreground">
                <p>Preview includes compliance footer. Merge tags render at send time.</p>
                {attachedMedia.length > 0 ? (
                  <p className="mt-2">
                    📎 Pictures send as MMS ({MASS_TEXT_MMS_CREDIT_MULTIPLIER} credits each).
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Reply, label: "Reply rate", value: formatPercent(replyRate), tone: "text-indigo-600 bg-indigo-50" },
              { icon: MousePointerClick, label: "Click rate", value: formatPercent(clickRate), tone: "text-violet-600 bg-violet-50" },
              { icon: UserMinus, label: "Opt-out rate", value: formatPercent(optOutRate), tone: "text-orange-600 bg-orange-50" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 rounded-[14px] border border-border bg-card p-4 shadow-sm">
                <div className={`rounded-[10px] p-2 ${stat.tone}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  <p className="text-[18px] font-bold tabular-nums">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span>🕐</span> Timeline
            </h2>
            <ol className="mt-4 space-y-4">
              {timeline.map((event, idx) => (
                <li key={idx} className="relative pl-8">
                  {idx < timeline.length - 1 ? (
                    <span className="absolute left-[11px] top-6 h-full w-px bg-border" />
                  ) : null}
                  <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[12px]">
                    {event.emoji}
                  </span>
                  <p className="text-[13px] font-semibold text-foreground">{event.label}</p>
                  <p className="text-[11px] text-muted-foreground">{formatCampaignDateTime(event.at)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{event.detail}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span>💰</span> Cost breakdown
            </h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Messages sent</dt>
                <dd className="font-medium tabular-nums">{formatNumber(campaign.sent)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Segments per message</dt>
                <dd className="font-medium tabular-nums">{segments.segments}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rate per segment</dt>
                <dd className="font-medium">$0.015</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="font-semibold text-foreground">Total cost</dt>
                <dd className="text-[16px] font-bold tabular-nums text-foreground">
                  {formatCurrency(campaign.cost)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              Activity log
            </h2>
            {activity.length === 0 ? (
              <p className="mt-4 text-[13px] text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {activity.map((log) => (
                  <li key={log.id} className="rounded-[10px] border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-[13px] font-medium text-foreground">{log.event}</p>
                    <p className="text-[11px] text-muted-foreground">{formatCampaignDateTime(log.at)}</p>
                    {log.detail ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{log.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
