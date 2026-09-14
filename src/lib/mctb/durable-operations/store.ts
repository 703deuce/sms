import "server-only";

import { getPrisma } from "@/lib/db";
import type {
  MctbDurableOperationRecord,
  MctbDurableOperationStatus,
  MctbDurableOperationTraceEvent,
} from "./types";
import { appendTraceEvent } from "./trace";

export type MctbDurableOperationStore = {
  findById(id: string): Promise<MctbDurableOperationRecord | null>;
  findByIdempotencyKey(key: string): Promise<MctbDurableOperationRecord | null>;
  create(input: {
    workspaceId: string;
    conversationId?: string | null;
    voiceCallId?: string | null;
    operationType: string;
    stateVersion?: number | null;
    idempotencyKey: string;
    inputJson: Record<string, unknown>;
  }): Promise<MctbDurableOperationRecord>;
  update(
    id: string,
    patch: Partial<{
      status: MctbDurableOperationStatus;
      attemptCount: number;
      claimedAt: Date | null;
      claimLeaseExpiresAt: Date | null;
      lastAttemptAt: Date | null;
      nextAttemptAt: Date | null;
      completedAt: Date | null;
      resultJson: Record<string, unknown> | null;
      failureClass: string | null;
      failureDetail: string | null;
      traceJson: MctbDurableOperationTraceEvent[];
      inputJson: Record<string, unknown>;
    }>,
  ): Promise<MctbDurableOperationRecord>;
};

function rowToRecord(row: {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  voiceCallId: string | null;
  operationType: string;
  stateVersion: number | null;
  idempotencyKey: string;
  status: string;
  attemptCount: number;
  claimedAt: Date | null;
  claimLeaseExpiresAt: Date | null;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  completedAt: Date | null;
  inputJson: unknown;
  resultJson: unknown;
  failureClass: string | null;
  failureDetail: string | null;
  traceJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MctbDurableOperationRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    voiceCallId: row.voiceCallId,
    operationType: row.operationType,
    stateVersion: row.stateVersion,
    idempotencyKey: row.idempotencyKey,
    status: row.status as MctbDurableOperationStatus,
    attemptCount: row.attemptCount,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    claimLeaseExpiresAt: row.claimLeaseExpiresAt?.toISOString() ?? null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    inputJson: (row.inputJson || {}) as Record<string, unknown>,
    resultJson: row.resultJson ? (row.resultJson as Record<string, unknown>) : null,
    failureClass: row.failureClass,
    failureDetail: row.failureDetail,
    traceJson: Array.isArray(row.traceJson)
      ? (row.traceJson as MctbDurableOperationTraceEvent[])
      : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const prismaStore: MctbDurableOperationStore = {
  async findById(id) {
    const prisma = getPrisma();
    const row = await prisma.mctbDurableOperation.findUnique({ where: { id } });
    return row ? rowToRecord(row) : null;
  },
  async findByIdempotencyKey(key) {
    const prisma = getPrisma();
    const row = await prisma.mctbDurableOperation.findUnique({ where: { idempotencyKey: key } });
    return row ? rowToRecord(row) : null;
  },
  async create(input) {
    const prisma = getPrisma();
    const trace = appendTraceEvent([], "ACCEPTED", {
      operationType: input.operationType,
      idempotencyKey: input.idempotencyKey,
    });
    const row = await prisma.mctbDurableOperation.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId ?? null,
        voiceCallId: input.voiceCallId ?? null,
        operationType: input.operationType,
        stateVersion: input.stateVersion ?? null,
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
        inputJson: input.inputJson as object,
        traceJson: trace as object[],
      },
    });
    return rowToRecord(row);
  },
  async update(id, patch) {
    const prisma = getPrisma();
    const row = await prisma.mctbDurableOperation.update({
      where: { id },
      data: {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.attemptCount !== undefined ? { attemptCount: patch.attemptCount } : {}),
        ...(patch.claimedAt !== undefined ? { claimedAt: patch.claimedAt } : {}),
        ...(patch.claimLeaseExpiresAt !== undefined
          ? { claimLeaseExpiresAt: patch.claimLeaseExpiresAt }
          : {}),
        ...(patch.lastAttemptAt !== undefined ? { lastAttemptAt: patch.lastAttemptAt } : {}),
        ...(patch.nextAttemptAt !== undefined ? { nextAttemptAt: patch.nextAttemptAt } : {}),
        ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
        ...(patch.resultJson !== undefined
          ? { resultJson: patch.resultJson as object | null }
          : {}),
        ...(patch.failureClass !== undefined ? { failureClass: patch.failureClass } : {}),
        ...(patch.failureDetail !== undefined ? { failureDetail: patch.failureDetail } : {}),
        ...(patch.traceJson ? { traceJson: patch.traceJson as object[] } : {}),
        ...(patch.inputJson ? { inputJson: patch.inputJson as object } : {}),
      },
    });
    return rowToRecord(row);
  },
};

