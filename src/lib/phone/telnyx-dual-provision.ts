/**
 * Dual SMS + Voice provisioning for Telnyx DIDs.
 *
 * On purchase / repair:
 *   inbound voice (Call Control App) + outbound voice (OVP on that app)
 *   + messaging profile infrastructure.
 *
 * A2P brand/campaign approval is tracked separately and does NOT block calling.
 * Business SMS send remains gated by isMessagingReady (A2P approved).
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  getAppBaseUrl,
  getTelnyxApiKey,
  getTelnyxWebhookUrls,
} from "@/lib/messaging/telnyx/config";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady } from "@/lib/messaging/status";
import { resolveVoiceConnectionId } from "@/lib/phone/telnyx-voice-connection";
import type { OutboundVoiceReadiness } from "@/lib/phone/telnyx-outbound-voice";

export type ProvisionState =
  | "purchased"
  | "pending_activation"
  | "messaging_configured"
  | "voice_configured"
  | "fully_configured"
  | "configuration_failed"
  | "capability_unsupported"
  | "needs_compliance";

export type A2pRegistrationStatus =
  | "not_started"
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "action_required";

export type A2pCampaignAssignmentStatus =
  | "not_started"
  | "pending"
  | "assigned"
  | "failed";

export type NumberCapabilities = {
  voice: boolean;
  sms: boolean;
  mms: boolean;
  fax?: boolean;
};

/** Independent channel / regulatory readiness — never conflate A2P with voice. */
export type ChannelReadiness = {
  voiceInboundConfigured: boolean;
  voiceOutboundConfigured: boolean;
  messagingProfileConfigured: boolean;
  a2pRegistrationStatus: A2pRegistrationStatus;
  a2pCampaignAssignmentStatus: A2pCampaignAssignmentStatus;
  /** True only when brand+campaign approved and number can send business SMS. */
  smsSendingEnabled: boolean;
  mmsEnabled: boolean;
  /** Inbound + outbound voice ready (calls/transfers/AI). Independent of A2P. */
  callsReady: boolean;
  /**
   * Infrastructure provisioned for supported channels (voice in/out + messaging
   * profile when SMS-capable). Does NOT mean business SMS is unlocked.
   */
  fullyProvisioned: boolean;
};

export type NumberTelnyxSnapshot = {
  providerNumberId: string;
  e164: string;
  status: string | null;
  phoneNumberType: string | null;
  connectionId: string | null;
  connectionName: string | null;
  messagingProfileId: string | null;
  capabilities: NumberCapabilities;
  countryCode?: string | null;
};

