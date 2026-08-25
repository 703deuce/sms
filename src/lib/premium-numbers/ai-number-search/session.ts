import { randomUUID } from "crypto";
import {
  createDefaultNumberSearchState,
  resetNumberSearchState,
} from "./state";
import type { AiNumberSearchMessage, AiNumberSearchSession } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map<string, { session: AiNumberSearchSession; expiresAt: number }>();

function nowIso() {
  return new Date().toISOString();
}

export function getOrCreateAiSession(input: {
  sessionId?: string;
  workspaceId: string;
  userId: string;
  initialSearchState?: import("./types").NumberSearchState;
}): AiNumberSearchSession {
  if (input.sessionId) {
    const hit = sessions.get(input.sessionId);
    if (hit && hit.expiresAt > Date.now() && hit.session.workspaceId === input.workspaceId) {
      hit.expiresAt = Date.now() + TTL_MS;
      return hit.session;
    }
  }

  const session: AiNumberSearchSession = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    userId: input.userId,
    messages: [],
    searchState: input.initialSearchState ?? createDefaultNumberSearchState(),
    selectedNumberIds: [],
    comparedNumberIds: [],
  };
  sessions.set(session.id, { session, expiresAt: Date.now() + TTL_MS });
  return session;
}

export function saveAiSession(session: AiNumberSearchSession) {
  sessions.set(session.id, { session, expiresAt: Date.now() + TTL_MS });
}

export function pushMessage(
  session: AiNumberSearchSession,
  role: AiNumberSearchMessage["role"],
  content: string,
): AiNumberSearchMessage {
  const msg: AiNumberSearchMessage = {
    id: randomUUID(),
    role,
    content,
    createdAt: nowIso(),
  };
  session.messages.push(msg);
  return msg;
}

export function resetAiSession(session: AiNumberSearchSession) {
  session.messages = [];
  session.searchState = resetNumberSearchState();
  session.selectedNumberIds = [];
  session.comparedNumberIds = [];
  session.lastSearchAt = undefined;
}
