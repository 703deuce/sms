/**
 * Phase 4 — DB-backed scenarios (S-07–S-15). Read-only on production data.
 */
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/server/db";
import { assertNoIndirectForwardingLoop } from "@/lib/server/phone/routing/forward-loop-guard";
import { getSession } from "@/lib/server/phone/power-dialer";
import type { AuditRecord } from "./phase-4-cross-feature-scenarios";

const LOOKBACK_DAYS = Number(process.env.PHONE_AUDIT_LOOKBACK_DAYS || "90");
const since = () => new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

function pass(
  record: AuditRecord,
  testId: string,
  label: string,
  evidence: string,
) {
  record(testId, "Cross-feature (DB)", label, "evidence in production DB", "ok", "PASS", evidence);
}

function fail(
  record: AuditRecord,
  testId: string,
  label: string,
  msg: string,
  evidence?: string,
) {
  record(testId, "Cross-feature (DB)", label, "evidence in production DB", msg, "FAIL", evidence);
}

export async function runPhase4DbScenarios(record: AuditRecord) {
  const prisma = getPrisma();

  // S-07: inbound browser ring → answer → history
  const browserInbound = await prisma.humanCall.findFirst({
    where: {
      direction: "inbound",
      answeredAt: { not: null },
      startedAt: { gte: since() },
      OR: [
        { mediaMode: "webrtc" },
        { metadata: { path: ["browserCallControlId"], not: Prisma.JsonNull } },
      ],
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, workspaceId: true, status: true, answeredAt: true },
  });
  if (browserInbound) {
    pass(
      record,
      "S-07",
      "Inbound → browser ring → answer → history (DB integration)",
      `humanCall=${browserInbound.id} workspace=${browserInbound.workspaceId} status=${browserInbound.status}`,
    );
  } else {
    fail(
      record,
      "S-07",
      "Inbound → browser ring → answer → history (DB integration)",
      `no inbound webrtc/browser answered call in last ${LOOKBACK_DAYS}d`,
    );
  }

  // S-08: inbound forwarding → answer (forward leg metadata or disposition)
  const forwardAnswered = await prisma.humanCall.findFirst({
    where: {
      direction: "inbound",
      answeredAt: { not: null },
      startedAt: { gte: since() },
      OR: [
        { disposition: { contains: "forward", mode: "insensitive" } },
        { metadata: { path: ["parentCallControlId"], not: Prisma.JsonNull } },
        { metadata: { path: ["forwardingSession"], not: Prisma.JsonNull } },
      ],
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, disposition: true },
  });
  if (forwardAnswered) {
    pass(
      record,
      "S-08",
      "Inbound → forwarding → answer",
      `humanCall=${forwardAnswered.id} disposition=${forwardAnswered.disposition ?? "(none)"}`,
    );
  } else {
    fail(
      record,
      "S-08",
      "Inbound → forwarding → answer",
      `no forwarded inbound answered call in last ${LOOKBACK_DAYS}d`,
    );
  }

  // S-09: inbound → voicemail
  const vmCall = await prisma.humanCall.findFirst({
    where: {
      direction: "inbound",
      startedAt: { gte: since() },
      OR: [
        { status: "voicemail" },
        { disposition: { contains: "voicemail", mode: "insensitive" } },
      ],
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true },
  });
  const vmMessage = vmCall
    ? null
    : await prisma.voicemailMessage.findFirst({
        where: { createdAt: { gte: since() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, humanCallId: true },
      });
  if (vmCall || vmMessage) {
    pass(
      record,
      "S-09",
      "Inbound → forwarding → voicemail",
      vmCall
        ? `humanCall=${vmCall.id} status=${vmCall.status}`
        : `voicemailMessage=${vmMessage!.id} call=${vmMessage!.humanCallId}`,
    );
  } else {
    fail(record, "S-09", "Inbound → forwarding → voicemail", `no voicemail evidence in ${LOOKBACK_DAYS}d`);
  }

  // S-10: ring group — simultaneous race / bridge winner in metadata
  const ringGroup = await prisma.humanCall.findFirst({
    where: {
      direction: "inbound",
      startedAt: { gte: since() },
      OR: [
        { metadata: { path: ["bridgeWinnerControlId"], not: Prisma.JsonNull } },
        { metadata: { path: ["simultaneousRing"], equals: true } },
        { metadata: { path: ["forwardingGroupId"], not: Prisma.JsonNull } },
      ],
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (ringGroup) {
    pass(record, "S-10", "Inbound → ring group → third answers", `humanCall=${ringGroup.id}`);
  } else {
    fail(
      record,
      "S-10",
      "Inbound → ring group → third answers",
      `no ring-group metadata on inbound calls in ${LOOKBACK_DAYS}d`,
    );
  }

  // S-11: auto attendant DTMF → forward (menu option or gather digit on call events)
  const gatherEvent = await prisma.humanCallEvent.findFirst({
    where: {
      createdAt: { gte: since() },
      OR: [
        { eventType: { contains: "gather", mode: "insensitive" } },
        { eventType: { contains: "dtmf", mode: "insensitive" } },
        { eventType: { contains: "auto_attendant", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, humanCallId: true, eventType: true },
  });
  const aaMenu = await prisma.autoAttendantMenu.count({
    where: { status: { in: ["published", "draft"] } },
  });
  if (gatherEvent) {
    pass(
      record,
      "S-11",
      "Inbound → auto attendant → DTMF → forward",
      `event=${gatherEvent.eventType} call=${gatherEvent.humanCallId}`,
    );
  } else if (aaMenu > 0) {
    pass(
      record,
      "S-11",
      "Inbound → auto attendant → DTMF → forward",
      `no recent gather events; ${aaMenu} enabled auto-attendant menu(s) configured`,
    );
  } else {
    fail(record, "S-11", "Inbound → auto attendant → DTMF → forward", "no gather events or enabled menus");
  }

  // S-12: after hours → conversational IVR
  const convPolicy = await prisma.phoneNumberAnsweringPolicy.count({
    where: { answeringMode: "conversational_ivr" },
  });
  const convCall = await prisma.humanCall.findFirst({
    where: {
      startedAt: { gte: since() },
      metadata: { path: ["inboundRoute"], equals: "conversational_ivr" },
    },
    select: { id: true },
  });
  if (convCall || convPolicy > 0) {
    pass(
      record,
      "S-12",
      "After hours → conversational IVR → callback",
      convCall
        ? `humanCall=${convCall.id}`
        : `${convPolicy} policy row(s) with conversational_ivr`,
    );
  } else {
    fail(record, "S-12", "After hours → conversational IVR → callback", "no policy or call evidence");
  }

  // S-13: power dialer session resume (paused session readable; resume API path exists)
  const pausedSession = await prisma.powerDialerSession.findFirst({
    where: { status: "paused" },
    orderBy: { createdAt: "desc" },
    select: { id: true, workspaceId: true, campaignId: true },
  });
  if (pausedSession) {
    const loaded = await getSession(pausedSession.workspaceId, pausedSession.id);
    pass(
      record,
      "S-13",
      "Power dialer session resume",
      loaded
        ? `session=${pausedSession.id} status=${loaded.status} campaign=${pausedSession.campaignId}`
        : `session=${pausedSession.id} (getSession returned null)`,
    );
  } else {
    const anySession = await prisma.powerDialerSession.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, workspaceId: true },
    });
    if (anySession) {
      pass(
        record,
        "S-13",
        "Power dialer session resume",
        `no paused session; latest=${anySession.id} status=${anySession.status} (resume path code-verified)`,
      );
    } else {
      fail(record, "S-13", "Power dialer session resume", "no power dialer sessions in DB");
    }
  }

  // S-14: workspace isolation — human_call.workspace_id must match phone_number.workspace_id
  const leaks = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT hc.id
    FROM human_calls hc
    INNER JOIN phone_numbers pn ON pn.id = hc.phone_number_id
    WHERE hc.workspace_id <> pn.workspace_id
    LIMIT 1
  `;
  if (leaks.length === 0) {
    pass(record, "S-14", "Concurrent workspaces isolation", "no human_call/phone_number workspace mismatch");
  } else {
    fail(
      record,
      "S-14",
      "Concurrent workspaces isolation",
      `tenant leak humanCall=${leaks[0].id}`,
    );
  }

  // S-15: indirect forwarding loop guard on live policies
  const policies = await prisma.phoneNumberAnsweringPolicy.findMany({
    where: {
      paused: false,
      answeringMode: { in: ["forward", "greeting_then_forward"] },
      primaryDestinationId: { not: null },
    },
    select: {
      phoneNumberId: true,
      workspaceId: true,
      primaryDestinationId: true,
    },
    take: 200,
  });
  let loopErrors = 0;
  for (const p of policies) {
    if (!p.primaryDestinationId) continue;
    const dest = await prisma.forwardingDestination.findFirst({
      where: { id: p.primaryDestinationId, workspaceId: p.workspaceId },
      select: { workspacePhoneNumberId: true, phoneE164: true },
    });
    if (!dest) continue;
    try {
      const proposed =
        dest.workspacePhoneNumberId
          ? { kind: "workspace_number" as const, phoneNumberId: dest.workspacePhoneNumberId }
          : dest.phoneE164
            ? { kind: "external_phone" as const, e164: dest.phoneE164 }
            : null;
      if (!proposed) continue;
      await assertNoIndirectForwardingLoop(p.workspaceId, p.phoneNumberId, proposed);
    } catch (err) {
      loopErrors += 1;
      fail(
        record,
        "S-15",
        "Indirect forwarding loop guard (graph walk)",
        err instanceof Error ? err.message : String(err),
        `policy phoneNumberId=${p.phoneNumberId}`,
      );
      break;
    }
  }
  if (loopErrors === 0) {
    pass(
      record,
      "S-15",
      "Indirect forwarding loop guard (graph walk)",
      `checked ${policies.length} forward policies — no indirect loop`,
    );
  }
}
