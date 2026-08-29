/**
 * Reconcile stuck outbound messages via provider API lookup.
 * Run: npx tsx scripts/reconcile-delivery-status.ts
 */
import { reconcilePendingDeliveryStatuses } from "../src/lib/messaging/delivery-reconciliation";

async function main() {
  const workspaceId = process.env.WORKSPACE_ID || undefined;
  const result = await reconcilePendingDeliveryStatuses({
    workspaceId,
    staleMinutes: Number(process.env.STALE_MINUTES || "30"),
    limit: Number(process.env.LIMIT || "100"),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
