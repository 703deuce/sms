import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  getMessagingRuntimeSettings,
  isWithinBusinessHours,
} from "@/lib/messaging/messaging-settings";
import { assignNumbers, getNumberAssignments } from "./queue-service";

export type IvrAction =
  | "queue"
  | "forward"
  | "voicemail"
  | "agent"
  | "hangup"
  | "submenu";

export type IvrOption = {
  digit: string;
  action: IvrAction;
  target?: string | null;
  label?: string | null;
};

export type IvrMenuPayload = {
  options: IvrOption[];
  afterHoursGreeting?: string | null;
  afterHoursOptions?: IvrOption[];
};

export type IvrMenuInput = {
  name: string;
  greeting?: string | null;
  options?: IvrOption[];
  afterHoursGreeting?: string | null;
  afterHoursOptions?: IvrOption[];
  active?: boolean;
  phoneNumberIds?: string[];
};

const VALID_ACTIONS: IvrAction[] = [
  "queue",
  "forward",
  "voicemail",
  "agent",
  "hangup",
  "submenu",
];

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

function packOptionsJson(input: {
  options?: IvrOption[];
  afterHoursGreeting?: string | null;
  afterHoursOptions?: IvrOption[];
}): object {
  const payload: IvrMenuPayload = {
    options: sanitizeOptions(input.options),
    afterHoursGreeting: input.afterHoursGreeting?.trim() || null,
    afterHoursOptions: sanitizeOptions(input.afterHoursOptions),
  };
  return payload as object;
}

function parseMenuPayload(optionsJson: unknown): IvrMenuPayload {
  if (Array.isArray(optionsJson)) {
    return { options: sanitizeOptions(optionsJson as IvrOption[]) };
  }
  if (optionsJson && typeof optionsJson === "object") {
    const obj = optionsJson as Record<string, unknown>;
    if (Array.isArray(obj.options)) {
      return {
        options: sanitizeOptions(obj.options as IvrOption[]),
        afterHoursGreeting:
          typeof obj.afterHoursGreeting === "string" ? obj.afterHoursGreeting : null,
        afterHoursOptions: sanitizeOptions(obj.afterHoursOptions as IvrOption[] | undefined),
      };
    }
  }
  return { options: [] };
}

function parseOptions(optionsJson: unknown): IvrOption[] {
  return parseMenuPayload(optionsJson).options;
}

export async function listIvrMenus(workspaceId: string) {
  const menus = await getPrisma().ivrMenu.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const assignments = await getNumberAssignments(workspaceId, "ivrMenuId");
  return (menus as Array<{ id: string; optionsJson: unknown; greeting: string | null }>).map(
    (m) => {
      const payload = parseMenuPayload(m.optionsJson);
      return {
        ...m,
        options: payload.options,
        afterHoursGreeting: payload.afterHoursGreeting || null,
        afterHoursOptions: payload.afterHoursOptions || [],
        phoneNumberIds: assignments[m.id] || [],
      };
    },
  );
}

