import { defaultCallbackTimeVariable } from "./callback-time";
import { migrateLegacyPlatformRecoveryTemplateId } from "./registry";
import type {
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
  const preset = String(row.preset || "").trim() as MctbCallbackTimeVariable["preset"];
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

export function defaultMctbFirstTextTemplateConfig(
  templateId: MctbFirstTextTemplateId = "simple",
): MctbFirstTextTemplateConfig {
  return {
    templateId,
    version: MCTB_FIRST_TEXT_TEMPLATE_VERSION,
    variables: {
      callbackTime: defaultCallbackTimeVariable(true),
      callbackTimeAfterHours: defaultCallbackTimeVariable(false),
      service1: "a service visit",
      service2: "an estimate",
    },
  };
}

export function parseMctbFirstTextTemplateConfig(raw: unknown): MctbFirstTextTemplateConfig | null {
  const row = asRecord(raw);
  if (!row.templateId && !row.platformRecoveryTemplateId) return null;
  const templateId = migrateLegacyPlatformRecoveryTemplateId(
    String(row.templateId || row.platformRecoveryTemplateId || ""),
  );
  return {
    templateId,
    version: Number(row.version) || MCTB_FIRST_TEXT_TEMPLATE_VERSION,
    variables: parseVariables(row.variables),
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
      variables: { ...defaults.variables, ...fromFirstText.variables },
    };
  }
  const legacyId = migrateLegacyPlatformRecoveryTemplateId(
    String(mctb.platformRecoveryTemplateId || mctb.firstTextTemplateId || ""),
  );
  return defaultMctbFirstTextTemplateConfig(legacyId);
}
