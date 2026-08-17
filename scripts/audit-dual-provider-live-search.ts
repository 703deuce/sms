/**
 * Live dual-provider number search audit — Telnyx + Twilio inventory with per-number provider labels.
 *
 * Direct (local libs, uses env credentials — no browser login):
 *   npx tsx scripts/audit-dual-provider-live-search.ts
 *   CUSTOM_KEYWORDS=light,plug INDUSTRY=electrician AREA_CODES=540,571 npx tsx scripts/audit-dual-provider-live-search.ts
 *
 * API (smoke-login against deployed app — same path as the UI):
 *   BASE_URL=https://your-app.example npx tsx scripts/audit-dual-provider-live-search.ts --api
 *   EMAIL=alex@harborhome.co BASE_URL=... npx tsx scripts/audit-dual-provider-live-search.ts --api
 */
import dotenv from "dotenv";

dotenv.config();

import { telnyxNumberProvider } from "../src/lib/numbers/providers/telnyx-number-provider";
import { twilioNumberProvider } from "../src/lib/numbers/providers/twilio-number-provider";
import { numberSearchService } from "../src/lib/numbers/providers/number-search-service";
import {
  mergeCustomerKeywords,
  suggestIndustryVanityKeywords,
} from "../src/lib/premium-numbers/business-keyword-llm";
import { inferIndustryFromText } from "../src/lib/premium-numbers/business-name-keywords";
import { searchPremiumNumbers } from "../src/lib/premium-numbers/premium-number-search";
import { buildProductSearchResponse } from "../src/lib/premium-numbers/product-api";
import { parsePhoneDigits } from "../src/lib/premium-numbers/keypad";

const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const DEFAULT_EMAIL = "alex@harborhome.co";
const DEFAULT_INDUSTRY = "electrician";
const DEFAULT_AREA_CODES = ["540", "571"];

function parseAreaCodes(raw: string | undefined): string[] {
  const source = raw ?? DEFAULT_AREA_CODES.join(",");
  return [...new Set(
    source
      .split(/[,\s]+/)
      .map((c) => c.replace(/\D/g, "").slice(0, 3))
      .filter((c) => c.length === 3),
  )];
}

