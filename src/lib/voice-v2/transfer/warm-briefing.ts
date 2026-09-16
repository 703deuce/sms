import type { VoiceV2CallContext } from "../intake/types";
import { intakeFieldValue } from "../deterministic-rules";

export function buildWarmTransferBriefing(ctx: VoiceV2CallContext, destinationLabel: string): string {
  const name = intakeFieldValue(ctx, "name") || "the caller";
  const reason =
    intakeFieldValue(ctx, "service_reason") ||
    intakeFieldValue(ctx, "reason") ||
    "their request";
  const zip = intakeFieldValue(ctx, "zip_code") || intakeFieldValue(ctx, "zip");
  const urgency = ctx.afterHours?.urgency?.status;
  const urgencyBit =
    urgency === "URGENT" || urgency === "CRITICAL" ? ` Urgency: ${urgency}.` : "";
  const zipBit = zip ? ` ZIP ${zip}.` : "";
  return `This is Amy with the business line. I have ${name} on the line about ${reason}.${zipBit}${urgencyBit} Press 1 to accept this call for ${destinationLabel}.`;
}
