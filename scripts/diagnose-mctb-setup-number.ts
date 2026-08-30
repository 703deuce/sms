/**
 * Diagnose MCTB setup number routing + voice agent conflicts.
 * Usage: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diagnose-mctb-setup-number.ts [email]
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { verifyMctbTexmlIngressRoute } from "@/lib/mctb/texml-ingress/texml-route";
import { isMctbTexmlVoiceIngress } from "@/lib/mctb/sip-ingress/sync";
import { loadMctbConsentPrompt } from "@/lib/mctb/consent-prompt/store";

const email = process.argv[2]?.trim() || "[REDACTED]";

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, phone: true, email: true },
  });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const mem = await prisma.membership.findFirst({
    where: { userId: user.id },
    select: { workspaceId: true },
  });
  if (!mem) {
    console.error("No workspace membership");
    process.exit(1);
  }

  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: mem.workspaceId, releasedAt: null },
    select: {
      id: true,
      e164: true,
      providerNumberId: true,
      settingsJson: true,
      status: true,
    },
  });

  console.log(`Workspace: ${mem.workspaceId}`);
  console.log(`Phones: ${phones.length}`);

  for (const phone of phones) {
    const mctbTexml = isMctbTexmlVoiceIngress(phone.settingsJson);
    console.log(`\n--- ${phone.e164} (${phone.id}) mctb_texml=${mctbTexml} ---`);
    if (mctbTexml && phone.providerNumberId) {
      const verify = await verifyMctbTexmlIngressRoute({
        e164: phone.e164,
        providerNumberId: phone.providerNumberId,
      });
      console.log(JSON.stringify(verify, null, 2));
    }
    const prompt = await loadMctbConsentPrompt(mem.workspaceId).catch(() => null);
    console.log("consent prompt:", prompt ? "configured" : "missing");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
