import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

function readScriptDefault(scriptName, constName) {
  const src = readFileSync(join(__dir, "..", scriptName), "utf8");
  const re = new RegExp(
    `const ${constName} = \\(process\\.env\\.\\w+ \\|\\| ["']([^"']+)["']\\)`,
  );
  const m = src.match(re);
  return m?.[1] || "";
}

export function getProductionBase() {
  return (
    process.env.BASE_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    readScriptDefault("voice-inbound-repair.mjs", "BASE")
  )
    .replace(/\/$/, "")
    .trim();
}

export function getOwnerEmail() {
  return (
    process.env.OWNER_EMAIL ||
    process.env.AMY_EMAIL ||
    readScriptDefault("voice-inbound-repair.mjs", "OWNER_EMAIL")
  ).trim();
}

export const SMOKE_BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";

export function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function storeCookies(jar, res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

export async function smokeLogin() {
  const BASE = getProductionBase();
  const jar = new Map();
  const login = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": SMOKE_BOOTSTRAP,
    },
    body: JSON.stringify({ email: getOwnerEmail() }),
  });
  storeCookies(jar, login);
  if (!login.ok) {
    throw new Error(`smoke-login ${login.status}: ${await login.text()}`);
  }
  return { jar, base: BASE };
}

export async function api(jar, base, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(jar),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  return { status: res.status, json };
}
