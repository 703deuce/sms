import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type {
  NeedsAttentionItem,
  NeedsAttentionKind,
  NeedsAttentionStatus,
  NeedsAttentionEvent,
} from "./needs-attention-types";

export type { NeedsAttentionItem, NeedsAttentionKind, NeedsAttentionStatus, NeedsAttentionEvent };

function normalizeCaller(e164: string): string {
  return normalizeE164(e164) || e164;
}

function mergeStatus(existing: NeedsAttentionStatus, incoming: NeedsAttentionStatus): NeedsAttentionStatus {
  if (existing === "needs_attention" || incoming === "needs_attention") return "needs_attention";
  if (existing === "contacted" || incoming === "contacted") return "contacted";
  return "done";
}

export async function loadNeedsAttentionItems(
  workspaceId: string,
  options?: { userId?: string; filter?: "all" | "assigned_to_me" | "done" },
): Promise<NeedsAttentionItem[]> {
  const prisma = getPrisma();
  const filter = options?.filter ?? "all";
  const userId = options?.userId;

  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [callbacks, voicemails, missed, formSubs, failedTransfers] = await Promise.all([
    prisma.callbackRequest.findMany({
      where: {
        workspaceId,
        status: { in: ["new", "contacted"] },
      },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
    prisma.voicemailMessage.findMany({
      where: {
        workspaceId,
        isResolved: false,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fromE164: true,
        transcriptText: true,
        aiSummary: true,
        createdAt: true,
        isRead: true,
        assignedToUserId: true,
      },
    }),
    prisma.missedCallEvent.findMany({
      where: {
        workspaceId,
        status: "CUSTOMER_REPLIED",
      },
      orderBy: { detectedAt: "desc" },
      take: 100,
      select: {
        id: true,
        callerE164: true,
        status: true,
        detectedAt: true,
        smsSentAt: true,
      },
    }),
    prisma.mctbRequestFormSubmission
      .findMany({
        where: { workspaceId },
        orderBy: { submittedAt: "desc" },
        take: 50,
      })
      .catch(() => []),
    prisma.voiceTransfer.findMany({
      where: {
        workspaceId,
        status: { in: ["failed", "exhausted"] },
        createdAt: { gte: since14d },
      },
      include: { call: { select: { id: true, fromE164: true, metadata: true } } },
      take: 40,
    }),
  ]);

  const repeatCounts = new Map<string, number>();
  for (const m of missed) {
    const key = normalizeCaller(m.callerE164);
    repeatCounts.set(key, (repeatCounts.get(key) ?? 0) + 1);
  }

  const byCaller = new Map<string, NeedsAttentionItem>();

  function upsert(item: Omit<NeedsAttentionItem, "events" | "latestAt"> & {
    event: NeedsAttentionEvent;
    at: string;
  }) {
    const key = normalizeCaller(item.callerE164);
    const existing = byCaller.get(key);
    if (!existing) {
      byCaller.set(key, {
        id: key,
        callerE164: item.callerE164,
        callerName: item.callerName,
        title: item.title,
        subtitle: item.subtitle,
        transcriptPreview: item.transcriptPreview,
        status: item.status,
        assignedToUserId: item.assignedToUserId,
        repeatCallerCount: repeatCounts.get(key),
        events: [item.event],
        latestAt: item.at,
        primaryKind: item.primaryKind,
        primaryRefId: item.primaryRefId,
      });
      return;
    }
    existing.events.push(item.event);
    existing.status = mergeStatus(existing.status, item.status);
    if (!existing.assignedToUserId && item.assignedToUserId) {
      existing.assignedToUserId = item.assignedToUserId;
    }
    if (new Date(item.at) > new Date(existing.latestAt)) {
      existing.latestAt = item.at;
      existing.title = item.title;
      existing.subtitle = item.subtitle;
      existing.transcriptPreview = item.transcriptPreview ?? existing.transcriptPreview;
      existing.primaryKind = item.primaryKind;
      existing.primaryRefId = item.primaryRefId;
    }
    existing.repeatCallerCount = repeatCounts.get(key) ?? existing.repeatCallerCount;
  }

  for (const cb of callbacks) {
    const status: NeedsAttentionStatus =
      cb.status === "contacted" ? "contacted" : "needs_attention";
    upsert({
      id: normalizeCaller(cb.callerE164),
      callerE164: cb.callerE164,
      title: "Callback requested",
      subtitle: cb.sourceRoute ?? cb.reason ?? undefined,
      status,
      assignedToUserId: cb.assignedToUserId,
      primaryKind: "callback_request",
      primaryRefId: cb.id,
      event: {
        kind: "callback_request",
        id: cb.id,
        label: "Callback requested",
        at: cb.requestedAt.toISOString(),
        href: "/voice/callback-requests",
      },
      at: cb.requestedAt.toISOString(),
    });
  }

  for (const vm of voicemails) {
    if (!vm.fromE164) continue;
    const preview = vm.aiSummary || vm.transcriptText?.slice(0, 120);
    upsert({
      id: normalizeCaller(vm.fromE164),
      callerE164: vm.fromE164,
      title: vm.isRead ? "Voicemail" : "New voicemail",
      transcriptPreview: preview,
      status: "needs_attention",
      assignedToUserId: vm.assignedToUserId,
      primaryKind: "voicemail",
      primaryRefId: vm.id,
      event: {
        kind: "voicemail",
        id: vm.id,
        label: vm.isRead ? "Voicemail" : "New voicemail",
        at: vm.createdAt.toISOString(),
        href: MCTB_ROUTES.voicemail,
      },
      at: vm.createdAt.toISOString(),
    });
  }

  for (const m of missed) {
    const isReply = m.status === "CUSTOMER_REPLIED";
    upsert({
      id: normalizeCaller(m.callerE164),
      callerE164: m.callerE164,
      title: isReply ? "Replied to missed-call text" : "Missed call needs follow-up",
      subtitle: m.smsSentAt ? "Text sent" : undefined,
      status: "needs_attention",
      primaryKind: isReply ? "mctb_reply" : "missed_call",
      primaryRefId: m.id,
      event: {
        kind: isReply ? "mctb_reply" : "missed_call",
        id: m.id,
        label: isReply ? "SMS reply" : "Missed call",
        at: m.detectedAt.toISOString(),
        href: MCTB_ROUTES.missedCallDetail(m.id),
      },
      at: m.detectedAt.toISOString(),
    });
  }

  for (const ft of failedTransfers) {
    const phone = ft.call?.fromE164;
    if (!phone) continue;
    const callMeta = (ft.call?.metadata || {}) as Record<string, unknown>;
    const na = (callMeta.voiceV3NeedsAttention || {}) as Record<string, unknown>;
    if (na.transferFollowUpDismissedAt) continue;
    upsert({
      id: normalizeCaller(phone),
      callerE164: phone,
      title: "Transfer did not connect",
      subtitle: ft.destination,
      status: "needs_attention",
      primaryKind: "failed_transfer",
      primaryRefId: ft.callId,
      event: {
        kind: "failed_transfer",
        id: ft.id,
        label: "Failed transfer",
        at: ft.createdAt.toISOString(),
        href: `/voice/calls/${ft.callId}`,
      },
      at: ft.createdAt.toISOString(),
    });
  }

  for (const sub of formSubs) {
    const payload = (sub.payloadJson as { phone?: string; dismissed?: boolean }) ?? {};
    if (payload.dismissed) continue;
    const phone = String(payload.phone ?? "").trim();
    if (!phone) continue;
    upsert({
      id: normalizeCaller(phone),
      callerE164: phone,
      title: "Request form submitted",
      status: "needs_attention",
      primaryKind: "form_submission",
      primaryRefId: sub.id,
      event: {
        kind: "form_submission",
        id: sub.id,
        label: "Form submission",
        at: sub.submittedAt.toISOString(),
      },
      at: sub.submittedAt.toISOString(),
    });
  }

  let items = Array.from(byCaller.values()).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );

  if (filter === "assigned_to_me" && userId) {
    items = items.filter((i) => i.assignedToUserId === userId);
  }
  if (filter === "done") {
    items = items.filter((i) => i.status === "done");
  } else {
    items = items.filter((i) => i.status !== "done");
  }

  return items;
}
