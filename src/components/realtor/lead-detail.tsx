import { StatusChip } from "@/components/ui/status-chip";
import type { RealtorLeadStatus } from "@/lib/realtor/types";
import { formatPhone } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

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
}) {
  const scoreLabel = leadScore >= 85 ? "Excellent" : leadScore >= 70 ? "Good" : "Fair";

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[#6b7280]">
        <Link href="/realtor/leads" className="hover:text-[#2563eb]">Leads</Link>
        <span className="mx-1">/</span>
        <span className="text-[#111827]">{name}</span>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold text-[#111827]">{name}</h1>
            {leadScore >= 80 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                Hot Lead
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
            <Link href={`/inbox?contact=${leadId}`} className="realtor-btn-outline">
              Text
            </Link>
            <Link href={`/send?contact=${leadId}`} className="realtor-btn-outline">
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

      <div className="flex gap-6 border-b border-[#e5e7eb] text-[14px]">
        {["Overview", "Activity", "Conversations", "Appointments", "Notes"].map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={cnTab(i === 0)}
          >
            {tab}
            {tab === "Appointments" && appointments.length ? ` (${appointments.length})` : ""}
          </button>
        ))}
      </div>

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
                  <Mail className="h-4 w-4 shrink-0 text-[#2563eb]" />
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
            <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-emerald-700">
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
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] text-[#9ca3af]">
                      {new Date(event.at).toLocaleString()}
                    </p>
                    {event.href ? (
                      <Link href={event.href} className="font-semibold text-[#2563eb]">
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
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {f.label}: {f.value}
                </li>
              ))}
            </ul>
          </div>

          {needsAction ? (
            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Next Best Actions</h3>
              <p className="mt-2 text-[13px] font-medium">{needsAction.title}</p>
              <p className="text-[12px] text-[#6b7280]">{needsAction.detail}</p>
              <Link href={`/phone?contact=${leadId}`} className="mt-3 realtor-btn-primary inline-flex text-[13px]">
                Call {name.split(" ")[0]}
              </Link>
            </div>
          ) : null}

          <div className="realtor-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#111827]">Automation Status</h3>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <p className="mt-2 text-[13px] font-medium">Buyer Follow-Up Sequence</p>
            <div className="mt-2 h-2 rounded-full bg-[#e5e7eb]">
              <div className="h-full w-1/3 rounded-full bg-[#2563eb]" />
            </div>
            <p className="mt-2 text-[12px] text-[#6b7280]">Step 2 of 6</p>
            <Link href="/automations" className="mt-3 flex items-center text-[13px] font-semibold text-[#2563eb]">
              View Workflow <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function cnTab(active: boolean): string {
  return active
    ? "border-b-2 border-[#2563eb] pb-2 font-semibold text-[#2563eb]"
    : "pb-2 text-[#6b7280] hover:text-[#111827]";
}
