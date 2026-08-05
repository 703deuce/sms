/**
 * Enroll an inbound call into workflows that own a live Inbound Call
 * TriggerDeployment for the dialed number.
 *
 * Live audio stays on Telnyx (TeXML → assistant). This only starts the
 * post-call / during-call orchestration execution and binds callId so
 * Run Voice Agent (attachInbound) + Wait for Call Result can resume.
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { enrollInAutomation } from "@/lib/automations/enroll";
import { emitPlatformEvent } from "@/lib/platform/events";

export async function ensureInboundCallerContact(input: {
  workspaceId: string;
  fromE164: string;
}): Promise<{ id: string; created: boolean }> {
  const prisma = getPrisma();
  const phone = input.fromE164;
  const existing = await prisma.contact.findUnique({
    where: {
      workspaceId_phone: { workspaceId: input.workspaceId, phone },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const id = createId();
  await prisma.contact.create({
    data: {
      id,
      workspaceId: input.workspaceId,
      phone,
      firstName: "Caller",
      lastName: phone.slice(-4),
      status: "SUBSCRIBED",
      consentSource: "inbound_call",
      customFields: { createdFrom: "inbound_call" },
    },
  });
  return { id, created: true };
}

export type InboundTriggerEnrollResult = {
  flowId: string;
  deploymentId: string;
  executionId: string | null;
  skipped: boolean;
  reason?: string;
};

/**
 * Look up live TriggerDeployments for this DID and enroll matching flows.
 * Does not start Telnyx audio — routing was already published on Activate.
 */
export async function enrollInboundCallTriggers(input: {
  workspaceId: string;
  callId: string;
  phoneNumberId: string | null;
  contactId: string;
  agentId?: string | null;
  eventType?: string;
}): Promise<InboundTriggerEnrollResult[]> {
  if (!input.phoneNumberId) return [];

  const prisma = getPrisma();
  const eventType = input.eventType || "every_call";

  const deployments = await prisma.triggerDeployment.findMany({
    where: {
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      status: { in: ["live", "test"] },
      triggerBlockType: "inbound_call",
    },
    include: {
      flow: { select: { id: true, status: true, name: true } },
    },
  });

  const results: InboundTriggerEnrollResult[] = [];

  for (const dep of deployments) {
    // every_call owns all inbound; other modes only match themselves for now.
    if (dep.eventType !== "every_call" && dep.eventType !== eventType) {
      continue;
    }
    if (dep.flow?.status !== "ACTIVE" && dep.status !== "test") {
      results.push({
        flowId: dep.flowId,
        deploymentId: dep.id,
        executionId: null,
        skipped: true,
        reason: "flow_not_active",
      });
      continue;
    }

    const enrolled = await enrollInAutomation({
      workspaceId: input.workspaceId,
      flowId: dep.flowId,
      contactId: input.contactId,
      testMode: dep.status === "test",
      enrollmentSuffix: `call:${input.callId}`,
      variables: {
        callId: input.callId,
        phoneNumberId: input.phoneNumberId,
        triggerDeploymentId: dep.id,
        triggerNodeId: dep.triggerNodeId,
        agentId: input.agentId || null,
        inboundAttach: true,
      },
    }).catch((err) => ({
      skipped: true as const,
      reason: err instanceof Error ? err.message : String(err),
      execution: undefined,
    }));

    const executionId = enrolled.execution?.id || null;

    if (executionId) {
      const exec = await prisma.automationExecution.findUnique({
        where: { id: executionId },
        select: { metadata: true },
      });
      const meta = (exec?.metadata || {}) as Record<string, unknown>;
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          metadata: {
            ...meta,
            pendingCallId: input.callId,
            triggerDeploymentId: dep.id,
            inboundAttach: true,
            phoneNumberId: input.phoneNumberId,
          } as import("@/lib/domain").Prisma.InputJsonValue,
        },
      });
    }

    results.push({
      flowId: dep.flowId,
      deploymentId: dep.id,
      executionId,
      skipped: Boolean(enrolled.skipped),
      reason: enrolled.reason,
    });
  }

  await emitPlatformEvent({
    workspaceId: input.workspaceId,
    type: "CALL_STARTED",
    contactId: input.contactId,
    agentId: input.agentId || undefined,
    callId: input.callId,
    automationId: results[0]?.flowId,
    payload: {
      phoneNumberId: input.phoneNumberId,
      enrollments: results.map((r) => ({
        flowId: r.flowId,
        executionId: r.executionId,
        skipped: r.skipped,
      })),
    },
    idempotencyKey: `call-started:${input.callId}`,
  }).catch(() => undefined);

  return results;
}