export type NumberDiagnostics = {
  workspaceNumberId: string;
  e164: string;
  providerNumberId: string | null;
  provisionState: ProvisionState;
  capabilities: NumberCapabilities | null;
  messagingProfileId: string | null;
  expectedMessagingProfileId: string | null;
  voiceConnectionId: string | null;
  expectedVoiceConnectionId: string | null;
  voiceWebhookUrl: string;
  messagingWebhookUrl: string;
  callFlow: {
    queueId: string | null;
    ivrMenuId: string | null;
    voiceForwardTo: string | null;
    agentId: string | null;
    agentName: string | null;
  };
  telnyx: NumberTelnyxSnapshot | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  issues: Array<{ code: string; severity: "error" | "warn" | "info"; message: string }>;
  ready: {
    messaging: boolean;
    voice: boolean;
    outbound: boolean;
    /** Infrastructure fully provisioned (not A2P/SMS send). */
    fully: boolean;
    calls: boolean;
    smsSending: boolean;
  };
  channels: ChannelReadiness;
  outbound: OutboundVoiceReadiness | null;
  appBaseUrl: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function readSettings(row: { settingsJson?: unknown }) {
  return asRecord(row.settingsJson) || {};
}

function provisionFromSettings(settings: Record<string, unknown>): {
  state: ProvisionState;
  lastVerifiedAt: string | null;
  lastError: string | null;
} {
  const prov = asRecord(settings.provisioning) || {};
  const state = (String(prov.state || "") as ProvisionState) || "purchased";
  return {
    state: state || "purchased",
    lastVerifiedAt: prov.lastVerifiedAt ? String(prov.lastVerifiedAt) : null,
    lastError: prov.lastError ? String(prov.lastError) : null,
  };
}

async function fetchTelnyxNumber(
  providerNumberId: string,
): Promise<NumberTelnyxSnapshot | null> {
  if (!providerNumberId || providerNumberId.startsWith("ORDER:")) return null;
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const data = asRecord(res.data);
  if (!data) return null;

  const capsRaw = asRecord(data.capabilities) || {};
  // Telnyx may return capabilities as { sms: true, voice: true } or feature lists
  const features = Array.isArray(data.features)
    ? (data.features as Array<{ name?: string }>)
    : [];
  const featureNames = new Set(
    features.map((f) => String(f.name || "").toLowerCase()),
  );

  let voice =
    capsRaw.voice === true ||
    featureNames.has("voice") ||
    capsRaw.VOICE === true;
  // Do not invent SMS capability — only trust Telnyx-reported features.
  let sms =
    capsRaw.sms === true ||
    featureNames.has("sms") ||
    capsRaw.SMS === true;
  const mms =
    capsRaw.mms === true || featureNames.has("mms") || capsRaw.MMS === true;

  // Telnyx often omits `capabilities` on GET /phone_numbers/{id} even when the
  // DID is a normal local voice+SMS number. Infer from type + messaging features.
  const phoneNumberType = data.phone_number_type
    ? String(data.phone_number_type)
    : null;
  if (!voice && !sms) {
    const type = (phoneNumberType || "").toLowerCase();
    if (type === "local" || type === "national" || type === "mobile" || type === "toll_free") {
      try {
        const msgRes = await telnyxRequest<{
          data?: { features?: { sms?: unknown; mms?: unknown } };
        }>(`/phone_numbers/${encodeURIComponent(providerNumberId)}/messaging`, {
          method: "GET",
        });
        const msgFeatures = msgRes?.data?.features;
        if (msgFeatures?.sms) sms = true;
        if (msgFeatures?.mms) {
          // mms implies sms-capable messaging product
          sms = true;
        }
      } catch {
        // ignore — fall through to type heuristic
      }
      // Local/national/mobile DIDs are voice-routable; attach Call Control and let
      // Telnyx reject if truly unsupported.
      if (type === "local" || type === "national" || type === "mobile") {
        voice = true;
      }
      if (type === "toll_free") {
        voice = true;
        sms = true;
      }
    }
  }

  return {
    providerNumberId: String(data.id || providerNumberId),
    e164: String(data.phone_number || ""),
    status: data.status ? String(data.status) : null,
    phoneNumberType,
    connectionId: data.connection_id ? String(data.connection_id) : null,
    connectionName: data.connection_name ? String(data.connection_name) : null,
    messagingProfileId: data.messaging_profile_id
      ? String(data.messaging_profile_id)
      : null,
    capabilities: { voice, sms, mms, fax: capsRaw.fax === true },
    countryCode: data.country_code ? String(data.country_code) : null,
  };
}

async function fetchMessagingAssignment(providerNumberId: string) {
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(providerNumberId)}/messaging`,
    );
    const data = asRecord(res.data);
    return data?.messaging_profile_id
      ? String(data.messaging_profile_id)
      : null;
  } catch {
    return null;
  }
}

async function persistProvisioning(
  phoneNumberId: string,
  patch: {
    state?: ProvisionState;
    lastError?: string | null;
    capabilities?: NumberCapabilities | null;
    telnyxConnectionId?: string | null;
    messagingProfileId?: string | null;
    channels?: ChannelReadiness | null;
  },
) {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  if (!row) return;
  const settings = readSettings(row);
  const prev = asRecord(settings.provisioning) || {};
  const nextProv = {
    ...prev,
    ...(patch.state ? { state: patch.state } : {}),
    lastVerifiedAt: new Date().toISOString(),
    lastError: patch.lastError === undefined ? prev.lastError ?? null : patch.lastError,
    telnyxConnectionId:
      patch.telnyxConnectionId === undefined
        ? prev.telnyxConnectionId
        : patch.telnyxConnectionId,
    messagingProfileId:
      patch.messagingProfileId === undefined
        ? prev.messagingProfileId
        : patch.messagingProfileId,
    ...(patch.channels
      ? {
          voiceInboundConfigured: patch.channels.voiceInboundConfigured,
          voiceOutboundConfigured: patch.channels.voiceOutboundConfigured,
          messagingProfileConfigured: patch.channels.messagingProfileConfigured,
          a2pRegistrationStatus: patch.channels.a2pRegistrationStatus,
          a2pCampaignAssignmentStatus: patch.channels.a2pCampaignAssignmentStatus,
          smsSendingEnabled: patch.channels.smsSendingEnabled,
          mmsEnabled: patch.channels.mmsEnabled,
          callsReady: patch.channels.callsReady,
          fullyProvisioned: patch.channels.fullyProvisioned,
        }
      : {}),
  };
  const caps =
    patch.capabilities ||
    (asRecord(row.capabilitiesJson) as NumberCapabilities | null);

  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      settingsJson: { ...settings, provisioning: nextProv },
      ...(caps
        ? {
            capabilitiesJson: {
              voice: caps.voice,
              sms: caps.sms,
              mms: caps.mms,
              fax: caps.fax ?? false,
              source: "telnyx_dual_provision",
            },
          }
        : {}),
      ...(patch.messagingProfileId
        ? { messagingService: patch.messagingProfileId }
        : {}),
    },
  });
}

function mapA2pRegistrationStatus(reg: {
  brandStatus?: string | null;
  campaignStatus?: string | null;
  overallStatus?: string | null;
  certifiedAt?: Date | string | null;
} | null): A2pRegistrationStatus {
  if (!reg) return "not_started";
  const brand = String(reg.brandStatus || "").toLowerCase();
  const campaign = String(reg.campaignStatus || "").toLowerCase();
  const overall = String(reg.overallStatus || "").toLowerCase();
  if (brand === "rejected" || campaign === "rejected" || overall === "rejected") {
    return "rejected";
  }
  if (brand === "approved" && campaign === "approved") return "approved";
  if (
    ["submitted", "in_review", "pending"].includes(brand) ||
    ["submitted", "in_review", "pending"].includes(campaign) ||
    ["submitted", "in_review", "pending"].includes(overall)
  ) {
    return "in_review";
  }
  if (reg.certifiedAt || brand === "action_required" || campaign === "action_required") {
    return "action_required";
  }
  if (brand === "not_started" && campaign === "not_started") return "not_started";
  return "pending";
}

function mapA2pCampaignAssignmentStatus(reg: {
  campaignId?: string | null;
  a2pCampaignSid?: string | null;
  campaignStatus?: string | null;
  phoneAttached?: boolean | null;
  phoneE164?: string | null;
} | null): A2pCampaignAssignmentStatus {
  if (!reg) return "not_started";
  const campaignId = reg.campaignId || reg.a2pCampaignSid;
  if (!campaignId) return "not_started";
  if (reg.campaignStatus === "approved" && reg.phoneAttached && reg.phoneE164) {
    return "assigned";
  }
  if (["rejected", "failed"].includes(String(reg.campaignStatus || "").toLowerCase())) {
    return "failed";
  }
  return "pending";
}

/** Ensure workspace has a Telnyx messaging profile; return its id. */
export async function ensureWorkspaceMessagingProfileId(
  workspaceId: string,
): Promise<string | null> {
  const reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg) return null;
  const existing =
    reg.messagingProfileId ||
    (reg.messagingServiceSid &&
    reg.messagingProvider === "telnyx" &&
    !String(reg.messagingServiceSid).startsWith("MG")
      ? reg.messagingServiceSid
      : null);
  if (existing) return existing;

  if (!getTelnyxApiKey()) return null;
  const provider = getMessagingProvider();
  if (provider.name !== "telnyx") return null;
  const profile = await provider.createMessagingProfile(reg);
  await getPrisma().messagingRegistration.update({
    where: { workspaceId },
    data: {
      messagingProfileId: profile.id,
      messagingServiceSid: profile.id,
      messagingServiceStatus: "approved",
      messagingProvider: "telnyx",
    },
  });
  return profile.id;
}

/**
 * Values to include on Telnyx POST /number_orders for dual provisioning.
 * Also ensures the Voice API Application has an Outbound Voice Profile before
 * the number is purchased (OVP attaches to the app, not each DID).
 */
export async function resolveOrderProvisionIds(workspaceId: string): Promise<{
  connectionId: string | null;
  messagingProfileId: string | null;
  outboundReady: boolean;
  outboundVoiceProfileId: string | null;
}> {
  let connectionId: string | null = null;
  let messagingProfileId: string | null = null;
  let outboundReady = false;
  let outboundVoiceProfileId: string | null = null;
  if (getTelnyxApiKey()) {
    try {
      connectionId = await resolveVoiceConnectionId();
      const { ensureTelnyxOutboundVoiceReady } = await import(
        "@/lib/phone/telnyx-outbound-voice"
      );
      const outbound = await ensureTelnyxOutboundVoiceReady({ connectionId });
      outboundReady = outbound.ready;
      outboundVoiceProfileId = outbound.outboundVoiceProfileId;
      if (outbound.connectionId) connectionId = outbound.connectionId;
    } catch (err) {
      console.error("[dual-provision] voice connection / outbound", err);
    }
    try {
      messagingProfileId = await ensureWorkspaceMessagingProfileId(workspaceId);
    } catch (err) {
      console.error("[dual-provision] messaging profile", err);
    }
  }
  return {
    connectionId,
    messagingProfileId,
    outboundReady,
    outboundVoiceProfileId,
  };
}

/** Assign voice connection without clearing messaging_profile_id. */
export async function assignVoiceConnection(
  providerNumberId: string,
  connectionId: string,
) {
  // Base PATCH sets connection_id and does not touch messaging profile.
  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });
}

/** Assign messaging profile via messaging sub-resource (does not clear connection). */
export async function assignMessagingProfile(
  providerNumberId: string,
  messagingProfileId: string,
) {
  await telnyxRequest(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}/messaging`,
    {
      method: "PATCH",
      body: { messaging_profile_id: messagingProfileId },
    },
  );
}

export async function enableVoiceOnWorkspaceNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Number not found in workspace");
  if (!row.providerNumberId || row.providerNumberId.startsWith("ORDER:")) {
    throw new Error("Telnyx phone number id not ready yet — wait for order activation");
  }

  const before = await fetchTelnyxNumber(row.providerNumberId);
  if (!before) throw new Error("Could not load number from Telnyx");

  if (!before.capabilities.voice && before.capabilities.sms === false) {
    await persistProvisioning(row.id, {
      state: "capability_unsupported",
      lastError: "Number does not report voice capability",
      capabilities: before.capabilities,
    });
    throw new Error(
      "This number does not support voice. Buy a voice-capable number instead.",
    );
  }

  // Preserve any existing messaging profile before voice attach.
  const existingProfile =
    before.messagingProfileId ||
    (await fetchMessagingAssignment(row.providerNumberId));

  const connectionId = await resolveVoiceConnectionId();
  const { workspaceNumberUsesTexmlDirect } = await import(
    "@/lib/voice/telnyx/texml-direct-route"
  );
  const texmlDirect = await workspaceNumberUsesTexmlDirect({
    workspaceId: input.workspaceId,
    phoneNumberId: row.id,
  });
  if (!texmlDirect) {
    await assignVoiceConnection(row.providerNumberId, connectionId);
  }

  try {
    const { ensureTelnyxOutboundVoiceReady } = await import(
      "@/lib/phone/telnyx-outbound-voice"
    );
    await ensureTelnyxOutboundVoiceReady({
      connectionId,
      callerIdE164: row.e164,
    });
  } catch (err) {
    console.error("[dual-provision] outbound voice ensure", err);
  }

  // Messaging: keep existing, or create workspace profile (best-effort).
  let profileId = existingProfile;
  try {
    if (!profileId) {
      profileId = await ensureWorkspaceMessagingProfileId(input.workspaceId);
    }
  } catch (err) {
    console.error("[dual-provision] ensure messaging profile", err);
  }

  const after = await fetchTelnyxNumber(row.providerNumberId);
  const afterMsg =
    after?.messagingProfileId ||
    (await fetchMessagingAssignment(row.providerNumberId));
  if (profileId && afterMsg !== profileId) {
    try {
      await assignMessagingProfile(row.providerNumberId, profileId);
    } catch (err) {
      console.error("[dual-provision] restore messaging profile", err);
    }
  }

  await persistProvisioning(row.id, {
    state: "voice_configured",
    lastError: null,
    capabilities: after?.capabilities || before.capabilities,
    telnyxConnectionId: connectionId,
    messagingProfileId: profileId || afterMsg,
  });

  return verifyAndPersistNumber({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });
}

export async function repairMessagingOnWorkspaceNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!row?.providerNumberId || row.providerNumberId.startsWith("ORDER:")) {
    throw new Error("Telnyx phone number id not ready");
  }
  const profileId = await ensureWorkspaceMessagingProfileId(input.workspaceId);
  if (!profileId) throw new Error("Could not resolve workspace messaging profile");

  // Capture connection before messaging PATCH (should be preserved by Telnyx).
  const before = await fetchTelnyxNumber(row.providerNumberId);
  await assignMessagingProfile(row.providerNumberId, profileId);
  if (before?.connectionId) {
    const after = await fetchTelnyxNumber(row.providerNumberId);
    if (after && after.connectionId !== before.connectionId) {
      await assignVoiceConnection(row.providerNumberId, before.connectionId);
    }
  }

  await persistProvisioning(row.id, {
    state: "messaging_configured",
    lastError: null,
    messagingProfileId: profileId,
  });

  return diagnoseWorkspaceNumber(input);
}

export async function verifyAndPersistNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  const diag = await diagnoseWorkspaceNumber(input);
  let state: ProvisionState = "purchased";
  if (!diag.telnyx) state = "pending_activation";
  else if (diag.channels.fullyProvisioned) state = "fully_configured";
  else if (diag.channels.callsReady && !diag.channels.messagingProfileConfigured) {
    state = "voice_configured";
  } else if (
    diag.channels.messagingProfileConfigured &&
    !diag.channels.callsReady
  ) {
    state = "messaging_configured";
  } else if (diag.issues.some((i) => i.code === "capability_unsupported")) {
    state = "capability_unsupported";
  } else if (diag.issues.some((i) => i.severity === "error")) {
    state = "configuration_failed";
  } else if (diag.channels.callsReady || diag.channels.messagingProfileConfigured) {
    state = diag.channels.callsReady ? "voice_configured" : "messaging_configured";
  }

  await persistProvisioning(input.phoneNumberId, {
    state,
    lastError: diag.issues.find((i) => i.severity === "error")?.message || null,
    capabilities: diag.capabilities,
    telnyxConnectionId: diag.voiceConnectionId,
    messagingProfileId: diag.messagingProfileId,
    channels: diag.channels,
  });

  return { ...diag, provisionState: state };
}

