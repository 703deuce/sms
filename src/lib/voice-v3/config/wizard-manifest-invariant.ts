import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import { WIZARD_V3_FIELD_MANIFEST } from "./wizard-v3-field-manifest";

function manifestCoversStatePath(statePath: string, manifestPath: string): boolean {
  if (manifestPath === statePath) return true;
  const mp = manifestPath.replace(/\[\]/g, "");
  const sp = statePath.replace(/\[\]/g, "");
  if (mp === sp) return true;
  if (sp.startsWith(`${mp}.`)) return true;
  if (manifestPath.endsWith("[]") && statePath.startsWith(manifestPath.replace("[]", ""))) {
    return true;
  }
  const base = manifestPath.split("[")[0].split(".")[0];
  return statePath === base || statePath.startsWith(`${base}.`) || statePath.startsWith(`${base}[`);
}

/**
 * Every top-level wizard state key must be represented in the V3 manifest.
 */
export function findUnmappedWizardStateKeys(): string[] {
  const defaultKeys = Object.keys(createDefaultWizardState());
  const unmapped: string[] = [];

  for (const key of defaultKeys) {
    const covered = WIZARD_V3_FIELD_MANIFEST.some((row) =>
      manifestCoversStatePath(key, row.statePath),
    );
    if (!covered) unmapped.push(key);
  }

  return unmapped;
}

export function assertWizardManifestComplete(): void {
  const unmapped = findUnmappedWizardStateKeys();
  if (unmapped.length > 0) {
    throw new Error(
      `WIZARD_V3_MANIFEST_INCOMPLETE: unmapped top-level keys: ${unmapped.join(", ")}`,
    );
  }
}