function mergeCookies(existing: string, setCookies: string[] | undefined): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [name, ...rest] = part.split("=");
    jar.set(name, rest.join("="));
  }
  for (const raw of setCookies ?? []) {
    const [pair] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    if (name) jar.set(name.trim(), rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function npa(phone: string): string {
  const digits = parsePhoneDigits(phone);
  return digits.length >= 10 ? digits.slice(0, 3) : "?";
}

function printProviderConfig() {
  const telnyx = telnyxNumberProvider.isConfigured();
  const twilio = twilioNumberProvider.isConfigured();
  console.log("=== Provider configuration ===");
  console.log(`  telnyx:  ${telnyx ? "configured" : "NOT configured"}`);
  console.log(`  twilio:  ${twilio ? "configured" : "NOT configured"}`);
  if (!telnyx && !twilio) {
    console.error("\nNo providers configured. Set TELNYX_API_KEY and Twilio live credentials.");
    process.exit(1);
  }
  console.log();
}

async function probeRawInventory(areaCodes: string[]) {
  console.log("=== Raw inventory probe (per provider × area code) ===");
  for (const areaCode of areaCodes) {
    const result = await numberSearchService.searchInventory({
      areaCode,
      keywordDigitStrings: ["4448", "7584"],
      memorablePatterns: ["4444", "6666"],
      baseLimit: 10,
      matchStyle: "both",
    });
    const byProvider = { telnyx: 0, twilio: 0 };
    for (const c of result.candidates) {
      byProvider[c.provider] += 1;
    }
    console.log(`  area ${areaCode}: ${result.candidates.length} candidates (telnyx ${byProvider.telnyx}, twilio ${byProvider.twilio})`);
    for (const attempt of result.attempts) {
      const count = attempt.resultCount ?? 0;
      console.log(
        `    ${attempt.provider} ${attempt.strategy}: ${attempt.status}${attempt.error ? ` — ${attempt.error}` : ""} (raw ${count})`,
      );
    }
    for (const c of result.candidates.slice(0, 12)) {
      const src = (c.raw?.costSource as string | undefined) ?? "unknown";
      console.log(
        `    ${c.provider.padEnd(6)} ${c.e164} buy=${c.upfrontCost ?? "—"} monthly=${c.monthlyCost ?? "—"} ${c.currency ?? "USD"} (${src})`,
      );
    }
    if (result.candidates.length > 12) {
      console.log(`    … ${result.candidates.length - 12} more (see Coolify inventory JSON logs)`);
    }
  }
  console.log();
}

async function runDirectSearch(industry: string, areaCodes: string[], limit: number) {
  const llm = await suggestIndustryVanityKeywords(industry);
  const extraKeywords = (process.env.CUSTOM_KEYWORDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const customKeywords = mergeCustomerKeywords({
    suggestedKeywords: llm.keywords,
    extraKeywords,
  });
  const resolvedIndustry =
    inferIndustryFromText(industry) ||
    inferIndustryFromText(customKeywords.join(" ")) ||
    industry;

  console.log("=== Business premium search (direct) ===");
  console.log(`  industry: ${industry}`);
  console.log(`  resolved: ${resolvedIndustry}`);
  console.log(`  area codes: ${areaCodes.join(", ")}`);
  console.log(`  keywords (${customKeywords.length}): ${customKeywords.join(", ")}`);
  console.log(`  llm source: ${llm.source}`);
  console.log();

  const started = Date.now();
  const searchResult = await searchPremiumNumbers({
    areaCode: areaCodes[0],
    areaCodes,
    industry: resolvedIndustry,
    customKeywords,
    matchStyle: "both",
    limit,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const product = buildProductSearchResponse({
    mode: "business",
    areaCode: areaCodes[0],
    industry: searchResult.industry,
    status: searchResult.status,
    message: searchResult.message,
    candidates: searchResult.candidates,
    keywords: searchResult.keywords,
  });

  const allResults = [
    ...product.bestMatches,
    ...product.memorableAlternatives,
    ...(product.topPicks ?? []),
  ];

  printSearchSummary(product, allResults, elapsed, searchResult.status);
  printNumberTable(allResults, searchResult.candidates);

  const sampleNumbers = [
    "+15717154448",
    "+15716267584",
    "+15717747584",
    "+15406666235",
  ];
  printSampleLookup(allResults, sampleNumbers);
}

function printSearchSummary(
  product: ReturnType<typeof buildProductSearchResponse>,
  allResults: Array<{ provider: string; phoneNumber: string }>,
  elapsed: string,
  status: string,
) {
  const providerCounts = { telnyx: 0, twilio: 0 };
  const npaCounts = new Map<string, number>();
  for (const r of allResults) {
    providerCounts[r.provider as "telnyx" | "twilio"] += 1;
    const code = npa(r.phoneNumber);
    npaCounts.set(code, (npaCounts.get(code) ?? 0) + 1);
  }

  console.log("=== Search summary ===");
  console.log(`  status: ${status}`);
  console.log(`  elapsed: ${elapsed}s`);
  console.log(`  total UI results: ${product.resultCount} (best ${product.businessMatchCount}, memorable ${product.memorableCount})`);
  console.log(`  providers in results: telnyx ${providerCounts.telnyx}, twilio ${providerCounts.twilio}`);
  console.log(
    `  NPA breakdown: ${[...npaCounts.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`,
  );
  console.log();
}

function printNumberTable(
  results: Array<{
    phoneNumber: string;
    displayNumber: string;
    vanityDisplay?: string;
    provider: string;
    businessMatchLabel: string;
    premiumPriceBand: string;
    premiumPriceCents?: number;
    matchedWords: string[];
  }>,
  candidates?: Array<{
    phoneNumber: string;
    telnyxCost?: { upfrontCost?: string; monthlyCost?: string; currency?: string };
    provider?: string;
  }>,
) {
  const costByPhone = new Map(
    (candidates ?? []).map((c) => [c.phoneNumber, c.telnyxCost]),
  );
  console.log("=== Numbers (provider, carrier costs, customer price) ===");
  const header = "provider  npa   number           buy      monthly  customer  band";
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of results) {
    const cost = costByPhone.get(r.phoneNumber);
    const buy = (cost?.upfrontCost ?? "—").padEnd(7).slice(0, 7);
    const monthly = (cost?.monthlyCost ?? "—").padEnd(8).slice(0, 8);
    const customer =
      r.premiumPriceCents != null
        ? `$${(r.premiumPriceCents / 100).toFixed(2)}`
        : "—";
    console.log(
      `${r.provider.padEnd(8)}  ${npa(r.phoneNumber).padEnd(4)}  ${r.displayNumber.padEnd(16)} ${buy} ${monthly} ${customer.padEnd(8)} ${r.premiumPriceBand}`,
    );
  }
  console.log();
}

function printSampleLookup(
  results: Array<{ phoneNumber: string; provider: string; displayNumber: string; vanityDisplay?: string }>,
  e164List: string[],
) {
  const byPhone = new Map(results.map((r) => [r.phoneNumber, r]));
  console.log("=== Sample numbers from your UI search ===");
  for (const e164 of e164List) {
    const hit = byPhone.get(e164);
    if (hit) {
      console.log(`  ${hit.displayNumber} → ${hit.provider} (${hit.vanityDisplay ?? "no vanity"})`);
    } else {
      console.log(`  ${e164} → not in ranked top results`);
    }
  }
  console.log();
}

async function runApiSearch(
  baseUrl: string,
  email: string,
  industry: string,
  areaCodes: string[],
  limit: number,
) {
  const base = baseUrl.replace(/\/$/, "");
  console.log("=== API search (smoke-login + /api/numbers/premium/search) ===");
  console.log(`  base: ${base}`);
  console.log(`  email: ${email}`);
  console.log();

  const loginRes = await fetch(`${base}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    console.error("smoke-login failed", loginRes.status, loginJson);
    process.exit(1);
  }
  const cookies = mergeCookies("", loginRes.headers.getSetCookie?.() ?? []);
  console.log(`  logged in: ${loginJson.email} workspace ${loginJson.workspaceId}`);

  const started = Date.now();
  const searchRes = await fetch(`${base}/api/numbers/premium/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookies,
    },
    body: JSON.stringify({
      mode: "business",
      industry,
      areaCodes,
      limit,
    }),
  });
  const product = await searchRes.json().catch(() => ({}));
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (!searchRes.ok) {
    console.error("search failed", searchRes.status, product);
    process.exit(1);
  }

  const allResults = [
    ...(product.bestMatches ?? []),
    ...(product.memorableAlternatives ?? []),
    ...(product.topPicks ?? []),
  ];

  printSearchSummary(product, allResults, elapsed, product.status ?? "unknown");
  printNumberTable(allResults);

  const sampleNumbers = [
    "+15717154448",
    "+15716267584",
    "+15717747584",
    "+15406666235",
  ];
  printSampleLookup(allResults, sampleNumbers);
}

async function main() {
  const useApi = process.argv.includes("--api");
  const industry = (process.env.INDUSTRY ?? DEFAULT_INDUSTRY).trim();
  const areaCodes = parseAreaCodes(process.env.AREA_CODES);
  const limit = Number(process.env.LIMIT ?? "80");
  const email = (process.env.EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const baseUrl =
    process.env.BASE_URL ||
    process.env.LOCAL_APP_URL ||
    process.env.PERSONAL_SCREENSHOT_BASE ||
    "http://localhost:3000";

  if (!areaCodes.length) {
    console.error("Provide AREA_CODES as comma-separated 3-digit codes (e.g. 540,571)");
    process.exit(1);
  }

  printProviderConfig();
  await probeRawInventory(areaCodes);

  if (useApi) {
    await runApiSearch(baseUrl, email, industry, areaCodes, limit);
  } else {
    await runDirectSearch(industry, areaCodes, limit);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
