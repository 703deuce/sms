import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV2EnrollmentSnapshot } from "./types";

export type BuildEnrollmentInput = {
  workspaceId: string;
  agentId: string;
  callId?: string | null;
};

/** Best-effort pinned enrollment identity — no invented revision strings. */
export async function buildVoiceV2EnrollmentSnapshot(
  input: BuildEnrollmentInput,
): Promise<VoiceV2EnrollmentSnapshot> {
  const gaps: string[] = [];
  const enrolledAt = new Date().toISOString();
  const snapshot: VoiceV2EnrollmentSnapshot = { enrolledAt };

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { publishedVersionId: true, id: true },
  });

  if (agent?.publishedVersionId) {
    snapshot.publishedConfigRevision = agent.publishedVersionId;
    snapshot.agentRevision = agent.publishedVersionId;
  } else {
    gaps.push("publishedConfigRevision");
    gaps.push("agentRevision");
  }

  if (input.callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
      select: { metadata: true, voiceConfigFingerprint: true },
    });
    const fp = (call?.voiceConfigFingerprint || {}) as Record<string, unknown>;
    const meta = (call?.metadata || {}) as Record<string, unknown>;
    const configFp = String(fp.configFingerprint || meta.configFingerprint || "").trim();
    if (configFp) {
      (snapshot as VoiceV2EnrollmentSnapshot & { configFingerprint?: string }).configFingerprint =
        configFp;
    }
    const bkr = String(fp.businessKnowledgeRevision || meta.businessKnowledgeRevision || "").trim();
    if (bkr) snapshot.businessKnowledgeRevision = bkr;
    else gaps.push("businessKnowledgeRevision");
  } else {
    gaps.push("businessKnowledgeRevision");
  }

  gaps.push("providerConfigRevision");

  if (gaps.length) snapshot.revisionGaps = [...new Set(gaps)];
  return snapshot;
}
