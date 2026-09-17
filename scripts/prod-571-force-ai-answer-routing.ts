/**
 * One-shot: route +15714073615 (ws_1 cert agent) straight to AI — not human-first / MCTB miss path.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/prod-571-force-ai-answer-routing.ts
 */
import { getPrisma } from "@/lib/db";
import { evaluateInboundRouting } from "@/lib/voice/routing";

const WS = "ws_1";
const E164 = "+15714073615";
const CERT_AGENT = "cmshz2lc25c622c4i58303501";
const WIZARD_AFTER_HOURS_RULE = "cmu4vxo943y5l4b16105f5g66";

async function main() {
  const prisma = getPrisma();
  const rule = await prisma.voiceRoutingRule.findFirst({
    where: { id: WIZARD_AFTER_HOURS_RULE, workspaceId: WS },
  });
  if (!rule) {
    console.error("Rule not found:", WIZARD_AFTER_HOURS_RULE);
    process.exit(1);
  }

  const actions = (rule.actions || {}) as Record<string, unknown>;
  const before = { name: rule.name, actions };

  await prisma.voiceRoutingRule.update({
    where: { id: rule.id },
    data: {
      name: "Wizard: AI answer (571 PSTN cert)",
      actions: {
        ...actions,
        type: "ai_answer",
        action: "ai_answer",
        agentId: CERT_AGENT,
      },
    },
  });

  const after = await evaluateInboundRouting({
    workspaceId: WS,
    fromE164: "+15551234567",
    toE164: E164,
    isKnownContact: false,
  });

  console.log(JSON.stringify({ ok: true, before, evaluatedAfter: after }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
