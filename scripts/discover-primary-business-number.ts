#!/usr/bin/env npx tsx
/**
 * Discover the primary 571-407 business number from DB (no hard-coded E.164).
 */
import { getPrisma } from "@/lib/db";
import { verifyNumberRouting } from "@/lib/telephony/provisioning/number-assignment";
import { resolveMediaBackend } from "@/lib/voice/media-backend/resolver";

import { loadSmartRoutingWorkspaceSettings } from "@/lib/smart-routing/workspace-settings";

async function main() {
  const prisma = getPrisma();
  const candidates = await prisma.phoneNumber.findMany({
    where: {
      e164: { contains: "571407" },
      status: { not: "released" },
    },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { purchasedAt: "desc" },
  });

  const flows = await prisma.smartRoutingFlow.findMany({
    where: {
      OR: candidates.map((c) => ({ assignedPhoneNumberId: c.id })),
      status: { in: ["published", "active", "paused"] },
    },
    select: {
      id: true,
      name: true,
      status: true,
      assignedPhoneNumberId: true,
      draftConfigJson: true,
    },
  });

  const report = [];
  for (const phone of candidates) {
    const settings = (phone.settingsJson || {}) as Record<string, unknown>;
    const telephony = (settings.telephony || {}) as Record<string, unknown>;
    const routingOwner = (settings as { routingOwner?: string }).routingOwner;
    const activeFlows = flows.filter((f) => f.assignedPhoneNumberId === phone.id);
    let verify = null;
    let mediaBackend = null;
    try {
      verify = await verifyNumberRouting({
        workspaceId: phone.workspaceId,
        phoneNumberId: phone.id,
      });
    } catch (e) {
      verify = { error: e instanceof Error ? e.message : String(e) };
    }
    try {
      mediaBackend = await resolveMediaBackend({ toE164: phone.e164 });
    } catch (e) {
      mediaBackend = { error: e instanceof Error ? e.message : String(e) };
    }

    let smartRoutingSettings = null;
    try {
      smartRoutingSettings = await loadSmartRoutingWorkspaceSettings(phone.workspaceId);
    } catch {
      // ignore
    }

    const agentLink = await prisma.voiceAgentPhoneNumber.findFirst({
      where: { phoneNumberId: phone.id, workspaceId: phone.workspaceId },
      include: { agent: { select: { id: true, name: true } } },
    });

    report.push({
      phoneNumberId: phone.id,
      e164: phone.e164,
      workspaceId: phone.workspaceId,
      workspaceName: phone.workspace?.name,
      provider: phone.provider,
      providerNumberId: phone.providerNumberId,
      voiceAgentId: agentLink?.agentId ?? null,
      voiceAgentName: agentLink?.agent?.name ?? null,
      smartRoutingSettings,
      routingOwner,
      telephony,
      activeSmartRoutingFlows: activeFlows.map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status,
      })),
      verify,
      resolvedMediaBackend: mediaBackend,
    });
  }

  console.log(JSON.stringify({ discovered: report.length, numbers: report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
