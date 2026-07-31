import { getPrisma } from "@/lib/db";

export type QueueStrategy = "ring_all" | "round_robin" | "longest_idle" | "linear";
export type OverflowAction = "voicemail" | "forward" | "hangup";

export type CallQueueInput = {
  name: string;
  strategy?: string;
  timeoutSeconds?: number;
  memberUserIds?: string[];
  overflowAction?: string;
  overflowTarget?: string | null;
  active?: boolean;
  phoneNumberIds?: string[];
};

const VALID_STRATEGIES: QueueStrategy[] = [
  "ring_all",
  "round_robin",
  "longest_idle",
  "linear",
];
const VALID_OVERFLOW: OverflowAction[] = ["voicemail", "forward", "hangup"];

function sanitizeStrategy(strategy?: string): QueueStrategy {
  return VALID_STRATEGIES.includes(strategy as QueueStrategy)
    ? (strategy as QueueStrategy)
    : "ring_all";
}

function sanitizeOverflow(action?: string): OverflowAction {
  return VALID_OVERFLOW.includes(action as OverflowAction)
    ? (action as OverflowAction)
    : "voicemail";
}

export async function listCallQueues(workspaceId: string) {
  const queues = await getPrisma().callQueue.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const assignments = await getNumberAssignments(workspaceId, "queueId");
  return (queues as Array<{ id: string }>).map((q) => ({
    ...q,
    phoneNumberIds: assignments[q.id] || [],
  }));
}

export async function getCallQueue(workspaceId: string, id: string) {
  const queue = await getPrisma().callQueue.findFirst({
    where: { id, workspaceId },
  });
  if (!queue) return null;
  const assignments = await getNumberAssignments(workspaceId, "queueId");
  return { ...queue, phoneNumberIds: assignments[queue.id] || [] };
}

export async function createCallQueue(workspaceId: string, input: CallQueueInput) {
  if (!input.name?.trim()) throw new Error("name is required");
  const queue = await getPrisma().callQueue.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      strategy: sanitizeStrategy(input.strategy),
      timeoutSeconds: clampTimeout(input.timeoutSeconds),
      memberUserIds: input.memberUserIds ?? [],
      overflowAction: sanitizeOverflow(input.overflowAction),
      overflowTarget: input.overflowTarget?.trim() || null,
      active: input.active ?? true,
    },
  });
  if (input.phoneNumberIds) {
    await assignNumbers(workspaceId, "queueId", queue.id, input.phoneNumberIds);
  }
  return getCallQueue(workspaceId, queue.id);
}

export async function updateCallQueue(
  workspaceId: string,
  id: string,
  input: CallQueueInput,
) {
  const existing = await getPrisma().callQueue.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) throw new Error("Queue not found");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.strategy !== undefined) data.strategy = sanitizeStrategy(input.strategy);
  if (input.timeoutSeconds !== undefined) data.timeoutSeconds = clampTimeout(input.timeoutSeconds);
  if (input.memberUserIds !== undefined) data.memberUserIds = input.memberUserIds;
  if (input.overflowAction !== undefined) data.overflowAction = sanitizeOverflow(input.overflowAction);
  if (input.overflowTarget !== undefined) data.overflowTarget = input.overflowTarget?.trim() || null;
  if (input.active !== undefined) data.active = input.active;

  await getPrisma().callQueue.update({ where: { id }, data });
  if (input.phoneNumberIds !== undefined) {
    await assignNumbers(workspaceId, "queueId", id, input.phoneNumberIds);
  }
  return getCallQueue(workspaceId, id);
}

export async function deleteCallQueue(workspaceId: string, id: string) {
  const existing = await getPrisma().callQueue.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) throw new Error("Queue not found");
  await assignNumbers(workspaceId, "queueId", id, []);
  await getPrisma().callQueue.delete({ where: { id } });
  return { ok: true };
}

function clampTimeout(value?: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 30;
  return Math.min(600, Math.max(5, Math.round(n)));
}

/**
 * Resolve the queue that should handle an inbound call to the given number.
 * Looks up the number's routing assignment (PhoneNumber.settingsJson.queueId).
 */
export async function resolveQueueForInbound(workspaceId: string, toE164: string) {
  const prisma = getPrisma();
  const number = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: toE164 },
  });
  const queueId = readSetting(number?.settingsJson, "queueId");
  if (!queueId) return null;
  const queue = await prisma.callQueue.findFirst({
    where: { id: queueId, workspaceId, active: true },
  });
  return queue ?? null;
}

/**
 * Compute the overflow routing decision for a queue (used when no member
 * answers within the queue timeout).
 */
export function resolveQueueOverflow(queue: {
  overflowAction: string;
  overflowTarget: string | null;
}) {
  const action = sanitizeOverflow(queue.overflowAction);
  return {
    action,
    target: queue.overflowTarget || null,
    reason: `queue_overflow:${action}`,
  };
}

// --- number <-> routing assignment helpers -------------------------------

function readSetting(settingsJson: unknown, key: "queueId" | "ivrMenuId") {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const value = (settingsJson as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

export async function getNumberAssignments(
  workspaceId: string,
  key: "queueId" | "ivrMenuId",
): Promise<Record<string, string[]>> {
  const numbers = await getPrisma().phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, settingsJson: true },
  });
  const map: Record<string, string[]> = {};
  for (const n of numbers) {
    const id = readSetting(n.settingsJson, key);
    if (id) {
      map[id] = map[id] || [];
      map[id].push(n.id);
    }
  }
  return map;
}

/**
 * Assign a set of phone numbers to a queue/IVR by writing settingsJson, and
 * clear the assignment from any numbers no longer selected.
 */
export async function assignNumbers(
  workspaceId: string,
  key: "queueId" | "ivrMenuId",
  targetId: string,
  phoneNumberIds: string[],
) {
  const prisma = getPrisma();
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, settingsJson: true },
  });
  const selected = new Set(phoneNumberIds);

  for (const n of numbers) {
    const current = readSetting(n.settingsJson, key);
    const shouldHave = selected.has(n.id);
    if (shouldHave && current === targetId) continue;
    if (!shouldHave && current !== targetId) continue;

    const settings = (n.settingsJson && typeof n.settingsJson === "object"
      ? { ...(n.settingsJson as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    if (shouldHave) {
      settings[key] = targetId;
    } else {
      delete settings[key];
    }
    await prisma.phoneNumber.update({
      where: { id: n.id },
      data: { settingsJson: settings as object },
    });
  }
}
