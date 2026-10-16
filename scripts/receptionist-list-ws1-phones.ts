import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { getPrisma } from "@/lib/db";
import { isMctbTexmlIngressLocked } from "@/lib/mctb/sip-ingress/sync";

async function main() {
  hydrateProdDatabaseUrlFromCoolify();
  hydrateProdSupabaseFromCoolify();
  const prisma = getPrisma();
  const nums = await prisma.phoneNumber.findMany({
    where: { workspaceId: "ws_1" },
    select: { id: true, e164: true, settingsJson: true },
  });
  const out = nums.map((n) => ({
    id: n.id,
    last4: n.e164?.slice(-4),
    mctbLocked: isMctbTexmlIngressLocked(n.settingsJson),
  }));
  console.log(JSON.stringify(out, null, 2));
}

main();
