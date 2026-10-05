import { normalizeSmsCollectFields } from "@/lib/mctb/ai-recovery/collect-field-schema";
import { defaultCallbackTimeVariable } from "./callback-time";
import { defaultFirstTextInformationRequestFields } from "./information-request-phrase";
import { migrateLegacyPlatformRecoveryTemplateId } from "./registry";
import type { MctbSmsCollectFieldDef } from "@/lib/mctb/lead-recovery/types";
import type {
  MctbCallbackTimePreset,
  MctbCallbackTimeVariable,
  MctbFirstTextTemplateConfig,
  MctbFirstTextTemplateId,
  MctbFirstTextTemplateVariables,
} from "./types";
import { MCTB_FIRST_TEXT_TEMPLATE_VERSION } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseCallbackTime(raw: unknown): MctbCallbackTimeVariable | null {
  const row = asRecord(raw);
  const preset = String(row.preset || "").trim() as MctbCallbackTimePreset;
  if (!preset) return null;
  const customText = typeof row.customText === "string" ? row.customText : null;
  return { preset, customText };
}

function parseVariables(raw: unknown): MctbFirstTextTemplateVariables {
  const row = asRecord(raw);
  return {
    callbackTime: parseCallbackTime(row.callbackTime),
    callbackTimeAfterHours: parseCallbackTime(row.callbackTimeAfterHours),
    service1: typeof row.service1 === "string" ? row.service1 : null,
    service2: typeof row.service2 === "string" ? row.service2 : null,
  };
}

function parseInformationRequestFields(raw: unknown): MctbSmsCollectFieldDef[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return normalizeSmsCollectFields(raw);
}

export function defaultMctbFirstTextTemplateConfig(
  templateId: MctbFirstTextTemplateId = "simple",
): MctbFirstTextTemplateConfig {
  return {
    templateId,
    version: MCTB_FIRST_TEXT_TEMPLATE_VERSION,
    variables: {
      callbackTime: defaultCallbackTimeVariable(true),
      callbackTimeAfterHours: defaultCallbackTimeVariable(false),
      service1: "",
      service2: "",
    },
    informationRequestFields: defaultFirstTextInformationRequestFields(),
  };
}

export function parseMctbFirstTextTemplateConfig(raw: unknown): MctbFirstTextTemplateConfig | null {
  const row = asRecord(raw);
  if (!row.templateId && !row.platformRecoveryTemplateId) return null;
  const templateId = migrateLegacyPlatformRecoveryTemplateId(
    String(row.templateId || row.platformRecoveryTemplateId || ""),
  );
  const informationRequestFields = parseInformationRequestFields(row.informationRequestFields);
  return {
    templateId,
    version: Number(row.version) || MCTB_FIRST_TEXT_TEMPLATE_VERSION,
    variables: parseVariables(row.variables),
    ...(informationRequestFields ? { informationRequestFields } : {}),
  };
}

export function readMctbFirstTextTemplateConfigFromMctbFields(
  mctb: Record<string, unknown>,
): MctbFirstTextTemplateConfig {
  const fromFirstText = parseMctbFirstTextTemplateConfig(mctb.firstTextTemplate);
  if (fromFirstText) {
    const defaults = defaultMctbFirstTextTemplateConfig(fromFirstText.templateId);
    return {
      ...defaults,
      ...fromFirstText,
      variables: {
        ...defaults.variables,
        ...fromFirstText.variables,
      },
      informationRequestFields:
        fromFirstText.informationRequestFields ?? defaults.informationRequestFields,
    };
  }
  const legacyId = migrateLegacyPlatformRecoveryTemplateId(
    String(mctb.platformRecoveryTemplateId || ""),
  );
  return defaultMctbFirstTextTemplateConfig(legacyId);
}
