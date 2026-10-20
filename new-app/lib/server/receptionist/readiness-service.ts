import { getPrisma } from "@/lib/server/db";
import { getReceptionistState } from "@/lib/server/receptionist/agent-service";
import { voiceRuntimeInternalSecret } from "@/lib/server/receptionist/runtime/auth";
import { alignEditorConnectionForPublish } from "@/lib/server/receptionist/resolve-publish-phone";
import { validateReceptionistPublish } from "@/lib/server/voice-v3/publish-gate";

export async function getReceptionistReadiness(workspaceId: string) {
  const state = await getReceptionistState(workspaceId);
  const editorForPublish = await alignEditorConnectionForPublish(workspaceId, state.draft);
  const publishValidation = await validateReceptionistPublish(workspaceId, editorForPublish);
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
    inboundPhoneNumberId:
      editorForPublish.connection.kind === "owned" ? editorForPublish.connection.id : null,
  };
}
