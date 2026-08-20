/**
 * API smoke: dry-run purchase one Telnyx + one Twilio result through the product path.
 * Run: NUMBER_PAYMENT_PROVIDER=test npx tsx scripts/test-number-marketplace-dry-purchase.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { getPrisma } from "../src/lib/db";
import { completePremiumPurchase } from "../src/lib/numbers/purchase-service";
import { reservePremiumNumber } from "../src/lib/premium-numbers/reservation-service";
import { executePremiumSearch } from "../src/lib/premium-numbers/execute-premium-search";

const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const BASE = process.env.APP_URL || "http://localhost:3000";

async function smokeSignup() {
  const res = await fetch(`${BASE}/api/auth/smoke-signup`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-smoke-bootstrap": BOOTSTRAP },
    body: JSON.stringify({ name: "Dry Purchase Smoke", businessName: "Dry Purchase Smoke" }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(`smoke-signup failed: ${JSON.stringify(json)}`);
  return json as { email: string; workspaceId: string };
}

async function resolveUserId(email: string) {
  const user = await getPrisma().user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`user not found for ${email}`);
  return user.id;
}

async function main() {
  const account = await smokeSignup();
  const userId = await resolveUserId(account.email);

  const search = await executePremiumSearch({
    workspaceId: account.workspaceId,
    userId,
    mode: "personal",
    areaCodes: ["571"],
    preferences: ["surprise_me"],
    numberType: "local",
    tollFreePrefix: "all",
  });

  const logId = search.searchLogId;
  const results = [
    ...search.product.bestMatches,
    ...search.product.memorableAlternatives,
    ...(search.product.topPicks ?? []),
  ];

  const targets = (["telnyx", "twilio"] as const)
    .map((provider) => results.find((r) => r.provider === provider))
    .filter(Boolean);

  if (targets.length === 0) {
    console.error("No telnyx/twilio results in search — check provider credentials");
    process.exit(1);
  }

  for (const target of targets) {
    const reserved = await reservePremiumNumber({
      workspaceId: account.workspaceId,
      userId,
      phoneNumber: target!.phoneNumber,
      searchLogId: logId,
      searchMode: "personal",
    });
    if (!reserved.ok || !reserved.reservationId) {
      throw new Error(`reserve failed (${target!.provider}): ${reserved.error}`);
    }

    const purchased = await completePremiumPurchase({
      workspaceId: account.workspaceId,
      userId,
      reservationId: reserved.reservationId,
      idempotencyKey: `dry-smoke:${target!.provider}:${reserved.reservationId}`,
      dryRunProviderPurchase: true,
    });

    console.log(
      JSON.stringify({
        provider: target!.provider,
        phone: target!.phoneNumber,
        reserve: reserved.reservationStatus,
        purchase: purchased.status,
        ok: purchased.ok,
        phoneNumberId: purchased.phoneNumberId,
      }),
    );

    if (!purchased.ok) {
      throw new Error(`purchase failed for ${target!.provider}: ${purchased.error}`);
    }
  }

  console.log("dry-run telnyx + twilio purchase path: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
