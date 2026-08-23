import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isMissedRoutedOutcomeForEmployee } from "./last-caller-heuristics";

export type LastRoutedCallerMatch = {
  callerE164: string;
  sessionId: string;
  matchedAt: Date;
  matchKind: "ring_group" | "whisper" | "transfer";
};

const LOOKBACK_DAYS = Number(process.env.SR_LAST_CALLER_LOOKBACK_DAYS || "14");

function phonesMatch(a: string, b: string): boolean {
  try {
    return normalizeE164(a) === normalizeE164(b);
  } catch {
    return false;
  }
}

function extractPhoneFromReceipt(
  command: string,
  request: Record<string, unknown> | null,
): string[] {
  if (!request) return [];
  if (command === "ring_group_dial") {
    const targets = request.targets as string[] | undefined;
    return (targets ?? []).filter(Boolean);
  }
  if (command === "whisper_dial") {
    const to = request.to as string | undefined;
    return to ? [to] : [];
  }
  return [];
}

function extractPhoneFromNodeResult(result: Record<string, unknown> | null): string | null {
  if (!result) return null;
  const whisper = result.whisperTo as string | undefined;
  if (whisper?.trim()) return whisper.trim();
  const transfer = result.transferTo as string | undefined;
  if (transfer?.trim()) return transfer.trim();
  return null;
}

/**
 * Most recent inbound caller routed to this employee's phone who likely still needs a callback.
 * Uses ring-group targets, whisper dials, and direct transfers — not workspace-wide MCTB missed calls.
 */
export async function findLastRoutedCallerForEmployee(input: {
  workspaceId: string;
  employeePhoneE164: string;
  authorizedCallerId?: string | null;
}): Promise<LastRoutedCallerMatch | null> {
  const prisma = getPrisma();
  const employeePhone = normalizeE164(input.employeePhoneE164);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const candidates: LastRoutedCallerMatch[] = [];

  const receipts = await prisma.smartRoutingCommandReceipt.findMany({
    where: {
      providerCommand: { in: ["ring_group_dial", "whisper_dial"] },
      createdAt: { gte: since },
      callSession: { workspaceId: input.workspaceId, isTest: false },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      callSession: {
        select: { id: true, callerNumber: true, finalOutcome: true },
      },
    },
  });

  for (const receipt of receipts) {
    const session = receipt.callSession;
    if (!session?.callerNumber) continue;
    if (phonesMatch(session.callerNumber, employeePhone)) continue;
    if (!isMissedRoutedOutcomeForEmployee(session.finalOutcome)) continue;

    const request = receipt.requestJson as Record<string, unknown> | null;
    const phones = extractPhoneFromReceipt(receipt.providerCommand, request);
    const matched = phones.some((p) => phonesMatch(p, employeePhone));
    if (!matched) continue;

    candidates.push({
      callerE164: session.callerNumber,
      sessionId: session.id,
      matchedAt: receipt.createdAt,
      matchKind: receipt.providerCommand === "whisper_dial" ? "whisper" : "ring_group",
    });
  }

  const executions = await prisma.smartRoutingNodeExecution.findMany({
    where: {
      startedAt: { gte: since },
      callSession: { workspaceId: input.workspaceId, isTest: false },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: {
      callSession: {
        select: { id: true, callerNumber: true, finalOutcome: true },
      },
    },
  });

  for (const exec of executions) {
    const session = exec.callSession;
    if (!session?.callerNumber) continue;
    if (phonesMatch(session.callerNumber, employeePhone)) continue;
    if (!isMissedRoutedOutcomeForEmployee(session.finalOutcome)) continue;

    const result = exec.resultJson as Record<string, unknown> | null;
    const target = extractPhoneFromNodeResult(result);
    if (!target || !phonesMatch(target, employeePhone)) continue;

    candidates.push({
      callerE164: session.callerNumber,
      sessionId: session.id,
      matchedAt: exec.startedAt,
      matchKind: result?.whisperTo ? "whisper" : "transfer",
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.matchedAt.getTime() - a.matchedAt.getTime());
  return candidates[0];
}
