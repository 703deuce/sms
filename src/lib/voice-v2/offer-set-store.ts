import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import type { VoiceV2Slot } from "./types";

export const VOICE_V2_OFFER_TTL_MS = 30 * 60_000;

function shouldUseTestOfferSetMemory(): boolean {
  const mode = String(process.env.VOICE_V2_TEST_EXECUTORS || "").trim().toLowerCase();
  return mode === "fake" || mode === "inject";
}

export type StoredVoiceV2OfferSet = {
  offerSetId: string;
  workspaceId: string;
  voiceCallId: string | null;
  slots: VoiceV2Slot[];
  serviceName: string;
  timezone: string;
  connectionId: string | null;
  expiresAt: Date;
};

export function newOfferSetId(): string {
  return `v2offer_${createId()}`;
}

export async function persistVoiceV2OfferSet(input: {
  workspaceId: string;
  voiceCallId?: string | null;
  slots: VoiceV2Slot[];
  serviceName: string;
  timezone: string;
  connectionId: string | null;
  ttlMs?: number;
}): Promise<StoredVoiceV2OfferSet> {
  const offerSetId = newOfferSetId();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? VOICE_V2_OFFER_TTL_MS));
  const prisma = getPrisma();
  await prisma.voiceV2OfferSet.create({
    data: {
      id: offerSetId,
      workspaceId: input.workspaceId,
      voiceCallId: input.voiceCallId ?? null,
      slotsJson: input.slots as object,
      serviceName: input.serviceName,
      timezone: input.timezone,
      connectionId: input.connectionId,
      expiresAt,
    },
  });
  return {
    offerSetId,
    workspaceId: input.workspaceId,
    voiceCallId: input.voiceCallId ?? null,
    slots: input.slots,
    serviceName: input.serviceName,
    timezone: input.timezone,
    connectionId: input.connectionId,
    expiresAt,
  };
}

const testOfferSetMemory = new Map<string, StoredVoiceV2OfferSet>();

/** Orchestration / CI only — in-memory offer sets when VOICE_V2_TEST_EXECUTORS=fake. */
export function seedVoiceV2OfferSetForTest(offer: StoredVoiceV2OfferSet): void {
  testOfferSetMemory.set(`${offer.workspaceId}:${offer.offerSetId}`, offer);
}

export function clearVoiceV2OfferSetTestStore(): void {
  testOfferSetMemory.clear();
}

export async function loadVoiceV2OfferSet(
  workspaceId: string,
  offerSetId: string,
): Promise<StoredVoiceV2OfferSet | null> {
  const memKey = `${workspaceId}:${offerSetId}`;
  const mem = testOfferSetMemory.get(memKey);
  if (mem && shouldUseTestOfferSetMemory()) {
    if (mem.expiresAt.getTime() <= Date.now()) return null;
    return mem;
  }
  const prisma = getPrisma();
  const row = await prisma.voiceV2OfferSet.findFirst({
    where: { id: offerSetId, workspaceId },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  const raw = row.slotsJson;
  const slots = Array.isArray(raw)
    ? (raw as VoiceV2Slot[])
    : (raw as { slots?: VoiceV2Slot[] }).slots || [];
  return {
    offerSetId: row.id,
    workspaceId: row.workspaceId,
    voiceCallId: row.voiceCallId,
    slots,
    serviceName: row.serviceName,
    timezone: row.timezone,
    connectionId: row.connectionId,
    expiresAt: row.expiresAt,
  };
}
