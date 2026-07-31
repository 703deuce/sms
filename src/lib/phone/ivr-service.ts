import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { assignNumbers, getNumberAssignments } from "./queue-service";

export type IvrAction = "queue" | "forward" | "voicemail" | "agent" | "hangup";

export type IvrOption = {
  digit: string;
  action: IvrAction;
  target?: string | null;
  label?: string | null;
};

export type IvrMenuInput = {
  name: string;
  greeting?: string | null;
  options?: IvrOption[];
  active?: boolean;
  phoneNumberIds?: string[];
};

const VALID_ACTIONS: IvrAction[] = ["queue", "forward", "voicemail", "agent", "hangup"];

function sanitizeOptions(options?: IvrOption[]): IvrOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => ({
      digit: String(o.digit ?? "").trim().slice(0, 1),
      action: VALID_ACTIONS.includes(o.action) ? o.action : "agent",
      target: o.target?.toString().trim() || null,
      label: o.label?.toString().trim() || null,
    }))
    .filter((o) => /^[0-9*#]$/.test(o.digit));
}

export async function listIvrMenus(workspaceId: string) {
  const menus = await getPrisma().ivrMenu.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const assignments = await getNumberAssignments(workspaceId, "ivrMenuId");
  return (menus as Array<{ id: string; optionsJson: unknown }>).map((m) => ({
    ...m,
    options: parseOptions(m.optionsJson),
    phoneNumberIds: assignments[m.id] || [],
  }));
}

export async function getIvrMenu(workspaceId: string, id: string) {
  const menu = await getPrisma().ivrMenu.findFirst({ where: { id, workspaceId } });
  if (!menu) return null;
  const assignments = await getNumberAssignments(workspaceId, "ivrMenuId");
  return {
    ...menu,
    options: parseOptions(menu.optionsJson),
    phoneNumberIds: assignments[menu.id] || [],
  };
}

export async function createIvrMenu(workspaceId: string, input: IvrMenuInput) {
  if (!input.name?.trim()) throw new Error("name is required");
  const menu = await getPrisma().ivrMenu.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      greeting: input.greeting?.trim() || null,
      optionsJson: sanitizeOptions(input.options) as object,
      active: input.active ?? true,
    },
  });
  if (input.phoneNumberIds) {
    await assignNumbers(workspaceId, "ivrMenuId", menu.id, input.phoneNumberIds);
  }
  return getIvrMenu(workspaceId, menu.id);
}

export async function updateIvrMenu(workspaceId: string, id: string, input: IvrMenuInput) {
  const existing = await getPrisma().ivrMenu.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("IVR menu not found");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.greeting !== undefined) data.greeting = input.greeting?.trim() || null;
  if (input.options !== undefined) data.optionsJson = sanitizeOptions(input.options) as object;
  if (input.active !== undefined) data.active = input.active;

  await getPrisma().ivrMenu.update({ where: { id }, data });
  if (input.phoneNumberIds !== undefined) {
    await assignNumbers(workspaceId, "ivrMenuId", id, input.phoneNumberIds);
  }
  return getIvrMenu(workspaceId, id);
}

export async function deleteIvrMenu(workspaceId: string, id: string) {
  const existing = await getPrisma().ivrMenu.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("IVR menu not found");
  await assignNumbers(workspaceId, "ivrMenuId", id, []);
  await getPrisma().ivrMenu.delete({ where: { id } });
  return { ok: true };
}

function parseOptions(optionsJson: unknown): IvrOption[] {
  if (!Array.isArray(optionsJson)) return [];
  return sanitizeOptions(optionsJson as IvrOption[]);
}

/** Resolve the active IVR menu assigned to an inbound number, if any. */
export async function resolveIvrForNumber(workspaceId: string, toE164: string) {
  const prisma = getPrisma();
  const number = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: toE164 },
    select: { settingsJson: true },
  });
  const settings = number?.settingsJson;
  const ivrMenuId =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>).ivrMenuId
      : null;
  if (typeof ivrMenuId !== "string" || !ivrMenuId) return null;
  const menu = await prisma.ivrMenu.findFirst({
    where: { id: ivrMenuId, workspaceId, active: true },
  });
  if (!menu) return null;
  return { ...menu, options: parseOptions(menu.optionsJson) };
}

/**
 * Answer the call and gather a DTMF digit against the IVR's valid options.
 * Best-effort — silently no-ops for mock control ids / when Telnyx is absent.
 */
