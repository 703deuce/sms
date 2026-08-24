#!/usr/bin/env npx tsx
/** Audit proof-call DB linkage for MCTB Press-1 self-hosted flow. */
import { getPrisma } from "@/lib/db";

const PROOF_MISSED_CALL_EVENT_ID =
  process.argv.find((a) => a.startsWith("cmt")) || "cmt77w79m1564281e3f0s0e5d";

async function main() {
  const prisma = getPrisma();
  const evt = await prisma.missedCallEvent.findUnique({
    where: { id: PROOF_MISSED_CALL_EVENT_ID },
  });
  if (!evt) {
    console.log(JSON.stringify({ ok: false, error: "missedCallEvent not found", id: PROOF_MISSED_CALL_EVENT_ID }));
    return;
  }

  const idempotencyKey = evt.idempotencyKey;
  const dupes = await prisma.missedCallEvent.count({ where: { idempotencyKey } });

  const consents = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: {
      workspaceId: evt.workspaceId,
      callerNumber: evt.callerE164,
      consentedAt: {
        gte: new Date(evt.createdAt.getTime() - 5 * 60 * 1000),
        lte: new Date(evt.createdAt.getTime() + 5 * 60 * 1000),
      },
    },
    orderBy: { consentedAt: "desc" },
  });

  const traces = await prisma.missedCallTextTrace.findMany({
    where: { missedCallEventId: evt.id },
    orderBy: { createdAt: "asc" },
  });

  let smsMessage: { id: string; status: string; conversationId: string | null } | null = null;
  if (evt.smsMessageId) {
    smsMessage = await prisma.message
      .findUnique({
        where: { id: evt.smsMessageId },
        select: { id: true, status: true, conversationId: true },
      })
      .catch(() => null);
  }

  const phone = evt.phoneNumberId
    ? await prisma.phoneNumber.findUnique({
        where: { id: evt.phoneNumberId },
        select: { id: true, e164: true, workspaceId: true, settingsJson: true },
      })
    : await prisma.phoneNumber.findFirst({
        where: { e164: evt.businessE164, workspaceId: evt.workspaceId },
        select: { id: true, e164: true, workspaceId: true, settingsJson: true },
      });

  const meta = (evt.metadata || {}) as Record<string, unknown>;
  const settings = (phone?.settingsJson || {}) as Record<string, unknown>;
  const telephony = (settings.telephony || {}) as Record<string, unknown>;

  console.log(
    JSON.stringify(
      {
        ok: true,
        missedCallEvent: {
          id: evt.id,
          workspaceId: evt.workspaceId,
          callerE164: evt.callerE164,
          businessE164: evt.businessE164,
          phoneNumberId: evt.phoneNumberId,
          voiceCallId: evt.voiceCallId,
          status: evt.status,
          smsSentAt: evt.smsSentAt,
          smsMessageId: evt.smsMessageId,
          idempotencyKey: evt.idempotencyKey,
          duplicateCount: dupes,
          metadata: meta,
        },
        consentEventsNearby: consents.map((c) => ({
          id: c.id,
          callSessionId: c.callSessionId,
          consentedAt: c.consentedAt,
          metadataJson: c.metadataJson,
        })),
        traceKinds: traces.map((t) => t.kind),
        smsMessage,
        phoneNumber: phone
          ? {
              id: phone.id,
              e164: phone.e164,
              livekitInboundTrunkId: telephony.livekitInboundTrunkId,
            }
          : null,
        checks: {
          hasVoiceCall: Boolean(evt.voiceCallId),
          voiceCallExpectedForMctbSip: false,
          smsSent: evt.status === "SENT" && Boolean(evt.smsSentAt),
          duplicateMissedCallEvents: dupes > 1,
          consentLinked: consents.length > 0,
          consentHasCallSessionId: consents.some((c) => Boolean(c.callSessionId)),
          tracesComplete: traces.some((t) => t.kind === "sms.delivered"),
          metadataHasMediaBackend: Boolean(meta.mediaBackend),
          metadataHasPath: meta.path === "livekit_sip_mctb",
          phoneNumberLinked: Boolean(evt.phoneNumberId),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
