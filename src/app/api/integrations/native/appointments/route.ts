import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  loadContactCrmLinks,
  loadStagesByProvider,
} from "@/lib/integrations/product/contact-crm-context";
import { canCrmAction, getMembershipRole } from "@/lib/crm/permissions";
import { isFeatureSupported } from "@/lib/crm/feature-matrix";
import { isCrmAutomationProvider } from "@/lib/crm/automation-actions";

type Meta = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s === "" ? null : s;
}

/** Read a key from metadata, its `raw` payload, or the embedded scheduled_event. */
function pick(meta: Meta, ...keys: string[]): unknown {
  const raw = (meta.raw || {}) as Meta;
  const scheduled = (meta.scheduledEvent ||
    raw.scheduledEvent ||
    raw.scheduled_event ||
    {}) as Meta;
  for (const k of keys) {
    if (meta[k] != null) return meta[k];
    if (raw[k] != null) return raw[k];
    if (scheduled[k] != null) return scheduled[k];
  }
  return null;
}

function normalizeQa(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const r = (row || {}) as Meta;
      return {
        question: String(r.question || r.q || ""),
        answer: String(r.answer || r.a || ""),
      };
    })
    .filter((r) => r.question || r.answer);
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();

    const rows = (await prisma.voiceAppointment.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { startsAt: "desc" },
      take: 100,
    })) as Array<{
      id: string;
      callId: string | null;
      serviceName: string | null;
      staffName: string | null;
      startsAt: Date;
      endsAt: Date | null;
      timezone: string | null;
      status: string;
      contactId: string | null;
      externalId: string | null;
      metadata: unknown;
    }>;

    const contactIds = [
      ...new Set(rows.map((r) => r.contactId).filter(Boolean)),
    ] as string[];
    const crmLinks = await loadContactCrmLinks(auth.workspaceId, contactIds);

    const dealProviders = [
      ...new Set(
        Array.from(crmLinks.values())
          .map((l) => l.deal?.provider)
          .filter(Boolean) as string[],
      ),
    ];
    const stagesByProvider = await loadStagesByProvider(
      auth.workspaceId,
      dealProviders,
    );

    const role = await getMembershipRole(auth.session.userId, auth.workspaceId);
    const permissions = {
      editCrmRecords: canCrmAction(role, "edit_crm_linked_records"),
      useCrmQuickActions: canCrmAction(role, "use_crm_quick_actions"),
    };

    const appointments = rows.map((a) => {
      const meta = (a.metadata || {}) as Meta;
      const host = (meta.host || {}) as Meta;
      const links = a.contactId ? crmLinks.get(a.contactId) || null : null;

      return {
        id: a.id,
        callId: a.callId,
        serviceName: a.serviceName,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt?.toISOString() || null,
        timezone: a.timezone || str(pick(meta, "timezone", "time_zone")) || null,
        status: a.status,
        contactId: a.contactId,
        externalId: a.externalId,
        provider:
          str(meta.provider) ||
          (a.externalId?.startsWith("calendly:") ? "calendly" : null),
        inviteeName: str(pick(meta, "inviteeName", "name")),
        inviteeEmail: str(pick(meta, "inviteeEmail", "email")),
        inviteePhone: str(pick(meta, "inviteePhone", "phone", "text_reminder_number")),
        cancelUrl: str(pick(meta, "cancelUrl", "cancel_url")),
        rescheduleUrl: str(pick(meta, "rescheduleUrl", "reschedule_url")),
        eventTypeId: str(pick(meta, "eventTypeId", "event_type")),
        eventTypeName: str(pick(meta, "eventTypeName", "event_type_name")),
        hostName: str(host.name) || str(pick(meta, "hostName")) || a.staffName || null,
        hostEmail: str(host.email) || str(pick(meta, "hostEmail")),
        cancelReason: str(pick(meta, "cancellationReason", "cancelReason")),
        canceledBy: str(pick(meta, "canceledBy", "canceled_by")),
        cancelerType: str(pick(meta, "cancelerType", "canceler_type")),
        noShow: Boolean(pick(meta, "noShow", "no_show")),
        rescheduled: Boolean(pick(meta, "rescheduled")),
        oldEventUri: str(pick(meta, "oldInviteeUri", "old_invitee")),
        inviteeAnswers: normalizeQa(
          pick(meta, "questionsAndAnswers", "questions_and_answers"),
        ),
        tracking: (pick(meta, "tracking", "utm") as Meta) || null,
        reminderStatus: str(pick(meta, "reminderStatus", "reminder_status")),
        crm: links
          ? {
              provider: links.provider,
              providerDisplay: links.providerDisplay,
              objectType: links.objectType,
              recordUrl: links.crmRecordUrl,
              leadUrl: links.leadUrl,
              company: links.company,
              companyUrl: links.companyUrl,
              deal: links.deal,
            }
          : null,
      };
    });

    // Stage-move is offered only when the deal's CRM provider supports deal
    // writes AND the caller has the edit permission.
    const moveDealProviders: Record<string, boolean> = {};
    for (const p of dealProviders) {
      moveDealProviders[p] =
        permissions.editCrmRecords &&
        isCrmAutomationProvider(p) &&
        isFeatureSupported(p, "deals");
    }

    return NextResponse.json({
      data: { appointments, stagesByProvider, permissions, moveDealProviders },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
