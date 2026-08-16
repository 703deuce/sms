import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import type { PythonRuntimeError } from "./types";

/** Lightweight knowledge lookup for Python FAQ tool. */
export async function businessAnswerForPython(input: {
  workspaceId: string;
  agentId: string;
  topic: string;
}): Promise<{ ok: true; speak: string } | PythonRuntimeError> {
  const result = await resolveBusinessAnswer({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    topic: input.topic,
  });
  if (!result.ok) {
    return { ok: false, error: result.speak || "Knowledge lookup failed", code: "KNOWLEDGE_FAILED" };
  }
  return { ok: true, speak: result.speak };
}
