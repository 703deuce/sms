#!/usr/bin/env node
/**
 * Create e2e-rooms@transovo.ai + workspace via Supabase Admin API.
 * Writes credentials to /root/.transovo-e2e.env (mode 600). Never logs password.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync, chmodSync } from "node:fs";

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
  let userId;
  const create = await admin("/users", {
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "E2E Rooms" },
  });
  if (create.res.ok) {
    userId = create.json.id;
  } else if (create.res.status === 422 || String(create.json.msg || "").includes("already")) {
    const list = await admin(`/users?email=${encodeURIComponent(email)}`, null, "GET");
    userId = list.json?.users?.[0]?.id;
    if (!userId) {
      console.error("User exists but could not resolve id");
      process.exit(1);
    }
    await admin(`/users/${userId}`, { password, email_confirm: true }, "PUT");
  } else {
    console.error("create user failed", create.res.status, create.json);
    process.exit(1);
  }

  const lines = [
    `E2E_ROOMS_EMAIL=${email}`,
    `E2E_ROOMS_PASSWORD=${password}`,
    `E2E_ROOMS_USER_ID=${userId}`,
    `PLAYWRIGHT_BASE_URL=${process.env.PLAYWRIGHT_BASE_URL || "https://transovo.ai"}`,
  ];
  writeFileSync(outPath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(outPath, 0o600);
  console.log(`[e2e] provisioned ${email} → ${outPath} (password not printed)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
