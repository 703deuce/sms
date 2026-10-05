import "server-only";

import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import { inMctbBusinessWindow } from "@/lib/mctb/message-template";
import { resolveMctbFirstTextBusinessName } from "./business-name";
import {
  guessCallerFirstNameFromReply,
  readRecoveryContextFromMissedCallMetadata,
  renderMctbDeterministicFirstReplyAck,
} from "./deterministic-first-reply-ack";
import { readMctbFirstTextTemplateConfig } from "./persistence";
import { buildFirstTextSubstitutionMap } from "./render";

export async function buildDeterministicFirstReplyAckBody(input: {
  workspaceId: string;
  config: MissedCallTextConfigRecord & {
    firstTextTemplate?: import("./types").MctbFirstTextTemplateConfig;
  };
  missedCallMetadata: unknown;
  customerReplyBody: string;
  now?: Date;
}): Promise<string> {
  const fromMeta = readRecoveryContextFromMissedCallMetadata(input.missedCallMetadata);
  const now = input.now ?? new Date();

  let businessName = fromMeta.businessName?.trim() || "";
  let callbackPhrase = fromMeta.callbackTimePhrase?.trim() || "";
  let inBusinessHours = fromMeta.inBusinessHours;

  if (!businessName || !callbackPhrase || inBusinessHours === null) {
    const firstText =
      input.config.firstTextTemplate ??
      (await readMctbFirstTextTemplateConfig(input.workspaceId));
    if (!businessName) {
      businessName = await resolveMctbFirstTextBusinessName(input.workspaceId);
    }
    if (inBusinessHours === null) {
      inBusinessHours = inMctbBusinessWindow(input.config, now);
    }
    const subs = buildFirstTextSubstitutionMap({
      config: firstText,
      businessName,
      inBusinessHours,
    });
    if (!callbackPhrase) {
      callbackPhrase = subs.callback_time || subs.callbackTime || "as soon as possible";
    }
  }

  const callerFirstName = guessCallerFirstNameFromReply(input.customerReplyBody);
  return renderMctbDeterministicFirstReplyAck({
    businessName,
    callbackTimePhrase: callbackPhrase,
    callerFirstName,
    inBusinessHours: inBusinessHours ?? true,
  });
}

export function deterministicReplyAckAlreadySent(
  capturedFieldsJson: Record<string, unknown> | null | undefined,
): boolean {
  if (!capturedFieldsJson) return false;
  return Boolean(capturedFieldsJson._deterministic_reply_ack_sent_at);
}
