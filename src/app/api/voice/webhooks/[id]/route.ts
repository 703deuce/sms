import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { generateWebhookSigningSecret } from "@/lib/voice-v3/webhooks/signing";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      url?: string;
      events?: string[];
      active?: boolean;
      rotateSecret?: boolean;
    };
    const prisma = getPrisma();
    const existing = await prisma.webhook.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.url?.trim()) data.url = body.url.trim();
    if (body.events) data.events = body.events.map(String);
    if (body.active !== undefined) data.active = body.active;

    let signingSecret: string | undefined;
    if (body.rotateSecret) {
      const gen = generateWebhookSigningSecret();
      signingSecret = gen.secret;
      data.signingSecretPrefix = gen.prefix;
      data.signingSecretHash = gen.hash;
      const meta =
        existing.metadata && typeof existing.metadata === "object"
          ? { ...(existing.metadata as object) }
          : {};
      (meta as Record<string, unknown>).signingSecret = gen.secret;
      data.metadata = meta;
    }

    const row = await prisma.webhook.update({ where: { id }, data: data as never });
    return NextResponse.json({
      data: {
        id: row.id,
        url: row.url,
        events: row.events,
        active: row.active,
        signingSecretPrefix: row.signingSecretPrefix,
      },
      signingSecret,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const prisma = getPrisma();
    const deleted = await prisma.webhook.deleteMany({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!deleted.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
