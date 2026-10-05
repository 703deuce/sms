import {
  MCTB_FIRST_TEXT_TEMPLATE_ORDER,
  MCTB_FIRST_TEXT_TEMPLATE_REGISTRY,
  getMctbFirstTextTemplate,
} from "@/lib/mctb/first-text-templates/registry";
import { renderMctbFirstTextPreviewExample } from "@/lib/mctb/first-text-templates/render";
import type { MctbFirstTextTemplateId } from "@/lib/mctb/first-text-templates/types";

/** @deprecated Use MctbFirstTextTemplateId — kept for platform persistence typing. */
export type MctbPlatformRecoveryOpenerId = MctbFirstTextTemplateId;

export function listMctbPlatformRecoveryOpenerChoices(): Array<{
  id: MctbFirstTextTemplateId;
  label: string;
  body: string;
  purpose: string;
}> {
  return MCTB_FIRST_TEXT_TEMPLATE_ORDER.map((id) => {
    const row = MCTB_FIRST_TEXT_TEMPLATE_REGISTRY[id];
    return {
      id,
      label: row.name,
      purpose: row.purpose,
      body: renderMctbFirstTextPreviewExample(id),
    };
  });
}

export function resolvePlatformRecoveryOpenerBody(templateId?: string | null): string {
  const id = (templateId || "simple") as MctbFirstTextTemplateId;
  const def = getMctbFirstTextTemplate(
    id in MCTB_FIRST_TEXT_TEMPLATE_REGISTRY ? id : "simple",
  );
  return renderMctbFirstTextPreviewExample(def.id);
}
