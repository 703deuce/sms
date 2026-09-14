#!/usr/bin/env npx tsx
import { telnyxProvider } from "@/lib/messaging/telnyx/provider";
const raw = process.argv[2] || "5714776175";
const d = raw.replace(/\D/g, "");
const to = d.length === 10 ? `+1${d}` : `+${d}`;
const body =
  process.argv[3] ||
  `Transovo ping ${new Date().toISOString().slice(11, 19)}Z — if you see this, 571 SMS delivery is working.`;

async function main() {
  const r = await telnyxProvider.sendMessage(
    { phoneE164: "+15714073615", messagingProvider: "telnyx" } as import("@prisma/client").MessagingRegistration,
    { to, from: "+15714073615", body },
  );
  console.log({ to, body, ...r });
}

main();
