import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { UI_AGENT_SESSIONS_DIR } from "./config";
import type { UiAgentSession } from "./types";

export function createSessionId(): string {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

export function sessionDir(sessionId: string): string {
  return join(UI_AGENT_SESSIONS_DIR, sessionId);
}

export function saveSession(session: UiAgentSession): string {
  const dir = sessionDir(session.id);
  mkdirSync(join(dir, "current"), { recursive: true });
  mkdirSync(join(dir, "references"), { recursive: true });
  mkdirSync(join(dir, "plans"), { recursive: true });
  writeFileSync(join(dir, "session.json"), JSON.stringify(session, null, 2), "utf8");
  return dir;
}

export function loadSession(sessionId: string): UiAgentSession {
  const path = join(sessionDir(sessionId), "session.json");
  return JSON.parse(readFileSync(path, "utf8")) as UiAgentSession;
}

export function updateSession(session: UiAgentSession): void {
  saveSession(session);
}
