import "server-only";

import { access, readFile } from "fs/promises";
import path from "path";
import { getPrisma } from "@/lib/db";
import { publicPlaybackUrl } from "./media-service";
import { DEFAULT_HOLD_MUSIC_SLUG, getHoldMusicTrack } from "./hold-music-library";

const SYSTEM_AUDIO_DIR = path.join(process.cwd(), "public", "smart-routing-audio", "system");

export type ResolvedHoldAudio = {
  mode: "music" | "ringback" | "none";
  playbackUrl?: string | null;
  assetId?: string | null;
  slug?: string | null;
  title?: string | null;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function systemHoldMusicFilePath(slug: string): string {
  return path.join(SYSTEM_AUDIO_DIR, `${slug}.mp3`);
}

export async function resolveWorkspaceHoldAudio(
  workspaceId: string,
): Promise<ResolvedHoldAudio> {
  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId },
  });

  if (settings?.holdMusicMode === "ringback" || settings?.holdMusicMode === "none") {
    return { mode: settings.holdMusicMode as "ringback" | "none" };
  }

  if (settings?.holdMusicAssetId) {
    const asset = await prisma.smartRoutingAudioAsset.findFirst({
      where: { id: settings.holdMusicAssetId, workspaceId },
    });
    if (asset?.status === "ready") {
      return {
        mode: "music",
        playbackUrl: publicPlaybackUrl(asset.id),
        assetId: asset.id,
        title: asset.name,
      };
    }
  }

  const slug = settings?.holdMusicSlug?.trim() || DEFAULT_HOLD_MUSIC_SLUG;
  const track = getHoldMusicTrack(slug);
  const diskPath = systemHoldMusicFilePath(slug);
  if (await fileExists(diskPath)) {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    const urlPath = `/smart-routing-audio/system/${slug}.mp3`;
    return {
      mode: "music",
      playbackUrl: base ? `${base.replace(/\/$/, "")}${urlPath}` : urlPath,
      slug,
      title: track?.title ?? slug,
    };
  }

  return { mode: "ringback" };
}

export async function readSystemHoldMusicBytes(slug: string): Promise<Buffer | null> {
  const diskPath = systemHoldMusicFilePath(slug);
  if (!(await fileExists(diskPath))) return null;
  return readFile(diskPath);
}
