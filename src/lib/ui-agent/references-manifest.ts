import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type UiReferenceKind = "video" | "image";

export type UiReferenceEntry = {
  type: UiReferenceKind;
  storage: "supabase" | "local";
  bucket?: string;
  path: string;
  description?: string;
  /** Target Transovo route for Kimi batch generation */
  transovoRoute?: string;
  createdAt: string;
  updatedAt?: string;
};

export type UiReferencesManifest = Record<string, UiReferenceEntry>;

const MANIFEST_DIR = join(process.cwd(), ".ui-agent");
const MANIFEST_PATH = join(MANIFEST_DIR, "references.json");

export function referencesManifestPath(): string {
  return MANIFEST_PATH;
}

export function loadReferencesManifest(): UiReferencesManifest {
  if (!existsSync(MANIFEST_PATH)) {
    return {};
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as UiReferencesManifest;
}

export function saveReferencesManifest(manifest: UiReferencesManifest): void {
  if (!existsSync(MANIFEST_DIR)) {
    mkdirSync(MANIFEST_DIR, { recursive: true });
  }
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

export function upsertReference(name: string, entry: Omit<UiReferenceEntry, "createdAt"> & { createdAt?: string }): UiReferenceEntry {
  const manifest = loadReferencesManifest();
  const existing = manifest[name];
  const saved: UiReferenceEntry = {
    ...entry,
    createdAt: existing?.createdAt || entry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  manifest[name] = saved;
  saveReferencesManifest(manifest);
  return saved;
}

export function deleteReference(name: string): UiReferenceEntry | null {
  const manifest = loadReferencesManifest();
  const existing = manifest[name];
  if (!existing) return null;
  delete manifest[name];
  saveReferencesManifest(manifest);
  return existing;
}

export function getReference(name: string): UiReferenceEntry | null {
  return loadReferencesManifest()[name] || null;
}

export function listReferences(): Array<{ name: string; entry: UiReferenceEntry }> {
  return Object.entries(loadReferencesManifest())
    .map(([name, entry]) => ({ name, entry }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
