import { request } from "playwright";
import { authenticate } from "./browser-cert/lib";

async function main() {
  const base = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
  const { storageState } = await authenticate(base);
  const ctx = await request.newContext({ baseURL: base, storageState });
  const body = {
    businessId: "ws_1",
    customerName: "Review Test Oct 15",
    customerPhone: "+15714776175",
    serviceType: "front-end test",
  };
  const res = await ctx.post("/api/reputation/review-requests/send-sms", {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  const text = await res.text();
  console.log("status", res.status());
  console.log("body", text.slice(0, 500));
  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
