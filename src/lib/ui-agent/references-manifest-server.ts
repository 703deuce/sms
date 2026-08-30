import "server-only";

import {
  deleteReference,
  loadReferencesManifest,
  saveReferencesManifest,
  type UiReferenceEntry,
  type UiReferencesManifest,
} from "@/lib/ui-agent/references-manifest";
import {
  isUiReferenceStorageConfigured,
  readUiReferencesManifestFromStorage,
  writeUiReferencesManifestToStorage,
} from "@/lib/ui-agent/reference-storage";

export async function loadReferencesManifestAsync(): Promise<UiReferencesManifest> {
  if (isUiReferenceStorageConfigured()) {
    const remote = await readUiReferencesManifestFromStorage();
    if (remote) {
      try {
        const parsed = JSON.parse(remote) as UiReferencesManifest;
        saveReferencesManifest(parsed);
        return parsed;
      } catch {
        // fall through to local file
      }
    }
  }
  return loadReferencesManifest();
}

export async function saveReferencesManifestAsync(manifest: UiReferencesManifest): Promise<void> {
  saveReferencesManifest(manifest);
  if (isUiReferenceStorageConfigured()) {
    await writeUiReferencesManifestToStorage(JSON.stringify(manifest, null, 2));
  }
}

export async function upsertReferenceAsync(
  name: string,
  entry: Omit<UiReferenceEntry, "createdAt"> & { createdAt?: string },
): Promise<UiReferenceEntry> {
  const manifest = await loadReferencesManifestAsync();
  const existing = manifest[name];
  const saved: UiReferenceEntry = {
    ...entry,
    createdAt: existing?.createdAt || entry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  manifest[name] = saved;
  await saveReferencesManifestAsync(manifest);
  return saved;
}

export async function deleteReferenceAsync(name: string): Promise<UiReferenceEntry | null> {
  const manifest = await loadReferencesManifestAsync();
  const existing = manifest[name];
  if (!existing) return null;
  delete manifest[name];
  await saveReferencesManifestAsync(manifest);
  return existing;
}

export async function listReferencesAsync(): Promise<Array<{ name: string; entry: UiReferenceEntry }>> {
  const manifest = await loadReferencesManifestAsync();
  return Object.entries(manifest)
    .map(([name, entry]) => ({ name, entry }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