const inMemoryRows = new Map<string, MctbDurableOperationRecord>();

const inMemoryStore: MctbDurableOperationStore = {
  async findById(id) {
    return inMemoryRows.get(id) ?? null;
  },
  async findByIdempotencyKey(key) {
    for (const row of inMemoryRows.values()) {
      if (row.idempotencyKey === key) return row;
    }
    return null;
  },
  async create(input) {
    const id = `op_cert_${inMemoryRows.size + 1}`;
    const now = new Date().toISOString();
    const trace = appendTraceEvent([], "ACCEPTED", {
      operationType: input.operationType,
      idempotencyKey: input.idempotencyKey,
    });
    const row: MctbDurableOperationRecord = {
      id,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId ?? null,
      voiceCallId: input.voiceCallId ?? null,
      operationType: input.operationType,
      stateVersion: input.stateVersion ?? null,
      idempotencyKey: input.idempotencyKey,
      status: "PENDING",
      attemptCount: 0,
      claimedAt: null,
      claimLeaseExpiresAt: null,
      lastAttemptAt: null,
      nextAttemptAt: null,
      completedAt: null,
      inputJson: input.inputJson,
      resultJson: null,
      failureClass: null,
      failureDetail: null,
      traceJson: trace,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryRows.set(id, row);
    return row;
  },
  async update(id, patch) {
    const prev = inMemoryRows.get(id);
    if (!prev) throw new Error(`mctb_durable_operation_not_found:${id}`);
    const next: MctbDurableOperationRecord = {
      ...prev,
      ...("status" in patch && patch.status ? { status: patch.status } : {}),
      ...(patch.attemptCount !== undefined ? { attemptCount: patch.attemptCount } : {}),
      ...(patch.claimedAt !== undefined
        ? { claimedAt: patch.claimedAt?.toISOString() ?? null }
        : {}),
      ...(patch.claimLeaseExpiresAt !== undefined
        ? { claimLeaseExpiresAt: patch.claimLeaseExpiresAt?.toISOString() ?? null }
        : {}),
      ...(patch.lastAttemptAt !== undefined
        ? { lastAttemptAt: patch.lastAttemptAt?.toISOString() ?? null }
        : {}),
      ...(patch.nextAttemptAt !== undefined
        ? { nextAttemptAt: patch.nextAttemptAt?.toISOString() ?? null }
        : {}),
      ...(patch.completedAt !== undefined
        ? { completedAt: patch.completedAt?.toISOString() ?? null }
        : {}),
      ...(patch.resultJson !== undefined ? { resultJson: patch.resultJson } : {}),
      ...(patch.failureClass !== undefined ? { failureClass: patch.failureClass } : {}),
      ...(patch.failureDetail !== undefined ? { failureDetail: patch.failureDetail } : {}),
      ...(patch.traceJson ? { traceJson: patch.traceJson } : {}),
      ...(patch.inputJson ? { inputJson: patch.inputJson } : {}),
      updatedAt: new Date().toISOString(),
    };
    inMemoryRows.set(id, next);
    return next;
  },
};

let activeStore: MctbDurableOperationStore = prismaStore;

export function getMctbDurableOperationStore(): MctbDurableOperationStore {
  if (process.env.MCTB_DURABLE_OP_CERT === "1") {
    return inMemoryStore;
  }
  return activeStore;
}

export function setMctbDurableOperationStore(store: MctbDurableOperationStore): void {
  activeStore = store;
}

export function resetCertMctbDurableOperationStore(): void {
  inMemoryRows.clear();
}

export async function appendOperationTrace(
  operationId: string,
  step: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  const store = getMctbDurableOperationStore();
  const row = await store.findById(operationId);
  if (!row) return;
  await store.update(operationId, {
    traceJson: appendTraceEvent(row.traceJson, step, detail),
  });
}
