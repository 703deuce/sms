import { getPrisma } from "@/lib/server/db";
import { isPhoneFoundationIngress } from "@/lib/server/telephony/integrated-phone-ingress";
import { readTelephonyProvision } from "@/lib/server/telephony/telephony-record";
import type { ForwardingDestinationRef, ResolvedForwardingDialTarget } from "./destination-types";
import {
  normalizeExternalDestinationE164,
  rejectDirectE164Loop,
  rejectDirectWorkspaceLoop,
} from "./destination-validation";

const UNSUPPORTED_ROUTING_MODES = new Set(["livekit_sip", "mctb_texml"]);

export type ForwardingDestinationRow = {
  id: string;
  workspaceId: string;
  name: string;
  destinationKind: string;
  phoneE164: string | null;
  workspacePhoneNumberId: string | null;
  enabled: boolean;
  press1Required: boolean;
  screeningEnabled: boolean;
  privateAnnouncement: string | null;
  ringTimeoutSec: number;
};

export function displayE164ForDestination(row: ForwardingDestinationRow): string {
  if (row.destinationKind === "workspace_number" && row.phoneE164) return row.phoneE164;
  return row.phoneE164 || "";
}

export async function assertWorkspacePhoneForwardable(
  workspaceId: string,
  phoneNumberId: string,
  inboundPhoneNumberId?: string,
) {
  rejectDirectWorkspaceLoop(inboundPhoneNumberId, phoneNumberId);
  const phone = await getPrisma().phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId, status: "Active" },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone) throw new Error("Transovo number not found in this workspace");
  if (isPhoneFoundationIngress(phone.settingsJson)) return phone;
  const telephony = readTelephonyProvision(phone.settingsJson);
  const mode = telephony.routingMode || "telnyx_call_control";
  if (UNSUPPORTED_ROUTING_MODES.has(mode)) {
    throw new Error(
      "This number uses a dedicated AI or MCTB voice path and cannot be selected as a PSTN forward destination",
    );
  }
  return phone;
}

export async function resolveForwardingDestinationRow(
  row: ForwardingDestinationRow,
  ctx: { inboundPhoneNumberId?: string | null; inboundE164?: string | null },
): Promise<ResolvedForwardingDialTarget> {
  if (!row.enabled) throw new Error("Forwarding destination is disabled");

  if (row.destinationKind === "workspace_number" && row.workspacePhoneNumberId) {
    const phone = await assertWorkspacePhoneForwardable(
      row.workspaceId,
      row.workspacePhoneNumberId,
      ctx.inboundPhoneNumberId || undefined,
    );
    rejectDirectE164Loop(ctx.inboundE164 || undefined, phone.e164);
    return {
      dialE164: phone.e164,
      destinationKind: "workspace_number",
      workspacePhoneNumberId: phone.id,
      press1: row.press1Required || row.screeningEnabled,
      screeningText: row.privateAnnouncement,
      ringTimeoutSec: row.ringTimeoutSec,
    };
  }

  const e164 = row.phoneE164 ? normalizeExternalDestinationE164(row.phoneE164) : "";
  if (!e164) throw new Error("Forwarding destination has no phone number");
  rejectDirectE164Loop(ctx.inboundE164 || undefined, e164);
  return {
    dialE164: e164,
    destinationKind: "external_phone",
    press1: row.press1Required || row.screeningEnabled,
    screeningText: row.privateAnnouncement,
    ringTimeoutSec: row.ringTimeoutSec,
  };
}

export async function resolveForwardingDestinationById(
  workspaceId: string,
  destinationId: string,
  ctx: { inboundPhoneNumberId?: string | null; inboundE164?: string | null },
): Promise<ResolvedForwardingDialTarget | null> {
  const row = await getPrisma().forwardingDestination.findFirst({
    where: { id: destinationId, workspaceId },
  });
  if (!row) return null;
  return resolveForwardingDestinationRow(row, ctx);
}

export async function resolveForwardingDestinationRef(
  workspaceId: string,
  ref: ForwardingDestinationRef,
  ctx: { inboundPhoneNumberId?: string | null; inboundE164?: string | null },
): Promise<ResolvedForwardingDialTarget> {
  if (ref.kind === "external_phone") {
    const e164 = normalizeExternalDestinationE164(ref.e164PhoneNumber);
    rejectDirectE164Loop(ctx.inboundE164 || undefined, e164);
    return {
      dialE164: e164,
      destinationKind: "external_phone",
      press1: true,
      screeningText: null,
      ringTimeoutSec: 25,
    };
  }
  const phone = await assertWorkspacePhoneForwardable(
    workspaceId,
    ref.phoneNumberId,
    ctx.inboundPhoneNumberId || undefined,
  );
  rejectDirectE164Loop(ctx.inboundE164 || undefined, phone.e164);
  return {
    dialE164: phone.e164,
    destinationKind: "workspace_number",
    workspacePhoneNumberId: phone.id,
    press1: true,
    screeningText: null,
    ringTimeoutSec: 25,
  };
}

/** Reject cross-workspace workspace number selection at persistence time. */
export async function loadWorkspacePhoneForDestination(
  workspaceId: string,
  phoneNumberId: string,
) {
  const phone = await getPrisma().phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId, status: "Active" },
    select: { id: true, e164: true, friendlyName: true, settingsJson: true },
  });
  if (!phone) throw new Error("Transovo number not found in this workspace");
  await assertWorkspacePhoneForwardable(workspaceId, phone.id);
  return phone;
}

export async function inboundCallContext(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
) {
  if (!phoneNumberId) return { inboundPhoneNumberId: null as string | null, inboundE164: null as string | null };
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { id: true, e164: true },
  });
  return {
    inboundPhoneNumberId: row?.id ?? null,
    inboundE164: row?.e164 ?? null,
  };
}

/** Resolve IVR / inline action config to a dial target. */
export async function resolveForwardActionConfig(
  workspaceId: string,
  config: Record<string, unknown>,
  ctx: { inboundPhoneNumberId?: string | null; inboundE164?: string | null },
): Promise<ResolvedForwardingDialTarget | null> {
  const destinationId = String(config.destinationId || "").trim();
  if (destinationId) {
    return resolveForwardingDestinationById(workspaceId, destinationId, ctx);
  }

  const refKind = String(config.destinationRefKind || "");
  if (refKind === "workspace_number" && config.destinationRefPhoneNumberId) {
    return resolveForwardingDestinationRef(
      workspaceId,
      {
        kind: "workspace_number",
        phoneNumberId: String(config.destinationRefPhoneNumberId),
      },
      ctx,
    );
  }
  if (refKind === "external_phone" && config.destinationRefE164) {
    return resolveForwardingDestinationRef(
      workspaceId,
      { kind: "external_phone", e164PhoneNumber: String(config.destinationRefE164) },
      ctx,
    );
  }

  const raw = String(config.destinationE164 || config.phoneE164 || "").trim();
  if (!raw) return null;
  return resolveForwardingDestinationRef(
    workspaceId,
    { kind: "external_phone", e164PhoneNumber: raw },
    ctx,
  );
}
