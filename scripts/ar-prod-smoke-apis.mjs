import { request } from "playwright";

const base = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";

async function authenticate() {
  const api = await request.newContext({ baseURL: base, timeout: 120_000 });
  const bypass = await api.get("/api/auth/dev-bypass?next=/appointment-reminders", { maxRedirects: 0 });
  if (!bypass.ok() && ![302, 307, 308].includes(bypass.status())) {
    throw new Error(`dev-bypass failed: ${bypass.status()}`);
  }
  const storageState = await api.storageState();
  await api.dispose();
  return storageState;
}

async function main() {
  const storageState = await authenticate();
  const ctx = await request.newContext({ baseURL: base, storageState });

  const sync = await ctx.post("/api/appointment-reminders/sync");
  console.log("sync", sync.status(), await sync.text());

  const appts = await ctx.get("/api/appointment-reminders/appointments?date=all&pageSize=3");
  console.log("appointments", appts.status(), await appts.text());

  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
