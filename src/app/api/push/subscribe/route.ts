import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const sub = await getPrisma().pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: auth.session.userId,
          endpoint: body.endpoint,
        },
      },
      create: {
        workspaceId: auth.workspaceId,
        userId: auth.session.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });

    return NextResponse.json({ data: { id: sub.id } }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    await getPrisma().pushSubscription.deleteMany({
      where: {
        userId: auth.session.userId,
        endpoint: body.endpoint,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
