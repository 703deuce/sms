import "server-only";
import { getPrisma } from "@/lib/server/db";

export async function sendQuickSms(input: { workspaceId: string; to: string; body: string }): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) throw new Error("TELNYX_API_KEY not configured");
  const from = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
  if (!from) throw new Error("VOICE_OUTBOUND_SMS_FROM_E164 not configured");
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.to, text: input.body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telnyx SMS failed: ${res.status} ${text.slice(0, 200)}`);
  }
  await getPrisma().message.create({
    data: {
      workspaceId: input.workspaceId,
      to: input.to,
      from,
      body: input.body,
      status: "sent",
      providerId: `telnyx:${Date.now()}`,
    },
  }).catch(() => undefined);
}
