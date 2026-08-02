/**
 * Dual SMS + Voice provisioning for Telnyx DIDs.
 *
 * Phone number → Call Control Application (voice webhook) + Messaging Profile
 * Call-flow / AI / softphone routing stays inside Transovo after attach.
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
import { resolveVoiceConnectionId } from "@/lib/phone/telnyx-voice-connection";

export type ProvisionState =
  | "purchased"
  | "pending_activation"
  | "messaging_configured"
  | "voice_configured"
  | "fully_configured"
  | "configuration_failed"
  | "capability_unsupported"
  | "needs_compliance";

export type NumberCapabilities = {
  voice: boolean;
  sms: boolean;
  mms: boolean;
  fax?: boolean;
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
  ready: { messaging: boolean; voice: boolean; fully: boolean };
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

  const voice =
    capsRaw.voice === true ||
    featureNames.has("voice") ||
    Boolean(data.connection_id);
  const sms =
    capsRaw.sms === true ||
    featureNames.has("sms") ||
    capsRaw.SMS === true ||
    true; // most Telnyx DIDs support SMS; verify via messaging endpoint if needed
  const mms = capsRaw.mms === true || featureNames.has("mms") || capsRaw.MMS === true;

  return {
    providerNumberId: String(data.id || providerNumberId),
    e164: String(data.phone_number || ""),
    status: data.status ? String(data.status) : null,
    phoneNumberType: data.phone_number_type
      ? String(data.phone_number_type)
      : null,
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
 */
export async function resolveOrderProvisionIds(workspaceId: string): Promise<{
  connectionId: string | null;
  messagingProfileId: string | null;
}> {
  let connectionId: string | null = null;
  let messagingProfileId: string | null = null;
  if (getTelnyxApiKey()) {
    try {
      connectionId = await resolveVoiceConnectionId();
    } catch (err) {
      console.error("[dual-provision] voice connection", err);
    }
    try {
      messagingProfileId = await ensureWorkspaceMessagingProfileId(workspaceId);
    } catch (err) {
      console.error("[dual-provision] messaging profile", err);
    }
  }
  return { connectionId, messagingProfileId };
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

  // Preserve existing messaging profile (from Telnyx or workspace).
  const existingProfile =
    before.messagingProfileId ||
    (await fetchMessagingAssignment(row.providerNumberId)) ||
    (await ensureWorkspaceMessagingProfileId(input.workspaceId));

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

  const connectionId = await resolveVoiceConnectionId();
  await assignVoiceConnection(row.providerNumberId, connectionId);

  // Re-apply messaging profile if Telnyx dropped it (should not, but be safe).
  const after = await fetchTelnyxNumber(row.providerNumberId);
  const afterMsg =
    after?.messagingProfileId ||
    (await fetchMessagingAssignment(row.providerNumberId));
  if (existingProfile && afterMsg !== existingProfile) {
    await assignMessagingProfile(row.providerNumberId, existingProfile);
  }

  await persistProvisioning(row.id, {
    state: "voice_configured",
    lastError: null,
    capabilities: after?.capabilities || before.capabilities,
    telnyxConnectionId: connectionId,
    messagingProfileId: existingProfile,
  });

  return diagnoseWorkspaceNumber({
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
  else if (diag.ready.fully) state = "fully_configured";
  else if (diag.ready.voice && !diag.ready.messaging) state = "voice_configured";
  else if (diag.ready.messaging && !diag.ready.voice) state = "messaging_configured";
  else if (diag.issues.some((i) => i.code === "capability_unsupported")) {
    state = "capability_unsupported";
  } else if (diag.issues.some((i) => i.severity === "error")) {
    state = "configuration_failed";
  }

  await persistProvisioning(input.phoneNumberId, {
    state,
    lastError: diag.issues.find((i) => i.severity === "error")?.message || null,
    capabilities: diag.capabilities,
    telnyxConnectionId: diag.voiceConnectionId,
    messagingProfileId: diag.messagingProfileId,
  });

  return { ...diag, provisionState: state };
}

/**
 * After purchase / order resolve: attach voice + messaging and verify.
 * Idempotent — safe to retry.
 */
export async function provisionPurchasedNumber(input: {
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

  const connectionId = await resolveVoiceConnectionId();
  const profileId = await ensureWorkspaceMessagingProfileId(input.workspaceId);

  const current = await fetchTelnyxNumber(row.providerNumberId);
  if (current && connectionId && current.connectionId !== connectionId) {
    await assignVoiceConnection(row.providerNumberId, connectionId);
  }
  if (profileId) {
    const msgId =
      current?.messagingProfileId ||
      (await fetchMessagingAssignment(row.providerNumberId));
    if (msgId !== profileId) {
      await assignMessagingProfile(row.providerNumberId, profileId);
    }
  }

  // Ensure messaging attach flag on registration when this is the reg number.
  const reg = await getRegistrationByWorkspace(input.workspaceId);
  if (reg?.phoneE164 === row.e164 && profileId) {
    await getPrisma().messagingRegistration.updateMany({
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

  const voiceOk = Boolean(
    telnyx?.connectionId &&
      expectedVoice &&
      telnyx.connectionId === expectedVoice,
  );
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
    issues.push({
      code: "voice_wrong_connection",
      severity: "warn",
      message: `Voice connection is ${telnyx.connectionId}, expected ${expectedVoice}`,
    });
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

  const capabilities =
    telnyx?.capabilities ||
    (asRecord(row.capabilitiesJson) as NumberCapabilities | null);

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
      messaging: messagingOk || Boolean(messagingProfileId),
      voice: voiceOk,
      fully: (messagingOk || Boolean(messagingProfileId)) && voiceOk,
    },
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
