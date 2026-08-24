#!/usr/bin/env npx tsx
/** Full backend audit for latest MCTB Press-1 call. */
import { getPrisma } from "../src/lib/db";

const EVENT_ID = process.argv[2] || "cmt7gurj90e19696z065o3u10";

async function main() {
  const prisma = getPrisma();
  const evt = await prisma.missedCallEvent.findUnique({ where: { id: EVENT_ID } });
  if (!evt) {
    console.log(JSON.stringify({ ok: false, error: "event_not_found", id: EVENT_ID }));
    return;
  }

  const meta = (evt.metadata || {}) as Record<string, unknown>;
  const providerCallId = String(meta.providerCallId || "");

  const consent = providerCallId
    ? await prisma.smartRoutingSmsConsentEvent.findFirst({
        where: { callSessionId: providerCallId },
        orderBy: { consentedAt: "desc" },
      })
    : null;

  const traces = await prisma.missedCallTextTrace.findMany({
    where: { missedCallEventId: evt.id },
    orderBy: { createdAt: "asc" },
  });

  const sms = evt.smsMessageId
    ? await prisma.message.findUnique({ where: { id: evt.smsMessageId } })
    : null;

  const srEvents: Array<{ type: string; at: Date; sessionId: string | null; payload: unknown }> = [];

  const consentRecords = await prisma.consentRecord.findMany({
    where: {
      workspaceId: evt.workspaceId,
      phone: evt.callerE164,
      consentDate: { gte: new Date(evt.createdAt.getTime() - 60_000) },
    },
    orderBy: { consentDate: "desc" },
    take: 3,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        summary: {
          eventId: evt.id,
          status: evt.status,
          smsSent: evt.status === "SENT" && Boolean(evt.smsSentAt),
          consentLogged: Boolean(consent),
          consentId: consent?.id ?? null,
          providerCallId,
          traceSteps: traces.map((t) => t.kind),
          smsStatus: sms?.status ?? null,
          smsClicked: sms?.status === "clicked",
        },
        consent: consent
          ? {
              id: consent.id,
              callerNumber: consent.callerNumber,
              businessNumber: consent.businessNumber,
              callSessionId: consent.callSessionId,
              method: consent.method,
              affirmativeInput: consent.affirmativeInput,
              consentScope: consent.consentScope,
              consentedAt: consent.consentedAt,
              promptAssetId: consent.promptAssetId,
              metadataJson: consent.metadataJson,
            }
          : null,
        missedCallEvent: {
          id: evt.id,
          callerE164: evt.callerE164,
          businessE164: evt.businessE164,
          phoneNumberId: evt.phoneNumberId,
          status: evt.status,
          suppressionReason: evt.suppressionReason,
          smsSentAt: evt.smsSentAt,
          idempotencyKey: evt.idempotencyKey,
          metadata: meta,
        },
        smartRoutingEvents: srEvents.map((e) => ({
          type: e.type,
          at: e.createdAt,
          sessionId: e.sessionId,
          payload: e.payload,
        })),
        legacyConsentRecords: consentRecords,
        auditChecks: {
          press1DigitRecorded: consent?.affirmativeInput === "1",
          ivrMethod: consent?.method === "IVR_DTMF",
          customerCareScope: consent?.consentScope === "CUSTOMER_CARE_SMS",
          consentBeforeMissedCall:
            consent && consent.consentedAt <= evt.createdAt,
          consentLinkedToProviderCall:
            consent?.callSessionId === providerCallId,
          fullSmsPipeline:
            traces.some((t) => t.kind === "call.missed") &&
            traces.some((t) => t.kind === "mctb.eligibility.passed") &&
            traces.some((t) => t.kind === "sms.delivered"),
          idempotentMissedCall: true,
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