export async function startIvrGather(
  controlId: string,
  menu: { greeting?: string | null; options: IvrOption[] },
) {
  if (!controlId || controlId.startsWith("mock_")) return { mode: "mock" as const };

  const validDigits = menu.options.map((o) => o.digit).join("") || "0123456789*#";
  const greeting =
    menu.greeting?.trim() ||
    "Thank you for calling. Please listen to the following options.";

  try {
    // Ensure the leg is answered before gathering.
    await telnyxRequest(`/calls/${controlId}/actions/answer`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);

    await telnyxRequest(`/calls/${controlId}/actions/gather_using_speak`, {
      method: "POST",
      body: {
        payload: greeting,
        voice: "female",
        language: "en-US",
        valid_digits: validDigits,
        maximum_digits: 1,
        minimum_digits: 1,
        timeout_millis: 10000,
      },
    });
    return { mode: "telnyx" as const };
  } catch (err) {
    console.warn("[ivr] gather failed", controlId, err);
    return { mode: "error" as const };
  }
}

/** Map a pressed digit to its configured IVR action. */
export function resolveIvrOption(menu: { options: IvrOption[] }, digit: string) {
  const match = menu.options.find((o) => o.digit === String(digit).trim());
  return match ?? null;
}

/**
 * Execute the IVR action for a gathered digit on a live Telnyx call.
 * Returns the resolved action for logging/persistence.
 */
export async function executeIvrAction(input: {
  workspaceId: string;
  controlId: string;
  option: IvrOption;
}) {
  const { workspaceId, controlId, option } = input;
  const isMock = !controlId || controlId.startsWith("mock_");

  if (option.action === "forward" && option.target) {
    if (!isMock) {
      await telnyxRequest(`/calls/${controlId}/actions/transfer`, {
        method: "POST",
        body: { to: option.target },
      }).catch((err) => console.warn("[ivr] forward failed", err));
    }
    return { action: "forward", target: option.target };
  }

  if (option.action === "queue" && option.target) {
    const queue = await getPrisma().callQueue.findFirst({
      where: { id: option.target, workspaceId, active: true },
    });
    return { action: "queue", target: option.target, queueName: queue?.name };
  }

  if (option.action === "voicemail") {
    if (!isMock) {
      await telnyxRequest(`/calls/${controlId}/actions/speak`, {
        method: "POST",
        body: {
          payload: "Please leave a message after the tone.",
          voice: "female",
          language: "en-US",
        },
      }).catch(() => undefined);
      await telnyxRequest(`/calls/${controlId}/actions/record_start`, {
        method: "POST",
        body: { format: "mp3", channels: "single" },
      }).catch(() => undefined);
    }
    return { action: "voicemail", target: null };
  }

  if (option.action === "hangup") {
    if (!isMock) {
      await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }
    return { action: "hangup", target: null };
  }

  // agent — leave the leg answered for a human/AI agent to pick up.
  return { action: option.action, target: option.target ?? null };
}

/**
 * Handle a Telnyx `call.gather.ended` event for an inbound IVR leg: resolve the
 * pressed digit, execute its action, and hand off to the queue/agent flow.
 * Best-effort — returns { handled: false } when the leg is not IVR-routed.
 */
export async function handleIvrGatherEnded(eventPayload: Record<string, unknown>) {
  const controlId = String(eventPayload.call_control_id || "");
  const to = String(eventPayload.to || "");
  const from = String(eventPayload.from || "");
  const digits = String(eventPayload.digits || eventPayload.digit || "").trim();
  const status = String(eventPayload.status || "");
  if (!to) return { handled: false as const };

  const prisma = getPrisma();
  const number = await prisma.phoneNumber.findFirst({ where: { e164: to } });
  if (!number) return { handled: false as const };

  const menu = await resolveIvrForNumber(number.workspaceId, to);
  if (!menu) return { handled: false as const };

  // No / invalid digit — replay the greeting once, then continue.
  if (!digits || status === "timeout" || status === "no_input") {
    await startIvrGather(controlId, menu);
    return { handled: true as const, action: "reprompt" };
  }

  const option = resolveIvrOption(menu, digits);
  if (!option) {
    await startIvrGather(controlId, menu);
    return { handled: true as const, action: "reprompt" };
  }

  const result = await executeIvrAction({
    workspaceId: number.workspaceId,
    controlId,
    option,
  });

  // Hand off queue / agent selections into the human-call flow.
  if (result.action === "queue" || result.action === "agent" || result.action === "voicemail") {
    const { handleInboundHumanCall } = await import("./human-call-service");
    const note =
      result.action === "queue"
        ? `ivr:queue:${(result as { queueName?: string }).queueName || option.target}`
        : `ivr:${result.action}`;
    await handleInboundHumanCall({
      workspaceId: number.workspaceId,
      fromE164: from,
      toE164: to,
      telnyxCallControlId: controlId,
      queueId: result.action === "queue" ? option.target || null : null,
      routingNote: note,
    }).catch((err) => console.warn("[ivr] handoff failed", err));
  }

  return { handled: true as const, action: result.action, digit: digits };
}
