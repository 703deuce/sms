import { getPrisma } from "@/lib/server/db";
import { getReceptionistState } from "@/lib/server/receptionist/agent-service";
import { voiceRuntimeInternalSecret } from "@/lib/server/receptionist/runtime/auth";
import { validateReceptionistPublish } from "@/lib/server/voice-v3/publish-gate";

export async function getReceptionistReadiness(workspaceId: string) {
  const state = await getReceptionistState(workspaceId);
  const publishValidation = await validateReceptionistPublish(workspaceId, state.draft);
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findUnique({ where: { id: state.agentId } });

  const phoneOk = Boolean(state.draft.connection?.id?.trim());
  const published = Boolean(agent?.publishedVersionId);
  const workerSecret = Boolean(voiceRuntimeInternalSecret());
  const routing = await prisma.workspaceCallRouting.findUnique({ where: { workspaceId } });

  const checks = [
    { id: "draft", label: "Configuration saved", ok: true },
    { id: "phone", label: "Phone number assigned", ok: phoneOk },
    { id: "publish", label: "Published version", ok: published },
    { id: "worker_auth", label: "Worker API key configured", ok: workerSecret },
    {
      id: "routing",
      label: "Call routing policy",
      ok: Boolean(routing?.policyJson),
    },
  ];

  return {
    ready: checks.every((c) => c.ok) && state.status === "active",
    checks,
    status: state.status,
    publishedVersion: state.publishedVersion,
    providerSyncStatus: routing?.providerSyncStatus ?? "unknown",
    canPublish: publishValidation.ok,
    publishBlockers: publishValidation.ok ? [] : publishValidation.errors,
  };
}
