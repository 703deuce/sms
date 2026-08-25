import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getPrisma } from "@/lib/db";
import { resolvePhoneNumberProvider } from "@/lib/numbers/providers/normalize";
import { getTwilioClientForWorkspace } from "./twilio-whisper-service";

export async function startTestCall(input: {
  workspaceId: string;
  flowId: string;
  testNumber: string;
}) {
  const prisma = getPrisma();
  const flow = await prisma.smartRoutingFlow.findFirst({
    where: { id: input.flowId, workspaceId: input.workspaceId },
  });
  if (!flow?.publishedVersionId) {
    throw new Error("Publish the flow before testing");
  }
  const pn = flow.assignedPhoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: {
          id: flow.assignedPhoneNumberId,
          workspaceId: input.workspaceId,
          releasedAt: null,
          status: { not: "Released" },
        },
      })
    : await prisma.phoneNumber.findFirst({
        where: {
          workspaceId: input.workspaceId,
          releasedAt: null,
          status: { not: "Released" },
        },
        orderBy: { createdAt: "asc" },
      });
  if (!pn) throw new Error("Assign a phone number to this flow");

  const provider = resolvePhoneNumberProvider(pn);

  if (provider === "twilio") {
    const client = await getTwilioClientForWorkspace(input.workspaceId);
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.LOCAL_APP_URL || "";
    const voiceUrl = base
      ? `${base.replace(/\/$/, "")}/api/webhooks/twilio/voice?srTestFlowId=${encodeURIComponent(input.flowId)}`
      : undefined;
    await client.calls.create({
      to: normalizeE164(input.testNumber),
      from: normalizeE164(pn.e164),
      ...(voiceUrl ? { url: voiceUrl, method: "POST" } : {}),
    });
    return {
      ok: true,
      message: "Twilio test call initiated — answer to hear your published flow",
      provider: "twilio",
    };
  }

  if (!isTelnyxVoiceConfigured()) {
    throw new Error("Telnyx voice is not configured");
  }

  const connectionId = process.env.TELNYX_CONNECTION_ID || process.env.TELNYX_CALL_CONTROL_APP_ID;
  if (!connectionId) throw new Error("TELNYX_CONNECTION_ID not configured");

  await telnyxRequest("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      to: input.testNumber,
      from: pn.e164,
      client_state: Buffer.from(
        JSON.stringify({
          kind: "smart_routing_test",
          flowId: flow.id,
          workspaceId: input.workspaceId,
        }),
      ).toString("base64"),
    },
  });

  return { ok: true, message: "Telnyx test call initiated", provider: "telnyx" };
}

export async function simulateFlowPath(
  workspaceId: string,
  flowId: string,
  digits: string[],
) {
  const prisma = getPrisma();
  const flow = await prisma.smartRoutingFlow.findFirst({
    where: { id: flowId, workspaceId },
  });
  if (!flow?.publishedVersionId) throw new Error("No published version");
  const version = await prisma.smartRoutingFlowVersion.findUnique({
    where: { id: flow.publishedVersionId },
  });
  if (!version) throw new Error("Version missing");

  const steps: string[] = ["Incoming call received"];
  const compiled = version.compiledJson as {
    entryNodeId: string;
    nodes: Record<string, { id: string; type: string; edges: Record<string, string> }>;
  };
  let nodeId = compiled.entryNodeId;
  let i = 0;
  while (nodeId && compiled.nodes[nodeId]) {
    const node = compiled.nodes[nodeId];
    steps.push(`Execute ${node.type} (${node.id})`);
    if (node.type === "MENU" || node.type === "GATHER_DTMF") {
      const digit = digits[i++];
      if (!digit) {
        steps.push("Timeout → fallback");
        nodeId = node.edges.timeout ?? node.edges["timeout"];
        continue;
      }
      steps.push(`Caller pressed ${digit}`);
      nodeId = node.edges[`digit:${digit}`] ?? node.edges[digit];
      continue;
    }
    if (node.type === "HANGUP" || node.type === "AI_RECEPTIONIST") break;
    nodeId = node.edges.always ?? Object.values(node.edges)[0];
  }
  steps.push("Simulation complete");
  return { steps };
}
