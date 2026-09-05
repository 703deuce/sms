import { StatusChip } from "@/components/ui/status-chip";
import { LeadDetailTabs } from "@/components/realtor/lead-detail-tabs";
import type { RealtorLeadStatus } from "@/lib/realtor/types";
import { formatPhone } from "@/lib/utils";
import {
  Calendar,
  Check,
  ChevronRight,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export type LeadTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  href?: string;
  kind: "call" | "sms" | "ai" | "lead" | "appointment";
};

export type LeadAppointmentRow = {
  id: string;
  startsAt: string;
  serviceName: string;
};

function fieldLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RealtorLeadDetailView({
  leadId,
  name,
  status,
  intent,
  source,
  phone,
  email,
  assignedTo,
  createdAt,
  leadScore,
  profileFields,
  appointments,
  timeline,
  needsAction,
  tags,
  activeTab = "overview",
}: {
  leadId: string;
  name: string;
  status: RealtorLeadStatus;
  intent?: string;
  source?: string;
  phone: string;
  email?: string | null;
  assignedTo?: string;
  createdAt?: string;
  leadScore: number;
  profileFields: Array<{ key: string; label: string; value: string }>;
  appointments: LeadAppointmentRow[];
  timeline: LeadTimelineEvent[];
  needsAction?: { title: string; detail: string };
  tags: string[];
  activeTab?: string;
}) {
  const scoreLabel = leadScore >= 85 ? "Excellent" : leadScore >= 70 ? "Good" : "Fair";

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[#6b7280]">
        <Link href="/realtor/leads" className="hover:text-[#6366f1]">Leads</Link>
        <span className="mx-1">/</span>
        <span className="text-[#111827]">{name}</span>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold text-[#111827]">{name}</h1>
            {leadScore >= 80 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                🔥 Hot Lead
              </span>
            ) : null}
            <StatusChip status={status} />
          </div>
          <p className="mt-1 text-[14px] text-[#6b7280]">
            {intent ? `${intent} Lead` : "Lead"}
            {source ? ` • ${source} Lead` : ""}
            {createdAt ? ` • Created ${new Date(createdAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[4px] border-[#14b8a6]">
              <span className="text-[22px] font-bold text-[#111827]">{leadScore}</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">Lead Score</p>
            <p className="text-[11px] text-[#14b8a6]">{scoreLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/phone?contact=${leadId}`} className="realtor-btn-primary">
              <Phone className="h-4 w-4" />
              Call
            </Link>
            <Link href={`/conversations?contact=${leadId}`} className="realtor-btn-outline">
              Text
            </Link>
            <Link
              href={email ? `mailto:${email}` : `/send/quick?contact=${leadId}`}
              className="realtor-btn-outline"
            >
              <Mail className="h-4 w-4" />
              Email
            </Link>
            <Link
              href="/realtor/test"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 text-[13px] font-semibold text-purple-700"
            >
              <Sparkles className="h-4 w-4" />
              Have Amy Call
            </Link>
            <button type="button" className="realtor-btn-outline px-2">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="h-9 border-b border-[#e5e7eb]" />}>
        <LeadDetailTabs
          activityCount={timeline.length}
          appointmentCount={appointments.length}
          notesCount={2}
          tasksCount={needsAction ? 3 : 0}
        />
      </Suspense>

      {activeTab !== "overview" ? (
        <div className="realtor-card p-8 text-center text-[14px] text-[#6b7280]">
          {activeTab === "activity" ? (
            <ActivityPanel timeline={timeline} />
          ) : activeTab === "appointments" ? (
            <div className="space-y-3 text-left">
              {appointments.map((a) => (
                <div key={a.id} className="rounded-lg border border-[#e5e7eb] p-4">
                  <p className="font-semibold">{a.serviceName}</p>
                  <p className="text-[13px] text-[#6b7280]">
                    {new Date(a.startsAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>
              Open this section from the lead hub — content for &ldquo;{activeTab}&rdquo; loads here.
            </p>
          )}
        </div>
      ) : (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Contact Information</h3>
            <ul className="mt-3 space-y-3 text-[13px]">
              <li className="flex gap-2">
                <Phone className="h-4 w-4 shrink-0 text-[#14b8a6]" />
                <span>{formatPhone(phone)}</span>
              </li>
              {email ? (
                <li className="flex gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-[#6366f1]" />
                  <span>{email}</span>
                </li>
              ) : null}
              {profileFields.find((f) => f.key.includes("area")) ? (
                <li className="flex gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{profileFields.find((f) => f.key.includes("area"))?.value}</span>
                </li>
              ) : null}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] text-[#374151]">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Buyer Profile</h3>
            <dl className="mt-3 grid gap-2 text-[13px]">
              {profileFields.map((f) => (
                <div key={f.key} className="flex justify-between gap-2 border-b border-[#f3f4f6] py-2 last:border-0">
                  <dt className="text-[#6b7280]">{f.label}</dt>
                  <dd className="font-medium text-[#111827]">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Assignment</h3>
            <p className="mt-2 text-[13px] font-medium">{assignedTo || "Unassigned"}</p>
            <p className="mt-2 text-[12px] text-[#6b7280]">Pipeline Stage</p>
            <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-violet-700">
              {status}
            </span>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="realtor-card border-[#bfdbfe] bg-[#eff6ff] p-4">
            <p className="text-[13px] text-[#1e40af]">
              Amy has qualified this lead and scheduled a consultation when applicable.
            </p>
            {needsAction ? (
              <Link
                href={`/phone?contact=${leadId}`}
                className="mt-3 inline-flex realtor-btn-primary text-[13px]"
              >
                Call Now
              </Link>
            ) : null}
          </div>

          <h3 className="mb-3 mt-4 text-[16px] font-semibold text-[#111827]">Activity Timeline</h3>
          <div className="realtor-card p-4">
            <ul className="space-y-4">
              {timeline.map((event) => (
                <li key={event.id} className="flex gap-3 border-b border-[#f3f4f6] pb-4 last:border-0">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#6366f1]">
                    <TimelineIcon kind={event.kind} />
                  </span>
                  <div>
                    <p className="text-[11px] text-[#9ca3af]">
                      {new Date(event.at).toLocaleString()}
                    </p>
                    {event.href ? (
                      <Link href={event.href} className="font-semibold text-[#6366f1]">
                        {event.title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-[#111827]">{event.title}</p>
                    )}
                    {event.detail ? (
                      <p className="mt-1 text-[13px] text-[#6b7280]">{event.detail}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div className="realtor-card border-purple-100 bg-purple-50/50 p-4">
            <h3 className="font-semibold text-[#111827]">Amy&apos;s Insights</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-[#374151]">
              {profileFields.slice(0, 3).map((f) => (
                <li key={f.key} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  {f.label}: {f.value}
                </li>
              ))}
            </ul>
          </div>

          {needsAction ? (
            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Next Best Actions</h3>
              <ol className="mt-3 space-y-4 text-[13px]">
                <li>
                  <p className="font-medium text-[#111827]">Personal call</p>
                  <Link
                    href={`/phone?contact=${leadId}`}
                    className="mt-2 inline-flex realtor-btn-primary text-[12px]"
                  >
                    Call {name.split(" ")[0]}
                  </Link>
                </li>
                <li>
                  <p className="font-medium text-[#111827]">Send pre-approval resources</p>
                  <Link href={`/send/quick?contact=${leadId}`} className="mt-2 realtor-btn-outline inline-flex text-[12px]">
                    Send Resources
                  </Link>
                </li>
                <li>
                  <p className="font-medium text-[#111827]">Prepare property suggestions</p>
                  <Link href="/realtor/leads" className="mt-2 realtor-btn-outline inline-flex text-[12px]">
                    View Listings
                  </Link>
                </li>
              </ol>
            </div>
          ) : null}

          <div className="realtor-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#111827]">Automation Status</h3>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-600">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                Active
              </span>
            </div>
            <p className="mt-2 text-[13px] font-medium">Buyer Follow-Up Sequence</p>
            <div className="mt-2 h-2 rounded-full bg-[#e5e7eb]">
              <div className="h-full w-1/3 rounded-full bg-[#6366f1]" />
            </div>
            <p className="mt-2 text-[12px] text-[#6b7280]">Step 2 of 6</p>
            <Link href="/automations" className="mt-3 flex items-center text-[13px] font-semibold text-[#6366f1]">
              View Workflow <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function TimelineIcon({ kind }: { kind: LeadTimelineEvent["kind"] }) {
  switch (kind) {
    case "call":
      return <Phone className="h-4 w-4" />;
    case "sms":
      return <MessageSquare className="h-4 w-4" />;
    case "appointment":
      return <Calendar className="h-4 w-4" />;
    case "ai":
      return <Star className="h-4 w-4" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
}

function ActivityPanel({ timeline }: { timeline: LeadTimelineEvent[] }) {
  return (
    <ul className="space-y-4 text-left">
      {timeline.map((event) => (
        <li key={event.id} className="flex gap-3 border-b border-[#f3f4f6] pb-4 last:border-0">
          <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#6366f1]">
            <TimelineIcon kind={event.kind} />
          </span>
          <div>
            <p className="text-[11px] text-[#9ca3af]">{new Date(event.at).toLocaleString()}</p>
            <p className="font-semibold text-[#111827]">{event.title}</p>
            {event.detail ? (
              <p className="mt-1 text-[13px] text-[#6b7280]">{event.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
