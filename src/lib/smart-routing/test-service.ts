import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { getPrisma } from "@/lib/db";
import { startFlowForInboundCall } from "./flow-runtime";

export async function startTestCall(input: {
  workspaceId: string;
  flowId: string;
  testNumber: string;
}) {
  if (!isTelnyxVoiceConfigured()) {
    throw new Error("Telnyx voice is not configured");
  }
  const prisma = getPrisma();
  const flow = await prisma.smartRoutingFlow.findFirst({
    where: { id: input.flowId, workspaceId: input.workspaceId },
  });
  if (!flow?.publishedVersionId) {
    throw new Error("Publish the flow before testing");
  }
  const pn = flow.assignedPhoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: flow.assignedPhoneNumberId, workspaceId: input.workspaceId },
      })
    : await prisma.phoneNumber.findFirst({ where: { workspaceId: input.workspaceId } });
  if (!pn) throw new Error("Assign a phone number to this flow");

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

  return { ok: true, message: "Test call initiated" };
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
