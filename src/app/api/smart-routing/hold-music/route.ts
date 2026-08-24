import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { HOLD_MUSIC_TRACKS, DEFAULT_HOLD_MUSIC_SLUG } from "@/lib/smart-routing/hold-music-library";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
      where: { workspaceId: auth.workspaceId },
    });
    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
    const tracks = HOLD_MUSIC_TRACKS.map((t) => ({
      slug: t.slug,
      title: t.title,
      description: t.description,
      previewUrl: `${base}/smart-routing-audio/system/${t.slug}.mp3`,
    }));
    return NextResponse.json({
      data: {
        selectedSlug: settings?.holdMusicSlug ?? DEFAULT_HOLD_MUSIC_SLUG,
        holdMusicMode: settings?.holdMusicMode ?? "music",
        holdMusicAssetId: settings?.holdMusicAssetId ?? null,
        systemTracks: tracks,
        ringbackOption: { slug: "ringback", title: "No Music / Ringback" },
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const holdMusicSlug = body.holdMusicSlug ? String(body.holdMusicSlug) : undefined;
    const holdMusicMode = body.holdMusicMode ? String(body.holdMusicMode) : undefined;
    const holdMusicAssetId = body.holdMusicAssetId ? String(body.holdMusicAssetId) : null;

    const prisma = getPrisma();
    await prisma.smartRoutingWorkspaceSettings.upsert({
      where: { workspaceId: auth.workspaceId },
      create: {
        workspaceId: auth.workspaceId,
        holdMusicSlug: holdMusicSlug ?? DEFAULT_HOLD_MUSIC_SLUG,
        holdMusicMode: holdMusicMode ?? "music",
        holdMusicAssetId,
      },
      update: {
        ...(holdMusicSlug ? { holdMusicSlug } : {}),
        ...(holdMusicMode ? { holdMusicMode } : {}),
        holdMusicAssetId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
