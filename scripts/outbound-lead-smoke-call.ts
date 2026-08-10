/**
 * Manual outbound lead qualification smoke call (requires OUTBOUND_VOICE_TEST_MODE=1).
 *
 * Usage:
 *   OUTBOUND_VOICE_TEST_MODE=1 npx tsx scripts/outbound-lead-smoke-call.ts --phone=+15714776175
 *
 * Optional: --agent-id=... --workspace-id=ws_1 --schedule=2026-08-10T18:30:00Z
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import type { QualificationDefinition } from "../src/lib/voice/outbound/types";
import {
  assertOutboundTestModeEnabled,
  startOutboundLeadQualificationCall,
} from "../src/lib/voice/outbound/outbound-call-service";

dotenv.config();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

async function resolveOutboundAgent(workspaceId: string, agentId?: string): Promise<string> {
  const prisma = getPrisma();
  if (agentId?.trim()) return agentId.trim();

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, draftConfig: true, name: true },
  });
  const found = agents.find((a) => {
    const cfg = parseVoiceAgentConfig(a.draftConfig);
    return cfg.advanced?.livekitProfile === "outbound_lead_qualification";
  });
  if (!found) {
    throw new Error(
      "No outbound_lead_qualification agent found — run scripts/setup-outbound-lead-agent.ts first",
    );
  }
  return found.id;
}

async function main() {
  assertOutboundTestModeEnabled();

  const phone = arg("phone") || process.env.OUTBOUND_TEST_PHONE;
  if (!phone?.trim()) {
    throw new Error("Pass --phone=+1... or set OUTBOUND_TEST_PHONE");
  }

  const workspaceId = arg("workspace-id") || process.env.WORKSPACE_ID || "ws_1";
  const agentId = await resolveOutboundAgent(workspaceId, arg("agent-id"));

  const scheduleAt = arg("schedule");
  if (scheduleAt) {
    const when = new Date(scheduleAt);
    const delay = when.getTime() - Date.now();
    if (delay > 0) {
      console.log(`Scheduling dial in ${Math.round(delay / 1000)}s (${when.toISOString()})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const qualification = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "scripts/fixtures/blue-ridge-realty-qualification.json"),
      "utf8",
    ),
  ) as QualificationDefinition;

  const leadName = arg("lead-name") || "Anthony";

  const result = await startOutboundLeadQualificationCall({
    workspaceId,
    agentId,
    destinationPhone: phone,
    isTest: true,
    qualification,
    lead: {
      leadId: `demo-lead-${Date.now()}`,
      leadPhone: phone,
      leadName,
      leadSource: "website_form",
      reasonForContact: qualification.reasonForContact,
    },
    trigger: {
      source: "manual_smoke_test",
      reason: "Developer outbound qualification smoke",
      consentRecorded: true,
    },
  });

  console.log(JSON.stringify({ ok: result.status !== "failed", ...result }, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
