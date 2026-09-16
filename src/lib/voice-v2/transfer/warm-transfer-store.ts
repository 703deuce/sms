import "server-only";

import { getVoiceV2SharedRedis } from "../session/redis-client";
import { VOICE_V2_CALL_CONTEXT_TTL_SEC } from "../session/types";
import type { VoiceV2WarmTransferSession } from "./warm-transfer-types";

const memoryById = new Map<string, VoiceV2WarmTransferSession>();
const memoryByConsult = new Map<string, string>();
const memoryByCaller = new Map<string, string>();

function redisKey(id: string): string {
  return `voice:v2:warm-transfer:${id}`;
}

function redisConsultKey(consultControlId: string): string {
  return `voice:v2:warm-transfer:consult:${consultControlId}`;
}

export async function saveWarmTransferSession(session: VoiceV2WarmTransferSession): Promise<void> {
  memoryById.set(session.id, session);
  if (session.consultationCallControlId) {
    memoryByConsult.set(session.consultationCallControlId, session.id);
  }
  memoryByCaller.set(session.callerCallControlId, session.id);

  const r = await getVoiceV2SharedRedis();
  if (!r) return;
  try {
    await r.set(redisKey(session.id), JSON.stringify(session), "EX", VOICE_V2_CALL_CONTEXT_TTL_SEC);
    if (session.consultationCallControlId) {
      await r.set(
        redisConsultKey(session.consultationCallControlId),
        session.id,
        "EX",
        VOICE_V2_CALL_CONTEXT_TTL_SEC,
      );
    }
  } catch {
    // non-blocking
  }
}

async function loadById(id: string): Promise<VoiceV2WarmTransferSession | null> {
  const mem = memoryById.get(id);
  if (mem) return mem;
  const r = await getVoiceV2SharedRedis();
  if (!r) return null;
  try {
    const raw = await r.get(redisKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VoiceV2WarmTransferSession;
    memoryById.set(id, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function getWarmTransferSessionById(
  id: string,
): Promise<VoiceV2WarmTransferSession | null> {
  return loadById(id);
}

export async function getWarmTransferSessionByConsultControlId(
  consultControlId: string,
): Promise<VoiceV2WarmTransferSession | null> {
  const memId = memoryByConsult.get(consultControlId);
  if (memId) return loadById(memId);
  const r = await getVoiceV2SharedRedis();
  if (!r) return null;
  try {
    const id = await r.get(redisConsultKey(consultControlId));
    if (!id) return null;
    return loadById(id);
  } catch {
    return null;
  }
}

export async function getWarmTransferSessionByCallerControlId(
  callerControlId: string,
): Promise<VoiceV2WarmTransferSession | null> {
  const memId = memoryByCaller.get(callerControlId);
  if (!memId) return null;
  return loadById(memId);
}

export function clearWarmTransferStoreForTests(): void {
  memoryById.clear();
  memoryByConsult.clear();
  memoryByCaller.clear();
}
