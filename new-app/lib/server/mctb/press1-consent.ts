import "server-only";

import { getPrisma } from "@/lib/server/db";
import { gatherUsingSpeak } from "@/lib/server/phone/routing/telnyx-call-control";
import { readPhoneMctbInbound } from "@/lib/server/mctb/phone-line-config";
import { loadMctbConsentMode } from "@/lib/server/mctb/attestation";
import { MCTB_CONSENT_MODE_VERIFIED } from "@/lib/mctb/consent-mode";
import { leaveVoicemailOnCall } from "@/lib/server/phone/voicemail-runtime";
import { schedulePhoneOwnedMctbIfMissed } from "@/lib/server/mctb/pipeline";

const DEFAULT_DISCLOSURE =
  "Sorry we missed your call. To receive a text message from us, press 1. To continue without a text, press 2 or hang up.";

export type MctbPress1State = "pressed" | "declined" | "no_input" | "not_offered";

export function readMctbPress1FromCallMetadata(metadata: unknown): MctbPress1State {
  if (!metadata || typeof metadata !== "object") return "not_offered";
  const raw = (metadata as { mctbPress1?: string }).mctbPress1;
  if (raw === "pressed" || raw === "declined" || raw === "no_input") return raw;
  return "not_offered";
}

async function shouldOfferPress1(input: {
  workspaceId: string;
  phoneNumberId: string | null;
  phoneSettingsJson: unknown;
}): Promise<boolean> {
  const line = readPhoneMctbInbound(input.phoneSettingsJson);
  if (!line.enabled) return false;
  const mode = await loadMctbConsentMode(input.workspaceId);
  return mode === MCTB_CONSENT_MODE_VERIFIED;
}

/**
 * Offer Press-1 consent on the active inbound Call Control leg before voicemail / final miss.
 */
export async function tryOfferMctbPress1BeforeVoicemail(input: {
  workspaceId: string;
  humanCallId: string;
  inboundControlId: string;
  phoneNumberId: string | null;
  routingSessionId?: string;
}): Promise<{ offered: boolean }> {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.phoneNumberId) return { offered: false };
  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: { id: call.phoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });
  if (!phoneNumber) return { offered: false };

  const existing = readMctbPress1FromCallMetadata(call.metadata);
  if (existing !== "not_offered") return { offered: false };

  const ok = await shouldOfferPress1({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId ?? call.phoneNumberId,
    phoneSettingsJson: phoneNumber.settingsJson,
  });
  if (!ok) return { offered: false };

  await gatherUsingSpeak({
    callControlId: input.inboundControlId,
    text: DEFAULT_DISCLOSURE,
    validDigits: "12",
    clientState: {
      kind: "cf_mctb_consent",
      stage: "awaiting_digit",
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      phoneNumberId: input.phoneNumberId ?? call.phoneNumberId,
      routingSessionId: input.routingSessionId || "",
      after: "voicemail",
    },
  });

  await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        ...(typeof call.metadata === "object" && call.metadata ? call.metadata : {}),
        mctbPress1: "no_input",
        mctbPress1OfferedAt: new Date().toISOString(),
      },
    },
  });

  return { offered: true };
}

export async function handleMctbPress1GatherEnded(input: {
  workspaceId: string;
  humanCallId: string;
  inboundControlId: string;
  phoneNumberId: string | null;
  digit: string;
  routingSessionId?: string;
  after?: string;
}): Promise<void> {
  const prisma = getPrisma();
  const digit = input.digit.replace(/\D/g, "").slice(-1);
  const pressState: MctbPress1State =
    digit === "1" ? "pressed" : digit === "2" ? "declined" : "no_input";

  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) return;

  await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        ...(typeof call.metadata === "object" && call.metadata ? call.metadata : {}),
        mctbPress1: pressState,
        mctbPress1CapturedAt: new Date().toISOString(),
      },
    },
  });

  if (pressState === "pressed") {
    schedulePhoneOwnedMctbIfMissed({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
    });
    return;
  }

  if (input.after === "voicemail") {
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      telnyxCallControlId: input.inboundControlId,
      phoneNumberId: input.phoneNumberId ?? call.phoneNumberId,
    });
  }
}
