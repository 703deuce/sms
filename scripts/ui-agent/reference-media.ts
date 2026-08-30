import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_REFERENCES_DIR } from "./config";
import { validateMediaFile } from "./path-guards";
import type { LabeledMedia, MediaKind } from "./types";

export type ReferenceInput = {
  images: string[];
  videos: string[];
  names: string[];
};

export function buildLabeledMedia(
  inputs: Array<{ path: string; label: string; purpose: string }>,
): LabeledMedia[] {
  return inputs.map((input) => {
    const { kind, mimeType } = validateMediaFile(input.path);
    return {
      label: input.label,
      purpose: input.purpose,
      path: input.path,
      kind,
      mimeType,
    };
  });
}

export function loadNamedReference(name: string): { images: string[]; videos: string[] } {
  const dir = join(UI_AGENT_REFERENCES_DIR, name);
  const metaPath = join(dir, "metadata.json");
  if (!existsSync(metaPath)) {
    throw new Error(`Named reference not found: ${name} (expected ${metaPath})`);
  }
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
    files?: Array<{ path: string; type: MediaKind }>;
  };
  const images: string[] = [];
  const videos: string[] = [];
  for (const file of meta.files || []) {
    const abs = join(dir, file.path);
    if (file.type === "video") videos.push(abs);
    else images.push(abs);
  }
  return { images, videos };
}

export function saveNamedReferenceMetadata(
  name: string,
  files: Array<{ path: string; type: MediaKind; source: string; notes?: string }>,
): void {
  const dir = join(UI_AGENT_REFERENCES_DIR, name);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(
    join(dir, "metadata.json"),
    JSON.stringify(
      {
        name,
        createdAt: new Date().toISOString(),
        files,
        notes: "Visual reference only — do not commit raw media",
      },
      null,
      2,
    ),
    "utf8",
  );
}
