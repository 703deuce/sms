/**
 * Authenticated production API probe for four-product E2E audit.
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/probe-prod-four-product-apis.ts
 */
import { request } from "playwright";
import { authenticate } from "./browser-cert/lib";

async function main() {
  const base = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
  const businessId = process.env.WORKSPACE_ID?.trim() || "ws_1";
  const { storageState, email } = await authenticate(base);
  console.log("auth", email);
  const ctx = await request.newContext({ baseURL: base, storageState });

  const probes: { name: string; path: string }[] = [
    { name: "mctb_setup", path: "/api/mctb/setup" },
    { name: "ar_workspace", path: "/api/appointment-reminders/reminders/workspace" },
    { name: "ar_ai_ops", path: "/api/appointment-reminders/ai-rescheduler/operations?limit=5" },
    { name: "templates_unified", path: "/api/templates/unified?limit=5" },
    {
      name: "reputation_contacts",
      path: `/api/reputation/contacts?businessId=${encodeURIComponent(businessId)}&limit=5`,
    },
    { name: "mass_campaigns", path: "/api/mass-texting/campaigns?limit=5" },
    { name: "reviews_kit", path: `/api/reputation/review-requests/kit?businessId=${encodeURIComponent(businessId)}` },
  ];

  let failed = 0;
  for (const p of probes) {
    const r = await ctx.get(p.path);
    const body = (await r.text()).slice(0, 200).replace(/\s+/g, " ");
    const ok = r.status() >= 200 && r.status() < 400;
    console.log(`${ok ? "OK" : "FAIL"} ${p.name} ${r.status()} ${body}`);
    if (!ok) failed += 1;
  }

  await ctx.dispose();
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
