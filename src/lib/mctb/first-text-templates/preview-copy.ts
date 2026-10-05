import { resolveCallbackTimePhrase } from "./callback-time";
import { renderMctbDeterministicFirstReplyAck } from "./deterministic-first-reply-ack";
import {
  buildInformationRequestPhrase,
  normalizeFirstTextInformationRequestFields,
} from "./information-request-phrase";
import { buildFirstTextSubstitutionMap, renderMctbFirstTextTemplateBody } from "./render";
import type { MctbFirstTextTemplateConfig } from "./types";

/** Customer-facing fragment shown under the information-request field list. */
export function buildInformationRequestPreviewSentence(
  config: MctbFirstTextTemplateConfig,
): string {
  const fields = normalizeFirstTextInformationRequestFields(config.informationRequestFields);
  const phrase = buildInformationRequestPhrase(fields);
  if (!phrase) return "";
  return `While you wait, reply with ${phrase}.`;
}

export function previewFirstRecoverySms(
  config: MctbFirstTextTemplateConfig,
  businessName: string,
  inBusinessHours: boolean,
): string {
  return renderMctbFirstTextTemplateBody({
    config,
    businessName,
    inBusinessHours,
  });
}

export function previewReplyConfirmationSms(
  config: MctbFirstTextTemplateConfig,
  businessName: string,
  inBusinessHours: boolean,
  sampleCallerName?: string | null,
): string {
  const vars = config.variables || {};
  const callbackVar = inBusinessHours
    ? vars.callbackTime
    : vars.callbackTimeAfterHours ?? vars.callbackTime;
  const callbackPhrase = resolveCallbackTimePhrase(callbackVar) || "as soon as possible";
  return renderMctbDeterministicFirstReplyAck({
    businessName,
    callbackTimePhrase: callbackPhrase,
    callerFirstName: sampleCallerName ?? "Mike",
    inBusinessHours,
  });
}

export function previewReplyConfirmationSmsAnonymous(
  config: MctbFirstTextTemplateConfig,
  businessName: string,
  inBusinessHours: boolean,
): string {
  const vars = config.variables || {};
  const callbackVar = inBusinessHours
    ? vars.callbackTime
    : vars.callbackTimeAfterHours ?? vars.callbackTime;
  const callbackPhrase = resolveCallbackTimePhrase(callbackVar) || "as soon as possible";
  return renderMctbDeterministicFirstReplyAck({
    businessName,
    callbackTimePhrase: callbackPhrase,
    callerFirstName: null,
    inBusinessHours,
  });
}

export function callbackPhraseForPreview(
  config: MctbFirstTextTemplateConfig,
  inBusinessHours: boolean,
): string {
  const subs = buildFirstTextSubstitutionMap({
    config,
    businessName: "Preview",
    inBusinessHours,
  });
  return subs.callback_time || subs.callbackTime || "";
}
