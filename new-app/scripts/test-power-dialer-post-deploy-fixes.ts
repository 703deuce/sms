/**
 * Regression: internal operator gets workspace membership via resolveWorkspaceId (CRM + PD analytics auth).
 */
import assert from "node:assert/strict";
import { getPrisma } from "../lib/server/db";
import { resolveWorkspaceId } from "../lib/server/workspace";
import { assertCrmRead } from "../lib/server/crm/native/permissions";
import { requirePowerDialerScope } from "../lib/server/phone/power-dialer/power-dialer-permissions";
import { resolveInternalUserId } from "../lib/server/internal-user";
import { getPowerDialerAnalytics } from "../lib/server/phone/power-dialer/analytics-service";

async function main() {
  const prisma = getPrisma();
  const slug = `pd-post-deploy-${Date.now()}`;
  const ws = await prisma.workspace.create({
    data: { name: "PD Post Deploy Test", slug, type: "BUSINESS" },
  });
  const userId = await resolveInternalUserId();
  await prisma.membership.deleteMany({ where: { workspaceId: ws.id, userId } });

  const prevPin = process.env.DEV_WORKSPACE_ID;
  process.env.DEV_WORKSPACE_ID = ws.id;

  try {
    const resolved = await resolveWorkspaceId();
    assert.equal(resolved, ws.id);

    await assertCrmRead(ws.id);
    await requirePowerDialerScope(ws.id, userId, "analytics_read");

    const analytics = await getPowerDialerAnalytics(ws.id, "7d", null);
    assert.equal(typeof analytics.totals.attempts, "number");
    assert.ok(Array.isArray(analytics.campaigns));
  } finally {
    if (prevPin === undefined) delete process.env.DEV_WORKSPACE_ID;
    else process.env.DEV_WORKSPACE_ID = prevPin;
    await prisma.membership.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
  }

  console.log("test-power-dialer-post-deploy-fixes: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
