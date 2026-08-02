import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function secret() {
  return (
    process.env.VOICE_WIDGET_SECRET?.trim() ||
    process.env.VOICE_MCP_SECRET?.trim() ||
    process.env.TELNYX_API_KEY?.trim() ||
    ""
  );
}

export function signWidgetSession(payload: Record<string, unknown>) {
  const s = secret();
  if (!s) throw new Error("Widget signing secret missing");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", s).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyWidgetSession(token: string): Record<string, unknown> | null {
  const s = secret();
  if (!s || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", s).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (Number(payload.exp || 0) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function mintWidgetSession(input: {
  agentId: string;
  workspaceId: string;
  testMode?: boolean;
  ttlMs?: number;
}) {
  return signWidgetSession({
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    nonce: randomBytes(8).toString("hex"),
    exp: Date.now() + (input.ttlMs ?? 15 * 60_000),
    testMode: Boolean(input.testMode),
  });
}
