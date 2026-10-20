/**
 * Authoritative worksheet: wizard state paths → Voice V3 destinations.
 * Built programmatically so Steps 1–8 controls stay exhaustive.
 */
import {
  buildWizardV3FieldManifest,
  summarizeWizardV3Manifest,
  type WizardV3Destination,
  type WizardV3FieldManifestRow,
} from "./wizard-v3-manifest-builder";

export type { WizardV3Destination, WizardV3FieldManifestRow };

export const WIZARD_V3_FIELD_MANIFEST: WizardV3FieldManifestRow[] =
  buildWizardV3FieldManifest();

export const WIZARD_V3_MANIFEST_SUMMARY = summarizeWizardV3Manifest(
  WIZARD_V3_FIELD_MANIFEST,
);
