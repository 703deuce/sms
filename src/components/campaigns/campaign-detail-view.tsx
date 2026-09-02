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
import { campaignDetailIsKimiBroadcast, campaignLooksLikeMassText } from "@/lib/campaigns/mass-text-detection";
import { mediaUrlsFromCampaignConfig } from "@/lib/mass-texting/mms";
import { MASS_TEXT_MMS_CREDIT_MULTIPLIER } from "@/lib/mass-texting/pricing";
import type { Campaign } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  estimateSmsSegments,
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  MessageSquare,
  MousePointerClick,
  Paperclip,
  Reply,
  Send,
  Smartphone,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
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
  icon: Icon,
  label,
  value,
  hint,
  hintTone = "text-emerald-600",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  hintTone?: string;
}) {
  return (
    <div className="surface rounded-xl bg-card p-4 transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 font-display text-[24px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className={cn("mt-1.5 text-[12px] font-medium tabular-nums", hintTone)}>{hint}</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-transparent select-none" aria-hidden>
          —
        </p>
      )}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface rounded-xl bg-card p-5", className)}>
      <h2 className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-display text-[14px] font-semibold tracking-tight text-foreground">
          {title}
        </span>
      </h2>
      {children}
    </section>
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
    <div className="mx-auto max-w-[1200px] px-1 pb-12">
      <V1Breadcrumb items={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]} />

      <V1PageHeader
        emoji={campaignStatusEmoji(campaign.status)}
        title={campaign.name}
        description={`${campaign.type} campaign · ${campaign.audience}`}
        actions={
          <>
            <Link href="/campaigns">
              <Button variant="ghost">← Back</Button>
            </Link>
            {campaign.status === "Draft" && campaignDetailIsKimiBroadcast(campaign.configJson) ? (
              <Link href={`/campaigns/new?edit=${campaignId}`}>
                <Button>Continue editing</Button>
              </Link>
            ) : null}
            {campaign.status !== "Draft" && campaignDetailIsKimiBroadcast(campaign.configJson) ? (
              <Link href={`/campaigns/new?duplicate=${campaignId}`}>
                <Button variant="outline">Duplicate</Button>
              </Link>
            ) : null}
            <CampaignActions
              campaignId={campaignId}
              status={campaign.status}
              isMassText={campaignLooksLikeMassText(campaign.configJson)}
            />
          </>
        }
      />

      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusChip status={campaign.status} />
        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
        <span className="text-[13px] text-muted-foreground">
          Created by <span className="font-medium text-foreground/80">{campaign.createdBy || "—"}</span>
        </span>
        {campaign.scheduledAt ? (
          <>
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {formatCampaignDateTime(campaign.scheduledAt)}
            </span>
          </>
        ) : null}
      </div>

      <div className="mb-6">
        {campaignLooksLikeMassText(campaign.configJson) ? (
          <CampaignLaunchReview campaignId={campaignId} status={campaign.status} />
        ) : null}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Send} label="Sent" value={formatNumber(campaign.sent)} />
        <KpiCard
          icon={CheckCircle2}
          label="Delivered"
          value={formatNumber(campaign.delivered)}
          hint={formatPercent(deliveryRate)}
        />
        <KpiCard
          icon={Reply}
          label="Replies"
          value={formatNumber(campaign.replies)}
          hint={formatPercent(replyRate)}
        />
        <KpiCard
          icon={MousePointerClick}
          label="Clicks"
          value={formatNumber(campaign.clicks)}
          hint={formatPercent(clickRate)}
        />
        <KpiCard
          icon={UserMinus}
          label="Opt-outs"
          value={formatNumber(campaign.optOuts)}
          hint={formatPercent(optOutRate)}
          hintTone={campaign.optOuts > 0 ? "text-orange-600" : "text-emerald-600"}
        />
        <KpiCard icon={Coins} label="Cost" value={formatCurrency(campaign.cost)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <SectionCard icon={BarChart3} title="Summary">
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Type", value: campaign.type },
                { label: "Audience", value: campaign.audience },
                { label: "Scheduled", value: formatCampaignDateTime(campaign.scheduledAt) },
                {
                  label: "Segments per message",
                  value: `${segments.segments} (${segments.characters} chars)`,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-border/60 bg-muted/25 px-3.5 py-3"
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-[13px] font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard icon={Smartphone} title="Message preview">
            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start">
              <div className="mx-auto w-full max-w-[280px] shrink-0">
                <div className="rounded-[28px] border border-slate-800 bg-slate-900 p-2 shadow-lg">
                  <div className="relative min-h-[220px] overflow-hidden rounded-[20px] bg-slate-50 px-3 pb-4 pt-8">
                    <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-900" aria-hidden />
                    {campaign.body ? (
                      <div className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] leading-relaxed text-primary-foreground shadow-sm">
                        {campaign.body}
                      </div>
                    ) : (
                      <p className="py-12 text-center text-[12px] text-muted-foreground">
                        No message body yet.
                      </p>
                    )}
                    {attachedMedia.length > 0 ? (
                      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                        {attachedMedia.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-[12px] leading-relaxed text-muted-foreground">
                <p>Preview includes compliance footer. Merge tags render at send time.</p>
                {attachedMedia.length > 0 ? (
                  <p className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden />
                    Pictures send as MMS ({MASS_TEXT_MMS_CREDIT_MULTIPLIER} credits each).
                  </p>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Reply,
                label: "Reply rate",
                value: formatPercent(replyRate),
                tone: "text-indigo-600 bg-indigo-50",
              },
              {
                icon: MousePointerClick,
                label: "Click rate",
                value: formatPercent(clickRate),
                tone: "text-violet-600 bg-violet-50",
              },
              {
                icon: UserMinus,
                label: "Opt-out rate",
                value: formatPercent(optOutRate),
                tone: "text-orange-600 bg-orange-50",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="surface flex items-center gap-3 rounded-xl bg-card p-4 transition-shadow duration-150 hover:shadow-md"
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", stat.tone)}>
                  <stat.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight text-foreground">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <SectionCard icon={Clock} title="Timeline">
            <ol className="mt-5 space-y-0">
              {timeline.map((event, idx) => (
                <li key={idx} className="relative pb-5 pl-9 last:pb-0">
                  {idx < timeline.length - 1 ? (
                    <span
                      className="absolute bottom-0 left-[11px] top-7 w-px bg-border"
                      aria-hidden
                    />
                  ) : null}
                  <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[12px] ring-1 ring-primary/15">
                    {event.emoji}
                  </span>
                  <p className="text-[13px] font-semibold leading-6 text-foreground">
                    {event.label}
                  </p>
                  <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
                    {formatCampaignDateTime(event.at)}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {event.detail}
                  </p>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard icon={Coins} title="Cost breakdown">
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Messages sent</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {formatNumber(campaign.sent)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Segments per message</dt>
                <dd className="font-medium tabular-nums text-foreground">{segments.segments}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Rate per segment</dt>
                <dd className="font-medium tabular-nums text-foreground">$0.015</dd>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                <dt className="font-semibold text-foreground">Total cost</dt>
                <dd className="font-display text-[16px] font-semibold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(campaign.cost)}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard icon={MessageSquare} title="Activity log">
            {activity.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                <p className="text-[13px] font-medium text-foreground">No activity yet</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Events will appear here as the campaign runs.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {activity.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium text-foreground">{row.event}</p>
                      <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatCampaignDateTime(row.at)}
                      </p>
                    </div>
                    {row.detail ? (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {row.detail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
