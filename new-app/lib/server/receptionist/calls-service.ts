import { getPrisma } from "@/lib/server/db";
import { findWorkspaceReceptionistAgent } from "@/lib/server/receptionist/agent-store";
import { mapVoiceCallToUiCall } from "@/lib/server/receptionist/map-voice-call";
import type { Call } from "@/lib/data";

export type ListReceptionistCallsInput = {
  limit?: number;
  page?: number;
  q?: string;
  filter?: string;
  from?: string;
  to?: string;
  numberId?: string;
};

export async function listReceptionistCalls(
  workspaceId: string,
  input: ListReceptionistCallsInput,
): Promise<{ data: Call[]; total: number }> {
  const agent = await findWorkspaceReceptionistAgent(workspaceId);
  const prisma = getPrisma();
  const limit = Math.min(100, Math.max(1, input.limit ?? 25));
  const page = Math.max(0, input.page ?? 0);
  const skip = page * limit;

  const where: Record<string, unknown> = {
    workspaceId,
    direction: "INBOUND",
  };
  if (agent) where.agentId = agent.id;
  if (input.numberId) where.phoneNumberId = input.numberId;
  if (input.from || input.to) {
    where.startedAt = {};
    if (input.from) (where.startedAt as Record<string, Date>).gte = new Date(input.from);
    if (input.to) (where.startedAt as Record<string, Date>).lte = new Date(input.to);
  }
  if (input.q?.trim()) {
    where.OR = [
      { fromE164: { contains: input.q.trim() } },
      { toE164: { contains: input.q.trim() } },
    ];
  }

  const filter = (input.filter || "").toLowerCase();
  if (filter === "booked") where.appointmentBooked = true;
  if (filter === "transferred") where.transferred = true;
  if (filter === "failed") where.status = "FAILED";
  if (filter === "open" || filter === "attention") {
    where.OR = [{ outcome: { contains: "callback", mode: "insensitive" } }];
  }

  const [rows, total] = await Promise.all([
    prisma.voiceCall.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
      include: {
        transcripts: { take: 1, orderBy: { createdAt: "desc" } },
        toolExecutions: { take: 20, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.voiceCall.count({ where }),
  ]);

  const numberIds = [...new Set(rows.map((r) => r.phoneNumberId).filter(Boolean))] as string[];
  const numbers = numberIds.length
    ? await prisma.phoneNumber.findMany({
        where: { id: { in: numberIds } },
        select: { id: true, friendlyName: true, e164: true },
      })
    : [];
  const labelById = new Map(numbers.map((n) => [n.id, n.friendlyName || n.e164]));

  const data = rows.map((row) =>
    mapVoiceCallToUiCall(row, {
      transcript: row.transcripts[0] ?? null,
      tools: row.toolExecutions,
      numberLabel: row.phoneNumberId ? labelById.get(row.phoneNumberId) : undefined,
    }),
  );

  return { data, total };
}

export async function getReceptionistCall(
  workspaceId: string,
  callId: string,
): Promise<Call | null> {
  const prisma = getPrisma();
  const row = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    include: {
      transcripts: { take: 1, orderBy: { createdAt: "desc" } },
      toolExecutions: { orderBy: { createdAt: "asc" } },
      recordings: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) return null;

  let numberLabel: string | undefined;
  if (row.phoneNumberId) {
    const num = await prisma.phoneNumber.findUnique({
      where: { id: row.phoneNumberId },
      select: { friendlyName: true, e164: true },
    });
    numberLabel = num?.friendlyName || num?.e164;
  }

  const mapped = mapVoiceCallToUiCall(row, {
    transcript: row.transcripts[0] ?? null,
    tools: row.toolExecutions,
    numberLabel,
  });
  if (row.recordings[0]?.storageUrl) {
    mapped.recording = true;
    mapped.recordingUrl = `/api/receptionist/calls/${row.id}/recording/stream`;
  }
  return mapped;
}
