/**
 * Bootstrap a fresh workspace for Smart Routing UI E2E (no number purchase).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/sr-e2e-bootstrap-workspace.ts
 */
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { getPrisma } from "@/lib/db";
import {
  ensureBusinessWorkspaceOnboarding,
  ensureWorkspaceOwnerMembership,
} from "@/lib/workspace/create-workspace";

const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const BASE = process.env.APP_URL || "http://localhost:3000";

async function main() {
  const stamp = Date.now().toString(36);
  const res = await fetch(`${BASE}/api/auth/smoke-signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({
      email: `sr-e2e-${stamp}@transovo.test`,
      password: `SrE2e_${stamp}!`,
      businessName: `SR E2E ${stamp}`,
      cloneCalendly: false,
      provisionNumber: false,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "smoke-signup failed");

  const workspaceId = String(json.workspaceId);
  const user = await getPrisma().user.findUnique({ where: { email: json.email } });
  if (!user) throw new Error("bootstrap user missing");
  await ensureWorkspaceOwnerMembership(workspaceId, user.id);
  await ensureBusinessWorkspaceOnboarding(workspaceId);
  await grantWorkspaceProductFeature(workspaceId, "smart_routing", "active");
  await grantWorkspaceProductFeature(workspaceId, "mctb", "active");

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: BASE,
        email: json.email,
        password: json.password,
        workspaceId,
        workspaceName: json.workspaceName,
        loginUrl: `${BASE}/login`,
        buyUrl: `${BASE}/numbers/buy`,
        srSetupUrl: `${BASE}/smart-routing/setup`,
      },
      null,
      2,
    ),
  );
}

void main();
