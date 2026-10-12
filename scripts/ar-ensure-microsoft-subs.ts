/**
 * Ops: ensure per-calendar Microsoft Graph subscriptions for a workspace.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-ensure-microsoft-subs.ts
 */
import { ensureMicrosoftCalendarSubscriptionsForWorkspace } from "../src/lib/calendar/ensure-microsoft-subscriptions";
import { ensureMicrosoftCalendarSubscription } from "../src/lib/calendar/webhooks";
import { getPrisma } from "../src/lib/db";
import type { CalendarConfig } from "../src/lib/calendar/providers";

const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
const forceConnectionId = process.env.CONNECTION_ID?.trim();

async function main() {
  if (forceConnectionId) {
    const direct = await ensureMicrosoftCalendarSubscription(workspaceId, forceConnectionId);
    console.log(JSON.stringify({ direct }, null, 2));
  }
  const result = await ensureMicrosoftCalendarSubscriptionsForWorkspace(workspaceId);
  const connections = await getPrisma().voiceCalendarConnection.findMany({
    where: { workspaceId, provider: "microsoft", status: "connected" },
    select: { id: true, config: true },
  });
  const summary = connections.map((c) => {
    const cfg = (c.config || {}) as CalendarConfig;
    return {
      id: c.id,
      importCalendarIds: cfg.importCalendarIds,
      microsoftSubscription: cfg.microsoftSubscription,
      microsoftCalendarSubscriptions: cfg.microsoftCalendarSubscriptions,
    };
  });
  console.log(JSON.stringify({ workspaceId, ensureResult: result, connections: summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
