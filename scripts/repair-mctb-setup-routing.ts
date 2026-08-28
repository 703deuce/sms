/**
 * One-shot repair: pause legacy SR consent flows + persist business line for setup forward routing.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/repair-mctb-setup-routing.ts [email] [--apply]
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { pauseLegacyMctbSmartRoutingFlows } from "@/lib/mctb/consent-prompt/service";
import { provisionMctbTelnyxSipIngress } from "@/lib/mctb/provisioning/telnyx-sip-ingress";
import { ensureMctbTenantProductionBinding } from "@/lib/mctb/tenant-production-binding";

const email = process.argv[2]?.trim() || "703deuce@gmail.com";
const apply = process.argv.includes("--apply");

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, phone: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${email}`);

  const mem = await prisma.membership.findFirst({
    where: { userId: user.id },
    select: { workspaceId: true },
  });
  if (!mem) throw new Error("No workspace");

  const runtime = await prisma.missedCallTextConfig.findUnique({
    where: { workspaceId: mem.workspaceId },
  });
  if (!runtime?.phoneNumberId) throw new Error("No MCTB phone assigned");

  console.log("\n══ MCTB setup routing repair ══\n");
  console.log("Workspace:", mem.workspaceId);
  console.log("MCTB phone:", runtime.phoneNumberId);
  console.log("User phone (business line):", user.phone);
  console.log("Apply:", apply);

  const paused = await pauseLegacyMctbSmartRoutingFlows(mem.workspaceId, {
    activePhoneNumberId: runtime.phoneNumberId,
  });
  console.log("\nPaused legacy SR flows:", paused.pausedFlowIds.length, paused.pausedFlowIds);

  if (apply && user.phone) {
    const binding = await ensureMctbTenantProductionBinding({
      workspaceId: mem.workspaceId,
      userEmail: user.email,
      phoneNumberId: runtime.phoneNumberId,
      businessLineE164: user.phone,
    });
    console.log("\nTenant binding:", binding);

    const provision = await provisionMctbTelnyxSipIngress({
      workspaceId: mem.workspaceId,
      phoneNumberId: runtime.phoneNumberId,
      mctbRole: binding.platformDemoLinked ? "platform_demo" : "customer_mctb",
    });
    console.log("\nSIP provision:", provision);
  } else if (!apply) {
    console.log("\nDry run — re-run with --apply to persist business line + re-provision voice.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
