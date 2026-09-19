import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import { WIZARD_V3_FIELD_MANIFEST } from "./wizard-v3-field-manifest";
import { WIZARD_REQUIRED_CONTROL_PATHS } from "./wizard-required-control-paths";

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

/** Nested customer-editable paths must have an exact manifest row. */
export function findUnmappedRequiredControlPaths(): string[] {
  const manifestPaths = new Set(WIZARD_V3_FIELD_MANIFEST.map((r) => r.statePath));
  return WIZARD_REQUIRED_CONTROL_PATHS.filter((p) => !manifestPaths.has(p));
}

export function assertWizardManifestComplete(): void {
  const topUnmapped = findUnmappedWizardStateKeys();
  if (topUnmapped.length > 0) {
    throw new Error(
      `WIZARD_V3_MANIFEST_INCOMPLETE: unmapped top-level keys: ${topUnmapped.join(", ")}`,
    );
  }

  const nestedUnmapped = findUnmappedRequiredControlPaths();
  if (nestedUnmapped.length > 0) {
    throw new Error(
      `WIZARD_V3_MANIFEST_INCOMPLETE: unmapped nested controls: ${nestedUnmapped.slice(0, 8).join(", ")}${nestedUnmapped.length > 8 ? ` (+${nestedUnmapped.length - 8} more)` : ""}`,
    );
  }
}
