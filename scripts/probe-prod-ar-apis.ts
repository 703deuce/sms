import { request } from "playwright";
import { authenticate } from "./browser-cert/lib";

async function main() {
  const base = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
  const { storageState } = await authenticate(base);
  const ctx = await request.newContext({ baseURL: base, storageState });
  for (const step of ["confirmation", "reminder24h", "reminder2h"]) {
    const r = await ctx.get(`/api/appointment-reminders/reminders/test?step=${step}`);
    console.log("test", step, r.status(), (await r.text()).slice(0, 300));
  }
  const w = await ctx.get("/api/appointment-reminders/reminders/workspace");
  console.log("workspace", w.status(), (await w.text()).slice(0, 300));
  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
