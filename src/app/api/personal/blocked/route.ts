import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  loadPersonalBlockedNumbers,
  type PersonalBlockedRow,
} from "@/lib/workspace/personal-data";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const numberId = url.searchParams.get("numberId")?.trim() || undefined;
    const rows = await loadPersonalBlockedNumbers(auth.workspaceId, numberId);
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { phone?: string; reason?: string; numberId?: string };
    const phone = body.phone?.trim();
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const e164 = normalizeE164(phone);
    const perNumberKey = body.numberId
      ? `${auth.workspaceId}:${body.numberId}:p:${e164}`
      : `p:${e164}`;
    const suppressionKey = body.numberId ? perNumberKey : `p:${e164}`;
    const prisma = getPrisma();

    const existing = await prisma.suppression.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ phone: e164 }, { suppressionKey }],
      },
    });
    if (existing) {
      return NextResponse.json({
        data: {
          id: existing.id,
          phone: e164,
          reason: existing.reason,
          source: existing.source,
          createdAt: existing.createdAt.toISOString(),
        } satisfies PersonalBlockedRow,
      });
    }

    const row = await prisma.suppression.create({
      data: {
        workspaceId: auth.workspaceId,
        phone: e164,
        suppressionKey,
        reason: body.reason?.trim() || "blocked_by_user",
        source: "personal_blocked",
      },
    });

    return NextResponse.json({
      data: {
        id: row.id,
        phone: row.phone || e164,
        reason: row.reason,
        source: row.source,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await getPrisma().suppression.deleteMany({
      where: { id, workspaceId: auth.workspaceId },
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
