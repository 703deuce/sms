import { buildVoiceNumberProvisioningConfig } from "./config";
import type { VoiceNumberProvisioningStatus } from "./status";

export type VoiceV3ProvisioningHealthResult = {
  status: VoiceNumberProvisioningStatus;
  checks: Array<{ id: string; ok: boolean; detail?: string }>;
};

/**
 * Static readiness — does not place test calls. Use before VERIFYING → ACTIVE promotion.
 */
export function evaluateVoiceV3ProvisioningEnv(input: {
  appBaseUrl: string;
}): VoiceV3ProvisioningHealthResult {
  const projectId = process.env.OPENAI_PROJECT_ID?.trim() || "";
  const cfg = buildVoiceNumberProvisioningConfig({
    openaiProjectId: projectId || "proj_missing",
    appBaseUrl: input.appBaseUrl,
  });

  const checks = cfg.requiredEnv.map((key) => {
    const value = process.env[key]?.trim();
    const ok = Boolean(value);
    return { id: `env.${key}`, ok, detail: ok ? undefined : "missing" };
  });

  const projectOk = projectId.startsWith("proj_");
  checks.push({
    id: "openai.project_id_format",
    ok: projectOk,
    detail: projectOk ? undefined : "OPENAI_PROJECT_ID must start with proj_",
  });

  const allOk = checks.every((c) => c.ok);
  return {
    status: allOk ? "VERIFYING" : "FAILED",
    checks,
  };
}
