import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";

/**
 * Keeps VoiceAgentPhoneNumber + workspace routing policy aligned with receptionist draft.
 * LiveKit SIP provisioning hooks extend here (idempotent).
 */
export async function syncReceptionistPhoneAssignment(
  workspaceId: string,
  agentId: string,
  editor: AgentConfig,
  opts?: {
    publish?: boolean;
    paused?: boolean;
    publishedBundle?: ReceptionistPublishedBundle;
  },
): Promise<{ ok: boolean; error?: string } | void> {
  const prisma = getPrisma();
  const phoneNumberId = editor.connection?.id?.trim();
  if (!phoneNumberId) return;

  await prisma.voiceAgentPhoneNumber.upsert({
    where: { agentId_phoneNumberId: { agentId, phoneNumberId } },
    create: {
      workspaceId,
      agentId,
      phoneNumberId,
      inboundEnabled: !opts?.paused,
      outboundEnabled: false,
      isDefault: true,
    },
    update: {
      inboundEnabled: !opts?.paused,
      isDefault: true,
    },
  });

  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: { phoneNumberId, linkedPhoneNumberIds: [phoneNumberId] },
  });

  const routing = await prisma.workspaceCallRouting.findUnique({ where: { workspaceId } });
  const policy =
    routing?.policyJson && typeof routing.policyJson === "object"
      ? { ...(routing.policyJson as Record<string, unknown>) }
      : {};

  const aiCoverage =
    editor.coverage.mode === "every_call"
      ? "always"
      : editor.coverage.mode === "after_hours"
        ? "after_hours"
        : editor.coverage.mode === "overflow"
          ? "overflow"
          : "custom";

  const merged = {
    ...policy,
    numberId: phoneNumberId,
    aiCoverage,
    receptionistAgentId: agentId,
    receptionistPaused: Boolean(opts?.paused),
    updatedAt: new Date().toISOString(),
    updatedBy: "AI Receptionist",
  };

  await prisma.workspaceCallRouting.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      policyJson: merged,
      providerSyncStatus: opts?.publish ? "pending" : "synced",
      revision: 1,
    },
    update: {
      policyJson: merged,
      providerSyncStatus: opts?.publish ? "pending" : "synced",
      revision: (routing?.revision ?? 0) + 1,
    },
  });

  if (opts?.publish && opts.publishedBundle && agentId && phoneNumberId) {
    const versionId = (
      await getPrisma().voiceAgent.findUnique({
        where: { id: agentId },
        select: { publishedVersionId: true },
      })
    )?.publishedVersionId;
    if (versionId) {
      const { provisionReceptionistLiveKitOnPublish } = await import(
        "@/lib/server/receptionist/livekit/provision"
      );
      const lk = await provisionReceptionistLiveKitOnPublish({
        workspaceId,
        phoneNumberId,
        agentId,
        publishedVersionId: versionId,
        bundle: opts.publishedBundle,
      });
      await getPrisma().workspaceCallRouting.update({
        where: { workspaceId },
        data: {
          providerSyncStatus: lk.ok ? "synced" : "error",
          providerSyncError: lk.ok ? null : lk.error || "livekit_provision_failed",
        },
      });
      if (!lk.ok) return { ok: false, error: lk.error };
      const { verifyLiveKitProvisioningForPhone } = await import(
        "@/lib/server/voice-v3/livekit/browser-test"
      );
      const verify = await verifyLiveKitProvisioningForPhone({ workspaceId, phoneNumberId });
      if (!verify.ok) {
        return { ok: false, error: verify.error || "livekit_dispatch_not_verified" };
      }
      return { ok: true };
    }
  }
  return { ok: true };
}
