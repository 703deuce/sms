/**
 * Human sanity-check helper: sample live personal search shelves by area code.
 * Usage: node scripts/sample-live-search-shelves.mjs [baseUrl]
 */
const BASE =
  process.argv[2] ??
  process.env.NUMBERS_SHELF_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";
const AREA_CODES = ["571", "540", "703", "301"];

function fmt(cents) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 2 : 2)}`;
}

async function search(areaCode) {
  const res = await fetch(`${BASE}/api/public/numbers/search`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      mode: "personal",
      areaCode,
      limit: 48,
      stream: false,
    }),
  });
  if (!res.ok) {
    return { areaCode, error: `${res.status} ${await res.text()}` };
  }
  const data = await res.json();
  const items = [...(data.topPicks ?? []), ...(data.results ?? [])];
  const seen = new Set();
  const unique = items.filter((item) => {
    if (seen.has(item.phoneNumber)) return false;
    seen.add(item.phoneNumber);
    return true;
  });
  return { areaCode, items: unique.slice(0, 48), status: data.status };
}

function summarize(items) {
  const byPrice = new Map();
  for (const item of items) {
    const p = item.premiumPriceCents ?? 0;
    byPrice.set(p, (byPrice.get(p) ?? 0) + 1);
  }
  const expensive = items.filter((i) => (i.premiumPriceCents ?? 0) >= 1999);
  const opening = items.slice(0, 12).map((i) => ({
    number: i.formattedNumber ?? i.phoneNumber,
    price: i.premiumPriceCents,
    tags: i.tags?.slice(0, 2) ?? [],
  }));
  return {
    count: items.length,
    priceMix: Object.fromEntries([...byPrice.entries()].sort((a, b) => a[0] - b[0])),
    opening,
    expensiveCount: expensive.length,
    expensiveSamples: expensive.slice(0, 5).map((i) => ({
      number: i.formattedNumber ?? i.phoneNumber,
      price: i.premiumPriceCents,
      tags: i.tags ?? [],
    })),
  };
}

const report = { base: BASE, checkedAt: new Date().toISOString(), areas: {} };
for (const areaCode of AREA_CODES) {
  const result = await search(areaCode);
  if (result.error) {
    report.areas[areaCode] = { error: result.error };
    continue;
  }
  report.areas[areaCode] = {
    status: result.status,
    ...summarize(result.items),
  };
}

console.log(JSON.stringify(report, null, 2));