export async function getIvrMenu(workspaceId: string, id: string) {
  const menu = await getPrisma().ivrMenu.findFirst({ where: { id, workspaceId } });
  if (!menu) return null;
  const assignments = await getNumberAssignments(workspaceId, "ivrMenuId");
  const payload = parseMenuPayload(menu.optionsJson);
  return {
    ...menu,
    options: payload.options,
    afterHoursGreeting: payload.afterHoursGreeting || null,
    afterHoursOptions: payload.afterHoursOptions || [],
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
      optionsJson: packOptionsJson(input),
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
  if (
    input.options !== undefined ||
    input.afterHoursGreeting !== undefined ||
    input.afterHoursOptions !== undefined
  ) {
    const current = parseMenuPayload(existing.optionsJson);
    data.optionsJson = packOptionsJson({
      options: input.options ?? current.options,
      afterHoursGreeting:
        input.afterHoursGreeting !== undefined
          ? input.afterHoursGreeting
          : current.afterHoursGreeting,
      afterHoursOptions: input.afterHoursOptions ?? current.afterHoursOptions,
    });
  }
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

  const payload = parseMenuPayload(menu.optionsJson);
  let greeting = menu.greeting;
  let options = payload.options;

  // After-hours menus when configured.
  if (payload.afterHoursOptions?.length) {
    const runtime = await getMessagingRuntimeSettings(workspaceId).catch(() => null);
    const withinHours = runtime ? isWithinBusinessHours(runtime, new Date()) : true;
    if (!withinHours) {
      greeting = payload.afterHoursGreeting || greeting;
      options = payload.afterHoursOptions;
    }
  }

  return { ...menu, greeting, options, payload };
}

/**
 * Answer the call and gather a DTMF digit against the IVR's valid options.
 * Best-effort — silently no-ops for mock control ids / when Telnyx is absent.
 */
export async function startIvrGather(
  controlId: string,
  menu: { greeting?: string | null; options: IvrOption[]; id?: string },
  meta?: { menuId?: string; depth?: number },
) {
  if (!controlId || controlId.startsWith("mock_")) return { mode: "mock" as const };

  const validDigits = menu.options.map((o) => o.digit).join("") || "0123456789*#";
  const greeting =
    menu.greeting?.trim() ||
    "Thank you for calling. Please listen to the following options.";

  try {
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
        client_state: Buffer.from(
          JSON.stringify({
            kind: "ivr_gather",
            menuId: meta?.menuId || menu.id || null,
            depth: meta?.depth || 0,
          }),
        ).toString("base64"),
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
  depth?: number;
}) {
  const { workspaceId, controlId, option } = input;
  const isMock = !controlId || controlId.startsWith("mock_");
  const depth = input.depth || 0;

  if (option.action === "submenu" && option.target) {
    if (depth >= 5) {
      if (!isMock) {
        await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
          method: "POST",
          body: {},
        }).catch(() => undefined);
      }
      return { action: "hangup" as const, target: null, reason: "max_depth" };
    }
    const submenu = await getIvrMenu(workspaceId, option.target);
    if (submenu) {
      // Honor after-hours options on nested menus too.
      let greeting = submenu.greeting;
      let options = submenu.options;
      if (submenu.afterHoursOptions?.length) {
        const runtime = await getMessagingRuntimeSettings(workspaceId).catch(() => null);
        const withinHours = runtime ? isWithinBusinessHours(runtime, new Date()) : true;
        if (!withinHours) {
          greeting = submenu.afterHoursGreeting || greeting;
          options = submenu.afterHoursOptions;
        }
      }
      await startIvrGather(
        controlId,
        { greeting, options, id: submenu.id },
        { menuId: submenu.id, depth: depth + 1 },
      );
      return { action: "submenu" as const, target: option.target, depth: depth + 1 };
    }
  }

  if (option.action === "forward" && option.target) {
    if (!isMock) {
      await telnyxRequest(`/calls/${controlId}/actions/transfer`, {
        method: "POST",
        body: { to: option.target },
      }).catch((err) => console.warn("[ivr] forward failed", err));
    }
    return { action: "forward" as const, target: option.target };
  }

  if (option.action === "queue" && option.target) {
    const queue = await getPrisma().callQueue.findFirst({
      where: { id: option.target, workspaceId, active: true },
    });
    return { action: "queue" as const, target: option.target, queueName: queue?.name };
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
    return { action: "voicemail" as const, target: null };
  }

  if (option.action === "hangup") {
    if (!isMock) {
      await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }
    return { action: "hangup" as const, target: null };
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

  let depth = 0;
  let menuId: string | null = null;
  if (typeof eventPayload.client_state === "string") {
    try {
      const state = JSON.parse(
        Buffer.from(eventPayload.client_state, "base64").toString("utf8"),
      ) as Record<string, unknown>;
      if (state.kind && state.kind !== "ivr_gather") {
        return { handled: false as const };
      }
      if (typeof state.menuId === "string") menuId = state.menuId;
      if (typeof state.depth === "number") depth = state.depth;
    } catch {
      // ignore
    }
  }

  let menu =
    menuId != null
      ? await getIvrMenu(number.workspaceId, menuId)
      : await resolveIvrForNumber(number.workspaceId, to);
  if (!menu) return { handled: false as const };

  // No / invalid digit — replay the greeting once, then continue.
  if (!digits || status === "timeout" || status === "no_input") {
    await startIvrGather(controlId, menu, { menuId: menu.id, depth });
    return { handled: true as const, action: "reprompt" };
  }

  const option = resolveIvrOption(menu, digits);
  if (!option) {
    await startIvrGather(controlId, menu, { menuId: menu.id, depth });
    return { handled: true as const, action: "reprompt" };
  }

  const result = await executeIvrAction({
    workspaceId: number.workspaceId,
    controlId,
    option,
    depth,
  });

  // Submenu already started a new gather.
  if (result.action === "submenu") {
    return { handled: true as const, action: "submenu", digit: digits, target: result.target };
  }

  // Hand off queue / agent / voicemail into the human-call flow.
  // IVR already answered the PSTN leg — hold for softphone/cellular pickup.
  if (result.action === "queue" || result.action === "agent" || result.action === "voicemail") {
    const { handleInboundHumanCall } = await import("./human-call-service");
    const agentUserId =
      result.action === "agent" && option.target ? String(option.target) : null;
    const note =
      result.action === "queue"
        ? `ivr:queue:${(result as { queueName?: string }).queueName || option.target}`
        : result.action === "agent"
          ? agentUserId
            ? `forward_user:${agentUserId}`
            : "ivr:agent"
          : "ivr:voicemail";

    const human = await handleInboundHumanCall({
      workspaceId: number.workspaceId,
      fromE164: from,
      toE164: to,
      telnyxCallControlId: controlId,
      queueId: result.action === "queue" ? option.target || null : null,
      routingNote: note,
      // Leg already answered by IVR gather — do not re-answer; queues still ring members.
      autoAnswer: result.action === "queue",
    }).catch((err) => {
      console.warn("[ivr] handoff failed", err);
      return null;
    });

    if (human && result.action === "agent" && controlId && !controlId.startsWith("mock_")) {
      const { telnyxRequest: tx } = await import("@/lib/messaging/telnyx/client");
      await tx(`/calls/${controlId}/actions/hold`, { method: "POST", body: {} }).catch(
        () => undefined,
      );
      await getPrisma().humanCall.update({
        where: { id: human.callId },
        data: {
          status: "ringing",
          onHold: true,
          agentUserId: agentUserId || undefined,
          notes: note,
        },
      }).catch(() => undefined);

      // Prefer cellular bridge when the target has forwardToCellular configured.
      if (agentUserId) {
        const settings = await getPrisma().softphoneUserSettings.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: number.workspaceId,
              userId: agentUserId,
            },
          },
        });
        const cell = settings?.forwardToCellular;
        const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
        if (cell && connectionId) {
          await tx("/calls", {
            method: "POST",
            body: {
              connection_id: connectionId,
              from: to,
              to: cell,
              client_state: Buffer.from(
                JSON.stringify({
                  workspaceId: number.workspaceId,
                  humanCallId: human.callId,
                  kind: "queue_member_ring",
                  parentCallControlId: controlId,
                  userId: agentUserId,
                }),
              ).toString("base64"),
            },
          }).catch(() => undefined);
        }
      }
    }

    if (human && result.action === "voicemail" && controlId) {
      const { leaveVoicemailOnCall } = await import("./voicemail-service");
      await leaveVoicemailOnCall({
        workspaceId: number.workspaceId,
        humanCallId: human.callId,
        telnyxCallControlId: controlId,
        userId: agentUserId,
      }).catch(() => undefined);
    }
  }

  return { handled: true as const, action: result.action, digit: digits };
}
