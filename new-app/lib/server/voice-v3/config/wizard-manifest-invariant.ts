import { WIZARD_V3_FIELD_MANIFEST } from "./wizard-v3-field-manifest";
import { WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS } from "./wizard-control-inventory";

/** Every customer-editable leaf control must have an exact manifest `statePath` row. */
export function findUnmappedCustomerEditableControlPaths(): string[] {
  const manifestPaths = new Set(WIZARD_V3_FIELD_MANIFEST.map((r) => r.statePath));
  return WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS.filter((p) => !manifestPaths.has(p));
}

/** @deprecated Use findUnmappedCustomerEditableControlPaths — parent coverage is not sufficient. */
export function findUnmappedRequiredControlPaths(): string[] {
  return findUnmappedCustomerEditableControlPaths();
}

/** @deprecated Top-level parent rows do not satisfy leaf-level certification. */
export function findUnmappedWizardStateKeys(): string[] {
  return [];
}

export function assertWizardManifestComplete(): void {
  const unmapped = findUnmappedCustomerEditableControlPaths();
  if (unmapped.length > 0) {
    throw new Error(
      `WIZARD_V3_MANIFEST_INCOMPLETE: unmapped customer-editable controls: ${unmapped.slice(0, 12).join(", ")}${unmapped.length > 12 ? ` (+${unmapped.length - 12} more)` : ""}`,
    );
  }
}

export function countWizardManifestCoverage(): {
  totalEditableLeafControls: number;
  totalV3MappedLeafControls: number;
  unmapped: number;
} {
  const manifestPaths = new Set(WIZARD_V3_FIELD_MANIFEST.map((r) => r.statePath));
  const totalEditable = WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS.length;
  let mapped = 0;
  for (const path of WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS) {
    if (manifestPaths.has(path)) mapped += 1;
  }
  return {
    totalEditableLeafControls: totalEditable,
    totalV3MappedLeafControls: mapped,
    unmapped: totalEditable - mapped,
  };
}
