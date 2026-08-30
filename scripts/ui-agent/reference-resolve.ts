import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { downloadUiReferenceObject } from "./supabase-references";
import { getReference, type UiReferenceEntry } from "@/lib/ui-agent/references-manifest";
import { REPO_ROOT, UI_AGENT_DIR, resolveUiAgentPath } from "./config";
import { loadNamedReference } from "./reference-media";

const CACHE_DIR = join(UI_AGENT_DIR, "cache");

export async function resolveReferenceByName(name: string): Promise<{ images: string[]; videos: string[] }> {
  const entry = getReference(name);
  if (entry) {
    return materializeReferenceEntry(name, entry);
  }

  // Legacy local named reference folder
  try {
    return loadNamedReference(name);
  } catch {
    throw new Error(`Reference not found: ${name}. Run npm run ui:refs to list saved references.`);
  }
}

async function materializeReferenceEntry(
  name: string,
  entry: UiReferenceEntry,
): Promise<{ images: string[]; videos: string[] }> {
  if (entry.storage === "local") {
    const abs = resolveUiAgentPath(entry.path);
    if (!existsSync(abs)) throw new Error(`Local reference file missing: ${entry.path}`);
    return entry.type === "video" ? { images: [], videos: [abs] } : { images: [abs], videos: [] };
  }

  if (!entry.bucket) throw new Error(`Supabase reference ${name} is missing bucket`);

  const cacheDir = join(CACHE_DIR, name);
  mkdirSync(cacheDir, { recursive: true });
  const filename = basename(entry.path);
  const localPath = join(cacheDir, filename);

  if (!existsSync(localPath)) {
    const bytes = await downloadUiReferenceObject({ bucket: entry.bucket, path: entry.path });
    writeFileSync(localPath, bytes);
  }

  return entry.type === "video" ? { images: [], videos: [localPath] } : { images: [localPath], videos: [] };
}

export function resolveLocalMediaPaths(input: {
  videoFiles?: string[];
  imageFiles?: string[];
  videoNames?: string[];
  imageNames?: string[];
}): { images: string[]; videos: string[] } {
  const images = [...(input.imageFiles || []).map((p) => resolveUiAgentPath(p))];
  const videos = [...(input.videoFiles || []).map((p) => resolveUiAgentPath(p))];
  return { images, videos };
}

export async function resolveAllReferenceMedia(input: {
  videoNames?: string[];
  imageNames?: string[];
  videoFiles?: string[];
  imageFiles?: string[];
  legacyNames?: string[];
}): Promise<{ images: string[]; videos: string[] }> {
  const images: string[] = [];
  const videos: string[] = [];

  const local = resolveLocalMediaPaths({
    videoFiles: input.videoFiles,
    imageFiles: input.imageFiles,
  });
  images.push(...local.images);
  videos.push(...local.videos);

  for (const name of input.videoNames || []) {
    const resolved = await resolveReferenceByName(name);
    videos.push(...resolved.videos);
    images.push(...resolved.images);
  }

  for (const name of input.imageNames || []) {
    const resolved = await resolveReferenceByName(name);
    images.push(...resolved.images);
    videos.push(...resolved.videos);
  }

  for (const name of input.legacyNames || []) {
    const resolved = await resolveReferenceByName(name);
    images.push(...resolved.images);
    videos.push(...resolved.videos);
  }

  return { images: [...new Set(images)], videos: [...new Set(videos)] };
}
