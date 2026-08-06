/**
 * Compare expected active AgentVersion vs live Telnyx assistant configuration.
 * Does not redeploy blindly — surfaces drift for inspect / redeploy / pause.
 */

import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { HealthCheck, HealthLevel } from "@/lib/agents/appointment-booking/types";

export type DeploymentDriftReport = {
  status: HealthLevel;
  message: string;
  expectedVersionId: string | null;
  expectedVersionNumber: number | null;
  telnyxAssistantId: string | null;
  expectedPromptHash: string | null;
  remotePromptHash: string | null;
  drifted: boolean;
  differences: string[];
  actions: Array<"inspect" | "redeploy_expected" | "import_external" | "pause_amy">;
  checkedAt: string;
};

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function expectedInstructionsHash(draftConfig: unknown): string | null {
  const config = parseVoiceAgentConfig(draftConfig || {});
  const raw =
    config.instructions?.raw ||
    [config.instructions?.system, config.instructions?.role, config.instructions?.goals]
      .filter(Boolean)
      .join("\n");
  if (!raw?.trim()) return null;
  return hashText(raw.trim());
}

function healthFromDrift(report: DeploymentDriftReport): HealthCheck {
  return {
    status: report.status,
    message: report.message,
    required: true,
    checkedAt: report.checkedAt,
  };
}

export async function detectDeploymentDrift(input: {
  workspaceId: string;
  agentId: string;
  /** When false, skip live Telnyx fetch (hash DB-only). */
  fetchRemote?: boolean;
}): Promise<DeploymentDriftReport> {
  const prisma = getPrisma();
  const now = new Date().toISOString();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) {
    return {
      status: "failed",
      message: "Agent not found",
      expectedVersionId: null,
      expectedVersionNumber: null,
      telnyxAssistantId: null,
      expectedPromptHash: null,
      remotePromptHash: null,
      drifted: false,
      differences: ["agent_missing"],
      actions: ["pause_amy"],
      checkedAt: now,
    };
  }

  const mainVersion =
    (await prisma.voiceAgentVersion.findFirst({
      where: { agentId: agent.id, isMain: true },
      orderBy: { version: "desc" },
    })) ||
    (await prisma.voiceAgentVersion.findFirst({
      where: { agentId: agent.id },
      orderBy: { version: "desc" },
    }));

  const expectedHash = expectedInstructionsHash(
    mainVersion?.config || agent.publishedConfig || agent.draftConfig,
  );
  const differences: string[] = [];
  let remotePromptHash: string | null = null;
  const telnyxAssistantId = agent.telnyxAssistantId || null;

  if (!telnyxAssistantId) {
    differences.push("no_telnyx_assistant");
    return {
      status: agent.status === "ACTIVE" ? "failed" : "warning",
      message: "No Telnyx assistant linked — cannot verify live configuration",
      expectedVersionId: mainVersion?.id || null,
      expectedVersionNumber: mainVersion?.version ?? null,
      telnyxAssistantId: null,
      expectedPromptHash: expectedHash,
      remotePromptHash: null,
      drifted: true,
      differences,
      actions: ["redeploy_expected", "pause_amy"],
      checkedAt: now,
    };
  }

  if (input.fetchRemote !== false) {
    try {
      const { getAssistant } = await import("@/lib/voice/telnyx/ai-client");
      const remote = await getAssistant(telnyxAssistantId);
      const instructions =
        typeof (remote as { instructions?: string })?.instructions === "string"
          ? (remote as { instructions: string }).instructions
          : String(
              (remote as { data?: { instructions?: string } })?.data?.instructions ||
                "",
            );
      if (instructions.trim()) {
        remotePromptHash = hashText(instructions.trim());
        if (expectedHash && remotePromptHash !== expectedHash) {
          differences.push("prompt_hash_mismatch");
        }
      } else {
        differences.push("remote_instructions_empty");
      }
    } catch (err) {
      differences.push(
        `telnyx_fetch_failed:${err instanceof Error ? err.message : String(err)}`.slice(
          0,
          120,
        ),
      );
    }
  }

  const drifted = differences.some((d) =>
    ["prompt_hash_mismatch", "remote_instructions_empty", "no_telnyx_assistant"].includes(
      d,
    ),
  );

  const versionLabel = mainVersion ? `version ${mainVersion.version}` : "expected draft";
  let status: HealthLevel = "healthy";
  let message = `Live Telnyx matches ${versionLabel}`;
  if (differences.includes("telnyx_fetch_failed") || differences.includes("telnyx_client_unavailable")) {
    status = "warning";
    message = `Could not verify Telnyx against ${versionLabel}`;
  } else if (drifted) {
    status = "degraded";
    message = `Amy’s live configuration does not match ${versionLabel}`;
  }

  return {
    status,
    message,
    expectedVersionId: mainVersion?.id || null,
    expectedVersionNumber: mainVersion?.version ?? null,
    telnyxAssistantId,
    expectedPromptHash: expectedHash,
    remotePromptHash,
    drifted,
    differences,
    actions: drifted
      ? ["inspect", "redeploy_expected", "import_external", "pause_amy"]
      : ["inspect"],
    checkedAt: now,
  };
}

export async function buildDeploymentDriftHealthCheck(input: {
  workspaceId: string;
  agentId: string;
}): Promise<HealthCheck> {
  const report = await detectDeploymentDrift({
    ...input,
    fetchRemote: true,
  });
  return healthFromDrift(report);
}
