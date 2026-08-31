import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { downloadUiReferenceObject } from "./supabase-references";
import {
  getReference,
  loadReferencesManifest,
  type UiReferenceEntry,
} from "@/lib/ui-agent/references-manifest";
import { UI_AGENT_DIR, resolveUiAgentPath } from "./config";
import { loadNamedReference } from "./reference-media";
import { detectMediaKind, inferMimeType } from "./path-guards";
import type { LabeledMedia } from "./types";

const CACHE_DIR = join(UI_AGENT_DIR, "cache");

/** Video reference names mapped to a Transovo route in .ui-agent/references.json */
export function listReferenceVideosForRoute(route: string): string[] {
  const clean = route.startsWith("/") ? route.split("?")[0].replace(/\/$/, "") || "/" : `/${route.split("?")[0]}`;
  return Object.entries(loadReferencesManifest())
    .filter(([, entry]) => entry.type === "video" && entry.transovoRoute === clean)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

/** Prefer the canonical reference over duplicate uploads like "name(1)". */
export function pickPrimaryReferenceVideo(names: string[]): string | undefined {
  if (names.length === 0) return undefined;
  const withoutDuplicateSuffix = names.filter((n) => !/\(\d+\)$/.test(n.trim()));
  return (withoutDuplicateSuffix[0] || names[0]).trim();
}

export async function resolveReferenceByName(name: string): Promise<{ images: string[]; videos: string[] }> {
  const entry = getReference(name);
  if (entry) {
    return materializeReferenceEntry(name, entry);
  }

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

function labeledFromSupabase(name: string, entry: UiReferenceEntry, purpose: string, label: string): LabeledMedia {
  if (!entry.bucket) throw new Error(`Supabase reference ${name} is missing bucket`);
  const kind = entry.type;
  return {
    label,
    purpose,
    path: entry.path,
    kind,
    mimeType: inferMimeType(entry.path, kind),
    supabase: {
      referenceName: name,
      bucket: entry.bucket,
      path: entry.path,
    },
  };
}

function labeledFromLocal(path: string, purpose: string, label: string): LabeledMedia {
  const kind = detectMediaKind(path);
  return {
    label,
    purpose,
    path,
    kind,
    mimeType: inferMimeType(path, kind),
  };
}

export async function resolveAllReferenceMediaForKimi(input: {
  videoNames?: string[];
  imageNames?: string[];
  videoFiles?: string[];
  imageFiles?: string[];
  legacyNames?: string[];
}): Promise<LabeledMedia[]> {
  const labeled: LabeledMedia[] = [];

  for (const p of input.imageFiles || []) {
    const path = resolveUiAgentPath(p);
    labeled.push(labeledFromLocal(path, "Reference image", `REFERENCE_IMAGE_${labeled.length + 1}`));
  }
  for (const p of input.videoFiles || []) {
    const path = resolveUiAgentPath(p);
    labeled.push(labeledFromLocal(path, "Reference video", `REFERENCE_VIDEO_${labeled.length + 1}`));
  }

  for (const name of input.videoNames || []) {
    const entry = getReference(name);
    if (entry?.storage === "supabase") {
      labeled.push(labeledFromSupabase(name, entry, "Reference video", `REFERENCE_VIDEO_${labeled.length + 1}`));
      continue;
    }
    const resolved = await resolveReferenceByName(name);
    for (const path of resolved.videos) {
      labeled.push(labeledFromLocal(path, "Reference video", `REFERENCE_VIDEO_${labeled.length + 1}`));
    }
    for (const path of resolved.images) {
      labeled.push(labeledFromLocal(path, "Reference image", `REFERENCE_IMAGE_${labeled.length + 1}`));
    }
  }

  for (const name of input.imageNames || []) {
    const entry = getReference(name);
    if (entry?.storage === "supabase") {
      const materialized = await materializeReferenceEntry(name, entry);
      for (const path of materialized.images) {
        labeled.push(labeledFromLocal(path, "Reference image", `REFERENCE_IMAGE_${labeled.length + 1}`));
      }
      continue;
    }
    const resolved = await resolveReferenceByName(name);
    for (const path of resolved.images) {
      labeled.push(labeledFromLocal(path, "Reference image", `REFERENCE_IMAGE_${labeled.length + 1}`));
    }
  }

  for (const name of input.legacyNames || []) {
    const resolved = await resolveReferenceByName(name);
    for (const path of resolved.videos) {
      labeled.push(labeledFromLocal(path, "Reference video", `REFERENCE_VIDEO_${labeled.length + 1}`));
    }
    for (const path of resolved.images) {
      labeled.push(labeledFromLocal(path, "Reference image", `REFERENCE_IMAGE_${labeled.length + 1}`));
    }
  }

  return labeled;
}

export function resolveLocalMediaPaths(input: {
  videoFiles?: string[];
  imageFiles?: string[];
}): { images: string[]; videos: string[] } {
  const images = [...(input.imageFiles || []).map((p) => resolveUiAgentPath(p))];
  const videos = [...(input.videoFiles || []).map((p) => resolveUiAgentPath(p))];
  return { images, videos };
}

/** @deprecated Use resolveAllReferenceMediaForKimi for Kimi runs. */
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
