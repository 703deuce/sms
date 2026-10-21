import { renderMctbMessageTemplate } from "@/lib/mctb/message-template";
import { resolveCallbackTimePhrase } from "./callback-time";
import { getMctbFirstTextTemplate } from "./registry";
import type { MctbFirstTextTemplateConfig, MctbFirstTextTemplateId } from "./types";

const DEFAULT_INFO_PHRASE = "what you need help with";

export type MctbFirstTextRenderInput = {
  config: MctbFirstTextTemplateConfig;
  businessName: string;
  inBusinessHours: boolean;
};

export function buildFirstTextSubstitutionMap(input: MctbFirstTextRenderInput): Record<string, string> {
  const def = getMctbFirstTextTemplate(input.config.templateId);
  const vars = input.config.variables || {};
  const callbackVar = input.inBusinessHours ? vars.callbackTime : vars.callbackTimeAfterHours ?? vars.callbackTime;
  const callbackPhrase = def.usesCallbackTime ? resolveCallbackTimePhrase(callbackVar) : "";

  return {
    business_name: input.businessName.trim(),
    businessName: input.businessName.trim(),
    callback_time: callbackPhrase,
    callbackTime: callbackPhrase,
    information_request_phrase: DEFAULT_INFO_PHRASE,
    informationRequestPhrase: DEFAULT_INFO_PHRASE,
    service_1: (vars.service1 || "").trim(),
    service_2: (vars.service2 || "").trim(),
    service1: (vars.service1 || "").trim(),
    service2: (vars.service2 || "").trim(),
  };
}

export function resolveFirstTextTemplateBodyString(
  templateId: MctbFirstTextTemplateId,
  inBusinessHours: boolean,
): string {
  const def = getMctbFirstTextTemplate(templateId);
  if (!inBusinessHours && def.bodyAfterHours?.trim()) {
    return def.bodyAfterHours;
  }
  return def.body;
}

export function renderMctbFirstTextTemplateBody(input: MctbFirstTextRenderInput): string {
  const substitutions = buildFirstTextSubstitutionMap(input);
  const body = resolveFirstTextTemplateBodyString(input.config.templateId, input.inBusinessHours);
  return renderMctbMessageTemplate(body, substitutions);
}

export function renderMctbFirstTextPreviewExample(
  templateId: MctbFirstTextTemplateId,
  businessName = "Joe's Plumbing",
): string {
  return renderMctbFirstTextTemplateBody({
    config: {
      templateId,
      version: 2,
      variables: {
        callbackTime: { preset: "within_30_minutes" },
        callbackTimeAfterHours: { preset: "when_we_reopen_tomorrow_morning" },
        service1: "a plumbing problem",
        service2: "an estimate",
      },
    },
    businessName,
    inBusinessHours: true,
  });
}
