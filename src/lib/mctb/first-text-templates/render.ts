import { renderMctbMessageTemplate } from "@/lib/mctb/message-template";
import { resolveCallbackTimePhrase } from "./callback-time";
import {
  buildInformationRequestPhrase,
  normalizeFirstTextInformationRequestFields,
} from "./information-request-phrase";
import { getMctbFirstTextTemplate } from "./registry";
import type {
  MctbFirstTextTemplateConfig,
  MctbFirstTextTemplateId,
  MctbFirstTextTemplateVariables,
} from "./types";

const PLACEHOLDER_RE = /\{\{[^}]+\}\}|\{[a-z_]+\}/i;

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
  const infoFields = normalizeFirstTextInformationRequestFields(
    input.config.informationRequestFields,
  );
  let informationRequestPhrase = buildInformationRequestPhrase(infoFields);
  if (!informationRequestPhrase) {
    informationRequestPhrase = "what you need help with";
  }

  return {
    business_name: input.businessName.trim(),
    businessName: input.businessName.trim(),
    callback_time: callbackPhrase,
    callbackTime: callbackPhrase,
    information_request_phrase: informationRequestPhrase,
    informationRequestPhrase: informationRequestPhrase,
    service_1: (vars.service1 || "").trim(),
    service_2: (vars.service2 || "").trim(),
    service1: (vars.service1 || "").trim(),
    service2: (vars.service2 || "").trim(),
  };
}

export function resolveFirstTextTemplateBodyString(
  templateId: import("./types").MctbFirstTextTemplateId,
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
  const sampleVars: MctbFirstTextTemplateVariables = {
    callbackTime: { preset: "within_30_minutes" },
    callbackTimeAfterHours: { preset: "when_we_reopen_tomorrow_morning" },
    service1: "a plumbing problem",
    service2: "an estimate",
  };
  return renderMctbFirstTextTemplateBody({
    config: { templateId, version: 1, variables: sampleVars },
    businessName,
    inBusinessHours: true,
  });
}

export type MctbFirstTextValidationResult =
  | { ok: true }
  | { ok: false; field: string; message: string };

export function validateMctbFirstTextTemplateConfig(
  config: MctbFirstTextTemplateConfig,
  businessName: string,
  inBusinessHours = true,
): MctbFirstTextValidationResult {
  const def = getMctbFirstTextTemplate(config.templateId);
  const name = businessName.trim();
  if (!name) {
    return { ok: false, field: "business_name", message: "Add your business name in Business Profile." };
  }

  const vars = config.variables || {};
  if (def.requiredVariables.includes("service1") || def.requiredVariables.includes("service2")) {
    if (!(vars.service1 || "").trim()) {
      return { ok: false, field: "service1", message: "Enter the first option." };
    }
    if (!(vars.service2 || "").trim()) {
      return { ok: false, field: "service2", message: "Enter the second option." };
    }
  }

  if (def.usesCallbackTime) {
    const callbackVar = inBusinessHours ? vars.callbackTime : vars.callbackTimeAfterHours ?? vars.callbackTime;
    const phrase = resolveCallbackTimePhrase(callbackVar);
    if (!phrase) {
      return {
        ok: false,
        field: inBusinessHours ? "callbackTime" : "callbackTimeAfterHours",
        message: inBusinessHours
          ? "Choose a callback time you can consistently meet."
          : "Choose an after-hours callback expectation.",
      };
    }
  }

  const body = renderMctbFirstTextTemplateBody({
    config,
    businessName: name,
    inBusinessHours,
  });
  if (PLACEHOLDER_RE.test(body)) {
    return { ok: false, field: "template", message: "Message still has unresolved placeholders." };
  }

  return { ok: true };
}

export function assertMctbFirstTextSafeForSend(body: string): void {
  if (PLACEHOLDER_RE.test(body)) {
    throw new Error("mctb_first_text_unresolved_placeholder");
  }
}