/**
 * Idempotent full provision / repair after purchase (or on demand).
 *
 * 1. Confirm capabilities
 * 2. Assign Voice API Application (inbound)
 * 3. Ensure Outbound Voice Profile on that application
 * 4. Assign Messaging Profile (preserve existing profile when already set)
 * 5. Re-fetch live Telnyx state and persist channel readiness
 *
 * Does not wait for A2P and does not enable business SMS.
 */
export async function provisionPurchasedNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  return repairNumberConfiguration(input);
}

/** Explicit repair alias used by the UI / API. */
export async function repairNumberConfiguration(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Number not found");
  if (!row.providerNumberId || row.providerNumberId.startsWith("ORDER:")) {
    await persistProvisioning(row.id, { state: "pending_activation" });
    return diagnoseWorkspaceNumber(input);
  }

  const before = await fetchTelnyxNumber(row.providerNumberId);
  if (!before) {
    await persistProvisioning(row.id, {
      state: "configuration_failed",
      lastError: "Could not load number from Telnyx",
    });
    return diagnoseWorkspaceNumber(input);
  }

  if (!before.capabilities.voice && !before.capabilities.sms) {
    await persistProvisioning(row.id, {
      state: "capability_unsupported",
      lastError: "Number reports neither voice nor SMS capability",
      capabilities: before.capabilities,
    });
    return diagnoseWorkspaceNumber(input);
  }

  // Preserve existing messaging profile before voice attach.
  const existingProfile =
    before.messagingProfileId ||
    (await fetchMessagingAssignment(row.providerNumberId));

  let connectionId: string | null = null;
  if (before.capabilities.voice !== false) {
    try {
      const { workspaceNumberUsesTexmlDirect } = await import(
        "@/lib/voice/telnyx/texml-direct-route"
      );
      const texmlDirect = await workspaceNumberUsesTexmlDirect({
        workspaceId: input.workspaceId,
        phoneNumberId: row.id,
      });
      if (texmlDirect) {
        // Keep existing TeXML app attachment — do not force Call Control.
        connectionId = before.connectionId;
      } else {
        connectionId = await resolveVoiceConnectionId();
        if (connectionId && before.connectionId !== connectionId) {
          await assignVoiceConnection(row.providerNumberId, connectionId);
        }
        const { ensureTelnyxOutboundVoiceReady } = await import(
          "@/lib/phone/telnyx-outbound-voice"
        );
        await ensureTelnyxOutboundVoiceReady({
          connectionId,
          callerIdE164: row.e164,
        });
      }
    } catch (err) {
      console.error("[dual-provision] voice/outbound repair", err);
    }
  }

  // Messaging profile — prefer workspace profile; never clear an existing one
  // if workspace profile create fails (keeps campaign assignment possible).
  let profileId: string | null = existingProfile;
  try {
    const workspaceProfile = await ensureWorkspaceMessagingProfileId(
      input.workspaceId,
    );
    if (workspaceProfile) {
      profileId = workspaceProfile;
      const liveMsg =
        (await fetchMessagingAssignment(row.providerNumberId)) ||
        (await fetchTelnyxNumber(row.providerNumberId))?.messagingProfileId ||
        null;
      if (liveMsg !== workspaceProfile) {
        await assignMessagingProfile(row.providerNumberId, workspaceProfile);
      }
    }
  } catch (err) {
    console.error("[dual-provision] messaging attach", err);
  }

  // If voice attach cleared messaging, restore.
  if (profileId) {
    const afterVoice = await fetchTelnyxNumber(row.providerNumberId);
    const afterMsg =
      afterVoice?.messagingProfileId ||
      (await fetchMessagingAssignment(row.providerNumberId));
    if (afterMsg !== profileId) {
      try {
        await assignMessagingProfile(row.providerNumberId, profileId);
      } catch (err) {
        console.error("[dual-provision] restore messaging profile", err);
      }
    }
  }

  // Keep registration phoneAttached in sync when this DID is the reg number.
  // Do not set overallStatus/messagingEnabled — A2P gates sending separately.
  const reg = await getRegistrationByWorkspace(input.workspaceId);
  if (reg?.phoneE164 === row.e164 && profileId) {
    await prisma.messagingRegistration.updateMany({
      where: { workspaceId: input.workspaceId },
      data: {
        phoneAttached: true,
        phoneNumberId: row.providerNumberId,
        phoneSid: row.providerNumberId,
        messagingProfileId: profileId,
      },
    });
  }

  return verifyAndPersistNumber(input);
}

