import { getPrisma } from "@/lib/db";
import { decryptSecret } from "@/lib/messaging/crypto";
import { assertSafeWebhookUrl } from "../url-safety";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { Prisma } from "@/lib/domain";

export type ToolExecInput = {
  workspaceId: string;
  toolId: string;
  callId?: string;
  input?: Record<string, unknown>;
  asyncAllowed?: boolean;
};

export async function executeVoiceTool(input: ToolExecInput) {
  const prisma = getPrisma();
  const tool = await prisma.voiceTool.findFirst({
    where: { id: input.toolId, workspaceId: input.workspaceId, status: "active" },
  });
  if (!tool) throw new Error("Tool not found");

  const execution = await prisma.voiceToolExecution.create({
    data: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      toolId: tool.id,
      status: "running",
      input: input.input as Prisma.InputJsonValue,
      isAsync: tool.isAsync,
    },
  });

  const start = Date.now();
  try {
    const result = await runToolByType(tool, input);
    const latencyMs = Date.now() - start;

    await prisma.voiceToolExecution.update({
      where: { id: execution.id },
      data: {
        status: "completed",
        output: result as Prisma.InputJsonValue,
        latencyMs,
        completedAt: new Date(),
      },
    });
    return { executionId: execution.id, ok: true, output: result, latencyMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.voiceToolExecution.update({
      where: { id: execution.id },
      data: {
        status: "failed",
        errorMessage: message,
        latencyMs: Date.now() - start,
        completedAt: new Date(),
      },
    });
    if (tool.isAsync && input.asyncAllowed) {
      return { executionId: execution.id, ok: false, pending: true, error: message };
    }
    throw err;
  }
}

async function runToolByType(
  tool: { toolType: string; config: unknown; secretRef: string | null; timeoutMs: number },
  input: ToolExecInput,
) {
  const config = (tool.config || {}) as Record<string, unknown>;

  switch (tool.toolType) {
    case "webhook":
    case "http_api":
      return await runWebhookTool(config, tool.secretRef, input.input || {}, tool.timeoutMs);
    case "send_sms":
      return await runSmsTool(input.workspaceId, config, input.input || {});
    case "transfer_call":
    case "warm_transfer":
    case "cold_transfer":
      return await runTransferTool(input.workspaceId, config, input.callId, tool.toolType, input.input || {});
    case "book_appointment":
    case "calendar_availability": {
      // Same Calendly-preferring path as builtin tools.
      const { executeBuiltinVoiceAction } = await import("./builtin-actions");
      return await executeBuiltinVoiceAction({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        toolType: tool.toolType,
        input: input.input || {},
      });
    }
    case "start_automation":
      return await runStartAutomation(input.workspaceId, config, input.input || {});
    case "create_contact":
    case "update_contact":
      return await runContactTool(input.workspaceId, tool.toolType, input.input || {});
    default:
      throw new Error(`Unsupported tool type: ${tool.toolType}`);
  }
}

async function runWebhookTool(
  config: Record<string, unknown>,
  secretRef: string | null,
  body: Record<string, unknown>,
  timeoutMs: number,
) {
  const url = String(config.url || "");
  if (!url) throw new Error("Tool URL not configured");
  const safeUrl = await assertSafeWebhookUrl(url);
  const method = String(config.method || "POST").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.headers as Record<string, string> || {}),
  };
  if (secretRef) {
    const prisma = getPrisma();
    const secret = await prisma.voiceIntegrationSecret.findFirst({
      where: { id: secretRef },
    });
    if (secret) {
      headers.Authorization = `Bearer ${decryptSecret(secret.encryptedValue)}`;
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(safeUrl, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${text.slice(0, 200)}`);
  return { status: res.status, body: json };
}

async function runSmsTool(
  workspaceId: string,
  config: Record<string, unknown>,
  input: Record<string, unknown>,
) {
  const phone = String(input.phone || input.to || "");
  const body = String(input.body || config.body || config.bodyTemplate || "");
  if (!phone || !body) throw new Error("phone and body required for SMS tool");
  const { sendQuickSms } = await import("@/lib/sms/send-quick");
  const result = await sendQuickSms({
    workspaceId,
    to: phone,
    body,
  });
  return result;
}

async function runTransferTool(
  workspaceId: string,
  config: Record<string, unknown>,
  callId?: string,
  transferType?: string,
  input?: Record<string, unknown>,
) {
  if (!callId) throw new Error("callId required for transfer");
  const { initiateTransfer } = await import("../transfers");
  const fallbacks = Array.isArray(config.fallbackDestinations)
    ? config.fallbackDestinations.map((d) =>
        typeof d === "string" ? d : String((d as { to?: string }).to || ""),
      )
    : [];
  return await initiateTransfer({
    workspaceId,
    callId,
    destination: String(input?.destination || config.destination || config.to || ""),
    transferType: transferType || "cold_transfer",
    summary: String(input?.summary || config.summary || ""),
    fallbackDestinations: fallbacks.filter(Boolean),
    timeoutSeconds: Number(config.timeoutSeconds || 30),
  });
}

async function runStartAutomation(
  workspaceId: string,
  config: Record<string, unknown>,
  input: Record<string, unknown>,
) {
  const flowId = String(config.flowId || input.flowId || "");
  const contactId = String(input.contactId || "");
  if (!flowId || !contactId) throw new Error("flowId and contactId required");
  const { enrollContactManually } = await import("@/lib/automations/events");
  return await enrollContactManually(workspaceId, flowId, contactId);
}

async function runContactTool(
  workspaceId: string,
  toolType: string,
  input: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const phone = String(input.phone || "");
  if (!phone) throw new Error("phone required");
  const { normalizeE164 } = await import("@/lib/messaging/twilio-mappings");
  const e164 = normalizeE164(phone);
  if (toolType === "create_contact") {
    return await prisma.contact.create({
      data: {
        workspaceId,
        phone: e164,
        firstName: String(input.firstName || "") || null,
        lastName: String(input.lastName || "") || null,
        email: String(input.email || "") || null,
      },
    });
  }
  const existing = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: e164 } },
  });
  if (!existing) throw new Error("Contact not found");
  return await prisma.contact.update({
    where: { id: existing.id },
    data: {
      firstName: input.firstName ? String(input.firstName) : undefined,
      lastName: input.lastName ? String(input.lastName) : undefined,
      email: input.email ? String(input.email) : undefined,
    },
  });
}

/** Queue async tool for background completion */
export async function enqueueAsyncTool(input: ToolExecInput) {
  await enqueueJob({
    jobType: "voice_tool_execute",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: input as Prisma.InputJsonValue,
    idempotencyKey: `voice-tool-${input.toolId}-${input.callId || "none"}-${Date.now()}`,
  });
}
