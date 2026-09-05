import "server-only";

import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import type { AppointmentAiChannel } from "./schema";
import type { ProposedWriteAction, ResolverOutcome } from "./schema";

const PENDING_STALE_MS = 5 * 60_000;

/** Fast local optimization only — not the correctness boundary. */
const LOCAL_MUTATION_CACHE = new Map<string, number>();
const LOCAL_CACHE_TTL_MS = 300_000;

export type MutationClaimResult =
  | { kind: "claimed"; recordId: string }
  | { kind: "duplicate"; outcome: ResolverOutcome }
  | { kind: "in_progress" };

function stableActionPayload(action: ProposedWriteAction): string {
  switch (action.kind) {
    case "BOOK":
      return JSON.stringify({
        kind: action.kind,
        serviceName: action.serviceName,
        startsAt: action.startsAt,
        appointmentTypeId: action.appointmentTypeId || null,
      });
    case "RESCHEDULE":
      return JSON.stringify({
        kind: action.kind,
        appointmentId: action.appointmentId,
        startsAt: action.startsAt,
      });
    case "CANCEL":
      return JSON.stringify({ kind: action.kind, appointmentId: action.appointmentId });
    case "CONFIRM":
      return JSON.stringify({ kind: action.kind, appointmentId: action.appointmentId });
    case "JOIN_WAITLIST":
      return JSON.stringify({
        kind: action.kind,
        serviceName: action.serviceName || null,
        appointmentTypeId: action.appointmentTypeId || null,
      });
    default:
      return JSON.stringify(action);
  }
}

/**
 * Durable idempotency key — scoped per workspace, request, and exact action payload.
 * requestId should be providerMessageId for SMS or an explicit client/request identifier.
 */
export function buildAppointmentAiMutationIdempotencyKey(input: {
  workspaceId: string;
  requestId: string;
  action: ProposedWriteAction;
}): string {
  const digest = createHash("sha256")
    .update(stableActionPayload(input.action))
    .digest("hex")
    .slice(0, 16);
  return `appt-ai:${input.workspaceId}:${input.requestId}:${input.action.kind}:${digest}`;
}

function localCacheHit(key: string): boolean {
  const now = Date.now();
  const prev = LOCAL_MUTATION_CACHE.get(key);
  if (prev && now - prev < LOCAL_CACHE_TTL_MS) return true;
  LOCAL_MUTATION_CACHE.set(key, now);
  return false;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const message = err instanceof Error ? err.message : String(err);
  return code === "P2002" || /duplicate|unique/i.test(message);
}

function parseStoredOutcome(raw: unknown): ResolverOutcome | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as ResolverOutcome;
  if (!o.status || typeof o.mutationExecuted !== "boolean") return null;
  return o;
}

function duplicateOutcomeFromRecord(
  record: {
    outcomeJson: unknown;
    errorMessage: string | null;
    status: string;
  },
): ResolverOutcome {
  const stored = parseStoredOutcome(record.outcomeJson);
  if (stored) {
    return {
      ...stored,
      reason: stored.reason || "That request was already processed.",
      mutationExecuted: false,
    };
  }
  if (record.status === "failed") {
    return {
      status: "ERROR",
      reason: record.errorMessage || "That request already failed.",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }
  return {
    status: "NO_OP",
    reason: "That request was already processed.",
    requiresVerifier: false,
    mutationExecuted: false,
  };
}

export async function claimAppointmentAiMutation(input: {
  workspaceId: string;
  idempotencyKey: string;
  requestId: string;
  contactId?: string;
  channel: AppointmentAiChannel;
  action: ProposedWriteAction;
}): Promise<MutationClaimResult> {
  if (localCacheHit(input.idempotencyKey)) {
    const prisma = getPrisma();
    const existing = await prisma.appointmentAiMutationRecord.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing?.status === "completed") {
      return { kind: "duplicate", outcome: duplicateOutcomeFromRecord(existing) };
    }
    if (existing?.status === "pending") {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < PENDING_STALE_MS) return { kind: "in_progress" };
    }
  }

  const prisma = getPrisma();

  try {
    const row = await prisma.appointmentAiMutationRecord.create({
      data: {
        id: createId(),
        workspaceId: input.workspaceId,
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
        contactId: input.contactId || null,
        channel: input.channel,
        actionKind: input.action.kind,
        actionPayloadJson: JSON.parse(stableActionPayload(input.action)) as object,
        status: "pending",
      },
    });
    return { kind: "claimed", recordId: row.id };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;

    const existing = await prisma.appointmentAiMutationRecord.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (!existing) {
      return { kind: "in_progress" };
    }

    if (existing.status === "completed") {
      return { kind: "duplicate", outcome: duplicateOutcomeFromRecord(existing) };
    }

    if (existing.status === "pending") {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < PENDING_STALE_MS) {
        return { kind: "in_progress" };
      }
      await prisma.appointmentAiMutationRecord.update({
        where: { id: existing.id },
        data: { status: "pending", errorMessage: null },
      });
      return { kind: "claimed", recordId: existing.id };
    }

    if (existing.status === "failed") {
      await prisma.appointmentAiMutationRecord.update({
        where: { id: existing.id },
        data: { status: "pending", errorMessage: null, outcomeJson: null, completedAt: null },
      });
      return { kind: "claimed", recordId: existing.id };
    }

    return { kind: "in_progress" };
  }
}

export async function completeAppointmentAiMutation(
  recordId: string,
  outcome: ResolverOutcome,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.appointmentAiMutationRecord.update({
    where: { id: recordId },
    data: {
      status: "completed",
      outcomeJson: outcome as object,
      completedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function failAppointmentAiMutation(
  recordId: string,
  errorMessage: string,
  outcome?: ResolverOutcome,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.appointmentAiMutationRecord.update({
    where: { id: recordId },
    data: {
      status: "failed",
      errorMessage,
      outcomeJson: outcome ? (outcome as object) : null,
      completedAt: new Date(),
    },
  });
}

export function inProgressResolverOutcome(): ResolverOutcome {
  return {
    status: "NO_OP",
    reason: "That request is already being processed. Please wait a moment.",
    requiresVerifier: false,
    mutationExecuted: false,
  };
}

export function duplicateResolverOutcome(reason?: string): ResolverOutcome {
  return {
    status: "NO_OP",
    reason: reason || "That request was already processed.",
    requiresVerifier: false,
    mutationExecuted: false,
  };
}
