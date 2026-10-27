#!/usr/bin/env node
/** Rotate e2e-rooms password only (no print). Requires SUPABASE_* in env. */
import { randomBytes } from "node:crypto";
import { writeFileSync, chmodSync, readFileSync, existsSync } from "node:fs";

const email = process.env.E2E_ROOMS_EMAIL || "e2e-rooms@transovo.ai";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outPath = process.env.E2E_ENV_FILE || "/root/.transovo-e2e.env";

if (!supabaseUrl || !serviceKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const password = randomBytes(24).toString("base64url");

async function admin(path, body, method = "POST") {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  const list = await admin(`/users?email=${encodeURIComponent(email)}`, null, "GET");
  const userId = list.json?.users?.[0]?.id;
  if (!userId) {
    console.error("e2e user not found — run e2e-provision-rooms-user.mjs first");
    process.exit(1);
  }
  const upd = await admin(`/users/${userId}`, { password, email_confirm: true }, "PUT");
  if (!upd.res.ok) {
    console.error("password rotate failed", upd.res.status);
    process.exit(1);
  }

  let base = process.env.PLAYWRIGHT_BASE_URL || "https://transovo.ai";
  if (existsSync(outPath)) {
    const prev = readFileSync(outPath, "utf8");
    const m = prev.match(/^PLAYWRIGHT_BASE_URL=(.+)$/m);
    if (m) base = m[1].trim();
  }

  const lines = [
    `E2E_ROOMS_EMAIL=${email}`,
    `E2E_ROOMS_PASSWORD=${password}`,
    `E2E_ROOMS_USER_ID=${userId}`,
    `PLAYWRIGHT_BASE_URL=${base}`,
  ];
  writeFileSync(outPath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(outPath, 0o600);
  console.log(`[e2e] rotated password for ${email} → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
