#!/usr/bin/env tsx
import "./preload-server-only.mjs";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";

async function main() {
  const all: string[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<{
      data?: Array<{ phone_number?: string; status?: string }>;
      meta?: { total_pages?: number };
    }>("/phone_numbers", {
      query: { "page[number]": page, "page[size]": 100 },
    });
    const batch = res.data ?? [];
    if (!batch.length) break;
    for (const row of batch) {
      if (row.phone_number) all.push(row.phone_number);
    }
    const pages = res.meta?.total_pages ?? 1;
    if (page >= pages) break;
    page += 1;
  }
  all.sort();
  console.log(`Telnyx phone numbers in this API key account: ${all.length}`);
  for (const e164 of all) console.log(`  ${e164}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
