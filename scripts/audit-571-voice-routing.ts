import { getPrisma } from "@/lib/db";
import { evaluateInboundRouting } from "@/lib/voice/routing";
import { getMessagingRuntimeSettings, isWithinBusinessHours } from "@/lib/messaging/messaging-settings";
import { applyActionTimezone } from "@/lib/voice/routing-action-resolve";

const WS = "ws_1";
const E164 = "+15714073615";

async function main() {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: WS, e164: E164 },
  });
  const rules = await prisma.voiceRoutingRule.findMany({
    where: { workspaceId: WS },
    orderBy: { priority: "asc" },
  });
  const routing = await evaluateInboundRouting({
    workspaceId: WS,
    fromE164: "+15551234567",
    toE164: E164,
    isKnownContact: false,
  });
  const settings = await getMessagingRuntimeSettings(WS);
  const actions = (routing.actions || {}) as Record<string, unknown>;
  const effective = applyActionTimezone(settings, actions);
  const within = isWithinBusinessHours(effective, new Date());

  const calls = await prisma.voiceCall.findMany({
    where: { workspaceId: WS, toE164: E164 },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, createdAt: true, status: true, metadata: true },
  });

  console.log(
    JSON.stringify(
      {
        phone: pn
          ? {
              id: pn.id,
              e164: pn.e164,
              provider: pn.provider,
              settings: pn.settingsJson,
            }
          : null,
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          priority: r.priority,
          enabled: r.enabled,
          action: r.action,
          agentId: r.agentId,
          conditions: r.conditionsJson,
        })),
        evaluatedNow: routing,
        withinBusinessHours: within,
        effectiveActionHint:
          routing.action === "ai_after_hours"
            ? within
              ? "human_first (business hours)"
              : "ai_answer (after hours)"
            : routing.action,
        recentCalls: calls,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
