import "server-only";

import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import {
  inMctbBusinessWindow,
  resolveMctbMessageTemplate,
  renderMctbMessageTemplate,
} from "@/lib/mctb/message-template";
import { resolveMctbFirstTextBusinessName } from "./business-name";
import { readMctbFirstTextTemplateConfig } from "./persistence";
import {
  assertMctbFirstTextSafeForSend,
  buildFirstTextSubstitutionMap,
  renderMctbFirstTextTemplateBody,
  validateMctbFirstTextTemplateConfig,
} from "./render";
import { MCTB_FIRST_TEXT_TEMPLATE_VERSION } from "./types";

export type MctbRecoveryOpenerSendMeta = {
  firstTextTemplateId: string;
  firstTextTemplateVersion: number;
  recoveryBusinessName: string;
  recoveryCallbackTimePhrase: string;
  recoveryInBusinessHours: boolean;
};

export async function resolveMctbRecoveryOpenerForSend(input: {
  workspaceId: string;
  config: MissedCallTextConfigRecord & { firstTextTemplate?: import("./types").MctbFirstTextTemplateConfig };
  templateVars: Record<string, string>;
  now?: Date;
}): Promise<{ body: string; meta: MctbRecoveryOpenerSendMeta | null }> {
  const now = input.now ?? new Date();
  const useFirstText =
    input.config.senderMode === "PLATFORM" || Boolean(input.config.firstTextTemplate);

  if (!useFirstText) {
    const template = resolveMctbMessageTemplate(input.config, now);
    const body = renderMctbMessageTemplate(template, input.templateVars);
    return { body, meta: null };
  }

  const firstText =
    input.config.firstTextTemplate ?? (await readMctbFirstTextTemplateConfig(input.workspaceId));
  const businessName =
    input.templateVars.business_name?.trim() ||
    input.templateVars.businessName?.trim() ||
    (await resolveMctbFirstTextBusinessName(input.workspaceId));

  const inHours = inMctbBusinessWindow(input.config, now);
  const validation = validateMctbFirstTextTemplateConfig(firstText, businessName, inHours);
  if (!validation.ok) {
    throw new Error(`mctb_first_text_invalid:${validation.field}`);
  }

  const body = renderMctbFirstTextTemplateBody({
    config: firstText,
    businessName,
    inBusinessHours: inHours,
  });
  assertMctbFirstTextSafeForSend(body);

  const substitutions = buildFirstTextSubstitutionMap({
    config: firstText,
    businessName,
    inBusinessHours: inHours,
  });

  return {
    body,
    meta: {
      firstTextTemplateId: firstText.templateId,
      firstTextTemplateVersion: firstText.version || MCTB_FIRST_TEXT_TEMPLATE_VERSION,
      recoveryBusinessName: businessName,
      recoveryCallbackTimePhrase: substitutions.callback_time || substitutions.callbackTime || "",
      recoveryInBusinessHours: inHours,
    },
  };
}
