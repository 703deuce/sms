import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { VOICE_WEBHOOK_EVENT_TYPES } from "@/lib/voice-v3/webhooks/events";
import { generateWebhookSigningSecret } from "@/lib/voice-v3/webhooks/signing";

function stripWebhook(row: {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  signingSecretPrefix: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    active: row.active,
    signingSecretPrefix: row.signingSecretPrefix,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows = await prisma.webhook.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      data: rows.map(stripWebhook),
      eventTypes: VOICE_WEBHOOK_EVENT_TYPES,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { url?: string; events?: string[]; active?: boolean };
    const url = body.url?.trim();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    const events = (body.events || ["voice.call.completed"]).map(String);
    const { secret, prefix, hash } = generateWebhookSigningSecret();
    const prisma = getPrisma();
    const row = await prisma.webhook.create({
      data: {
        workspaceId: auth.workspaceId,
        url,
        events,
        active: body.active !== false,
        signingSecretPrefix: prefix,
        signingSecretHash: hash,
        metadata: { signingSecret: secret, product: "voice_v3" },
      },
    });
    return NextResponse.json(
      {
        data: stripWebhook(row),
        signingSecret: secret,
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