export async function diagnoseWorkspaceNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  const prisma = getPrisma();
  const urls = getTelnyxWebhookUrls();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Number not found");

  const settings = readSettings(row);
  const prov = provisionFromSettings(settings);
  const reg = await getRegistrationByWorkspace(input.workspaceId);
  const expectedMessaging =
    reg?.messagingProfileId ||
    (reg?.messagingProvider === "telnyx" ? reg.messagingServiceSid : null) ||
    null;

  let expectedVoice: string | null = null;
  try {
    if (getTelnyxApiKey()) expectedVoice = await resolveVoiceConnectionId();
  } catch {
    expectedVoice = process.env.TELNYX_CONNECTION_ID?.trim() || null;
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { workspaceId: input.workspaceId, phoneNumberId: row.id },
    select: { id: true, name: true },
  });

  const issues: NumberDiagnostics["issues"] = [];
  let telnyx: NumberTelnyxSnapshot | null = null;
  let messagingProfileId: string | null = null;

  if (row.providerNumberId && getTelnyxApiKey()) {
    try {
      telnyx = await fetchTelnyxNumber(row.providerNumberId);
      messagingProfileId =
        telnyx?.messagingProfileId ||
        (await fetchMessagingAssignment(row.providerNumberId));
      if (telnyx && !telnyx.messagingProfileId && messagingProfileId) {
        telnyx = { ...telnyx, messagingProfileId };
      }
    } catch (err) {
      issues.push({
        code: "telnyx_fetch_failed",
        severity: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (!row.providerNumberId) {
    issues.push({
      code: "missing_provider_id",
      severity: "error",
      message: "No Telnyx phone number id stored",
    });
  }

  const voiceOk = await (async () => {
    if (
      telnyx?.connectionId &&
      expectedVoice &&
      telnyx.connectionId === expectedVoice
    ) {
      return true;
    }
    if (telnyx?.connectionId && row.providerNumberId) {
      const { isPlatform571E164, verify571MctbConsentTexmlRoute } = await import(
        "@/lib/mctb/consent-prompt/telnyx-texml-route"
      );
      if (isPlatform571E164(row.e164)) {
        const texml = await verify571MctbConsentTexmlRoute(row.providerNumberId);
        return texml.ok;
      }
    }
    return false;
  })();
  const messagingOk = Boolean(
    messagingProfileId &&
      expectedMessaging &&
      messagingProfileId === expectedMessaging,
  );

  if (telnyx && !telnyx.connectionId) {
    issues.push({
      code: "voice_not_assigned",
      severity: "error",
      message: "Number has no Voice Connection / Call Control Application",
    });
  } else if (telnyx && expectedVoice && telnyx.connectionId !== expectedVoice) {
    const { isPlatform571E164, verify571MctbConsentTexmlRoute } = await import(
      "@/lib/mctb/consent-prompt/telnyx-texml-route"
    );
    const onMctbTexml =
      isPlatform571E164(row.e164) &&
      row.providerNumberId &&
      (await verify571MctbConsentTexmlRoute(row.providerNumberId)).ok;
    if (!onMctbTexml) {
      issues.push({
        code: "voice_wrong_connection",
        severity: "warn",
        message: `Voice connection is ${telnyx.connectionId}, expected ${expectedVoice}`,
      });
    }
  }

  if (!messagingProfileId) {
    issues.push({
      code: "messaging_not_assigned",
      severity: "warn",
      message: "Number has no Messaging Profile (SMS/MMS not configured)",
    });
  } else if (expectedMessaging && messagingProfileId !== expectedMessaging) {
    issues.push({
      code: "messaging_profile_mismatch",
      severity: "warn",
      message: `Messaging profile is ${messagingProfileId}, workspace expects ${expectedMessaging}`,
    });
  }

  if (telnyx && telnyx.capabilities.voice === false) {
    issues.push({
      code: "capability_unsupported",
      severity: "error",
      message: "Telnyx reports this number is not voice-capable",
    });
  }

  let outbound: OutboundVoiceReadiness | null = null;
  if (getTelnyxApiKey()) {
    try {
      const { diagnoseTelnyxOutboundVoice } = await import(
        "@/lib/phone/telnyx-outbound-voice"
      );
      outbound = await diagnoseTelnyxOutboundVoice({
        connectionId: telnyx?.connectionId || expectedVoice,
        callerIdE164: row.e164,
      });
      for (const issue of outbound.issues) {
        issues.push({
          code: `outbound_${issue.code}`,
          severity: issue.severity,
          message: issue.message,
        });
      }
    } catch (err) {
      issues.push({
        code: "outbound_diagnose_failed",
        severity: "warn",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const capabilities =
    telnyx?.capabilities ||
    (asRecord(row.capabilitiesJson) as NumberCapabilities | null);

  const messagingProfileConfigured =
    messagingOk || Boolean(messagingProfileId);
  const outboundReady = Boolean(outbound?.ready);
  const smsCapable = Boolean(capabilities?.sms);
  const mmsCapable = Boolean(capabilities?.mms);
  const a2pRegistrationStatus = mapA2pRegistrationStatus(reg);
  const a2pCampaignAssignmentStatus = mapA2pCampaignAssignmentStatus(
    reg
      ? {
          campaignId: (reg as { campaignId?: string | null }).campaignId,
          a2pCampaignSid: reg.a2pCampaignSid,
          campaignStatus: reg.campaignStatus,
          phoneAttached: reg.phoneAttached,
          phoneE164: reg.phoneE164,
        }
      : null,
  );
  const smsSendingEnabled = isMessagingReady(reg);
  // Workspace UI may also store mmsEnabled; capability wins when false.
  const mmsEnabled =
    mmsCapable &&
    (settings.mmsEnabled === undefined ? true : Boolean(settings.mmsEnabled));

  const channels: ChannelReadiness = {
    voiceInboundConfigured: voiceOk,
    voiceOutboundConfigured: outboundReady,
    messagingProfileConfigured,
    a2pRegistrationStatus,
    a2pCampaignAssignmentStatus,
    smsSendingEnabled,
    mmsEnabled,
    callsReady: voiceOk && outboundReady,
    // Infrastructure complete for supported channels — NOT business SMS unlock.
    fullyProvisioned:
      voiceOk &&
      outboundReady &&
      (!smsCapable || messagingProfileConfigured),
  };

  if (
    messagingProfileConfigured &&
    !smsSendingEnabled &&
    smsCapable
  ) {
    issues.push({
      code: "a2p_pending_sms_locked",
      severity: "info",
      message:
        "Messaging Profile is configured, but business SMS sending stays locked until A2P brand/campaign approval.",
    });
  }

  return {
    workspaceNumberId: row.id,
    e164: row.e164,
    providerNumberId: row.providerNumberId,
    provisionState: prov.state,
    capabilities,
    messagingProfileId,
    expectedMessagingProfileId: expectedMessaging,
    voiceConnectionId: telnyx?.connectionId || null,
    expectedVoiceConnectionId: expectedVoice,
    voiceWebhookUrl: urls.voice,
    messagingWebhookUrl: urls.messaging,
    callFlow: {
      queueId: settings.queueId ? String(settings.queueId) : null,
      ivrMenuId: settings.ivrMenuId ? String(settings.ivrMenuId) : null,
      voiceForwardTo: row.voiceForwardTo,
      agentId: agent?.id || null,
      agentName: agent?.name || null,
    },
    telnyx,
    lastVerifiedAt: prov.lastVerifiedAt,
    lastError: prov.lastError,
    issues,
    ready: {
      messaging: messagingProfileConfigured,
      voice: voiceOk,
      outbound: outboundReady,
      fully: channels.fullyProvisioned,
      calls: channels.callsReady,
      smsSending: smsSendingEnabled,
    },
    channels,
    outbound,
    appBaseUrl: getAppBaseUrl(),
  };
}

/** Startup / readiness check for dual provisioning env. */
export function getDualProvisionEnvStatus() {
  return {
    apiKey: Boolean(getTelnyxApiKey()),
    connectionIdEnv: Boolean(process.env.TELNYX_CONNECTION_ID?.trim()),
    telephonyCredentialId: Boolean(
      process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim(),
    ),
    appUrl: Boolean(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL),
    voiceWebhook: getTelnyxWebhookUrls().voice,
    messagingWebhook: getTelnyxWebhookUrls().messaging,
  };
}
