import { RealtorLeadDetailView } from "@/components/realtor/lead-detail";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { mapLeadStatusFromMeta } from "@/lib/realtor/lead-detail-data";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { notFound } from "next/navigation";
import type { LeadTimelineEvent } from "@/components/realtor/lead-detail";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fieldLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeLeadScore(
  status: string,
  fields: Record<string, string>,
  needsAttention: boolean,
): number {
  let score = 45;
  if (status === "qualified" || status === "appointment") score += 35;
  if (Object.keys(fields).length >= 4) score += 15;
  if (needsAttention) score += 8;
  return Math.min(99, score);
}

export default async function RealtorLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRealtorOnboardingComplete();
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await params;
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!contact) notFound();

  const [calls, appointments, audits] = await Promise.all([
    prisma.voiceCall.findMany({
      where: { workspaceId, contactId: id },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        direction: true,
        outcome: true,
        startedAt: true,
        durationSeconds: true,
        metadata: true,
      },
    }),
    prisma.voiceAppointment.findMany({
      where: { workspaceId, contactId: id },
      orderBy: { startsAt: "asc" },
      take: 10,
      select: { id: true, serviceName: true, startsAt: true },
    }),
    prisma.auditLog.findMany({
      where: { workspaceId, event: { startsWith: "voice.real_estate" } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown";
  const latestMeta = asRecord(calls[0]?.metadata);
  const reState = asRecord(latestMeta.realEstateCallState);
  const fields = asRecord(reState.collectedFields) as Record<string, string>;
  const status = mapLeadStatusFromMeta(calls[0]?.outcome, latestMeta);
  const needsAttention = Boolean(latestMeta.follow_up_required) || reState.leadStatus === "message_taken";

  const profileFields = Object.entries(fields).map(([key, value]) => ({
    key,
    label: fieldLabel(key),
    value,
  }));

  const timeline: LeadTimelineEvent[] = [];

  for (const call of calls) {
    timeline.push({
      id: `call-${call.id}`,
      at: call.startedAt?.toISOString() || new Date().toISOString(),
      title: `${call.direction === "INBOUND" ? "Inbound" : "AI Outbound"} call (${call.durationSeconds || 0}s)`,
      detail: call.outcome || "completed",
      href: `/phone/calls/${call.id}`,
      kind: "call",
    });
  }

  for (const audit of audits) {
    timeline.push({
      id: `audit-${audit.id}`,
      at: audit.createdAt.toISOString(),
      title: audit.event.replace("voice.real_estate.", "Amy: ").replace(/_/g, " "),
      detail: "",
      kind: "ai",
    });
  }

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const needsAction =
    needsAttention
      ? {
          title: "Call back — Requested by lead",
          detail: String(asRecord(latestMeta.structuredMessage).reason || "Follow up today"),
        }
      : calls[0]?.outcome === "transfer_requested"
        ? {
            title: "Transfer requested",
            detail: "Caller asked to speak with someone on the team.",
          }
        : undefined;

  const tags: string[] = [];
  if (status === "qualified") tags.push("Qualified");
  if (fields.preapproval_status) tags.push("Preapproval Pending");
  if (Object.keys(fields).length > 2) tags.push("Responds Fast");

  return (
    <div className="px-2 py-4 lg:px-4">
      <RealtorLeadDetailView
        leadId={id}
        name={name}
        status={status}
        intent={reState.primaryIntent ? String(reState.primaryIntent) : undefined}
        source={contact.consentSource || undefined}
        phone={contact.phone}
        email={contact.email}
        assignedTo="Sarah Johnson"
        createdAt={contact.createdAt.toISOString()}
        leadScore={computeLeadScore(status, fields, needsAttention)}
        profileFields={profileFields}
        appointments={appointments.map((a: (typeof appointments)[number]) => ({
          id: a.id,
          startsAt: a.startsAt.toISOString(),
          serviceName: a.serviceName || "Consultation",
        }))}
        timeline={timeline}
        needsAction={needsAction}
        tags={tags}
      />
    </div>
  );
}
