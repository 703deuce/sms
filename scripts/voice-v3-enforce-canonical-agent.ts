/**
 * Align Call Handling + phone settings with the single canonical Voice V3 GPT-Live agent.
 *
 * Usage:
 *   WORKSPACE_ID=ws_1 npx tsx scripts/voice-v3-enforce-canonical-agent.ts
 *   WORKSPACE_ID=ws_1 APPLY_PARKED_AGENT=1 npx tsx scripts/voice-v3-enforce-canonical-agent.ts
 *
 * Does not delete agents — updates parkedAiReceptionistAgentId on ingress phones when APPLY_PARKED_AGENT=1.
 */
import { getPrisma } from "../src/lib/db";
import { readCallHandlingBlock, mergeCallHandlingIntoSettings } from "../src/lib/call-handling/phone-settings";
import { resolveCanonicalVoiceV3WorkspaceAgent } from "../src/lib/voice-v3/canonical-workspace-agent";

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  if (!workspaceId) {
    console.error("Set WORKSPACE_ID");
    process.exit(1);
  }

  const canonical = await resolveCanonicalVoiceV3WorkspaceAgent(workspaceId);
  if (!canonical) {
    console.error("No canonical Voice V3 agent for workspace", workspaceId);
    process.exit(1);
  }

  console.log("CANONICAL_AGENT", canonical);

  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });

  for (const phone of phones) {
    const block = readCallHandlingBlock(phone.settingsJson);
    const parked = block.parkedAiReceptionistAgentId?.trim() || null;
    if (parked && parked !== canonical.agentId) {
      console.log("PARKED_MISMATCH", {
        e164: phone.e164,
        phoneNumberId: phone.id,
        parkedAgentId: parked,
        canonicalAgentId: canonical.agentId,
      });
      if (process.env.APPLY_PARKED_AGENT === "1") {
        const settings = mergeCallHandlingIntoSettings(phone.settingsJson, {
          parkedAiReceptionistAgentId: canonical.agentId,
        });
        await prisma.phoneNumber.update({
          where: { id: phone.id },
          data: { settingsJson: settings as object },
        });
        console.log("PARKED_UPDATED", { e164: phone.e164 });
      }
    }
  }

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { id: true, name: true, displayName: true, publishedVersionId: true },
    orderBy: { updatedAt: "desc" },
  });
  const others = agents.filter((a) => a.id !== canonical.agentId);
  if (others.length) {
    console.log(
      "OTHER_ACTIVE_AGENTS (review manually — routing now ignores these for inbound V3)",
      others.map((a) => ({
        id: a.id,
        name: a.displayName || a.name,
        published: Boolean(a.publishedVersionId),
      })),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
