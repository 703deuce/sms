import { getPrisma } from "@/lib/server/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { loadAppointmentReceptionistSetup } from "../save-setup";
import type { AppointmentReceptionistWizardState } from "../types";
import { diffWizardStates } from "./diff";
import { flattenWizardState } from "./flatten";

export function readWizardConfigRevision(draftConfig: unknown): number {
  const config = parseVoiceAgentConfig(draftConfig);
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const raw = advanced.wizardConfigRevision;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

export async function verifyPersistedWizardState(input: {
  workspaceId: string;
  agentId: string;
  expected: AppointmentReceptionistWizardState;
  expectedRevision?: number;
}): Promise<{
  persistedRevision: number;
  revisionMatch: boolean;
  diff: ReturnType<typeof diffWizardStates>;
  missingPaths: string[];
  unexpectedPaths: string[];
}> {
  const authoritative = await loadAppointmentReceptionistSetup(input.workspaceId, {
    agentId: input.agentId,
  });
  const persisted = (authoritative?.state || {}) as AppointmentReceptionistWizardState;

  const agent = await getPrisma().voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { draftConfig: true },
  });
  const persistedRevision = readWizardConfigRevision(agent?.draftConfig);

  const diff = diffWizardStates(input.expected, persisted);
  const expectedFlat = flattenWizardState(input.expected);
  const persistedFlat = flattenWizardState(persisted);

  const missingPaths: string[] = [];
  const unexpectedPaths: string[] = [];

  for (const path of diff.changed) {
    if (!(path in persistedFlat) && path in expectedFlat) missingPaths.push(path);
    else unexpectedPaths.push(path);
  }

  return {
    persistedRevision,
    revisionMatch:
      input.expectedRevision === undefined
        ? true
        : persistedRevision === input.expectedRevision,
    diff,
    missingPaths,
    unexpectedPaths,
  };
}
