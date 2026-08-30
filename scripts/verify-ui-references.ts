/**
 * Verify all references.json Supabase paths exist and are downloadable.
 * Usage: npx tsx scripts/verify-ui-references.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Manifest = Record<
  string,
  {
    type: string;
    storage: string;
    bucket?: string;
    path: string;
    transovoRoute?: string;
  }
>;

const manifestPath = join(process.cwd(), ".ui-agent/references.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function verifyPath(bucket: string, path: string): Promise<{ ok: boolean; size?: number; error?: string }> {
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const filename = path.split("/").pop() || path;

  const { data: listed, error: listError } = await supabase.storage.from(bucket).list(folder, {
    limit: 200,
    search: filename.slice(0, 40),
  });

  if (listError) {
    return { ok: false, error: `list failed: ${listError.message}` };
  }

  const exact = listed?.find((row) => row.name === filename);
  if (!exact) {
    const names = (listed || []).map((row) => row.name).slice(0, 8);
    return {
      ok: false,
      error: `not found at ${bucket}/${path}${names.length ? `; nearby: ${names.join(" | ")}` : ""}`,
    };
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return { ok: false, error: `download failed: ${error?.message || "no data"}` };
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  return { ok: true, size: bytes.length };
}

async function main() {
  const entries = Object.entries(manifest).filter(([, entry]) => entry.storage === "supabase");
  console.log(`Checking ${entries.length} Supabase references in ${url}\n`);

  let pass = 0;
  let fail = 0;

  for (const [name, entry] of entries) {
    const bucket = entry.bucket || "ui-references";
    const result = await verifyPath(bucket, entry.path);
    if (result.ok) {
      pass += 1;
      const mb = ((result.size || 0) / (1024 * 1024)).toFixed(2);
      console.log(`OK   ${name}`);
      console.log(`     ${bucket}/${entry.path} (${mb} MB)`);
    } else {
      fail += 1;
      console.log(`FAIL ${name}`);
      console.log(`     expected: ${bucket}/${entry.path}`);
      console.log(`     ${result.error}`);
    }
  }

  console.log(`\n${pass}/${entries.length} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
