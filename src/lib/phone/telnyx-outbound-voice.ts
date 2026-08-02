/**
 * Telnyx Outbound Voice Profile provisioning for AI transfers, softphone,
 * forwarding, and human outbound dials.
 *
 * Outbound is not enabled on the phone number itself — the Voice API /
 * Call Control Application must be attached to an enabled Outbound Voice
 * Profile that permits the destination country.
 */

import { telnyxRequest, TelnyxApiError } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import {
  ensureVoiceCallControlApplication,
  fetchConnectionOrApp,
  isCallControlApplication,
} from "@/lib/phone/telnyx-voice-connection";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const PROFILE_NAME = "Transovo Production Outbound";
const PROFILE_TAG = "transovo-managed";
const DEFAULT_DESTINATIONS = ["US", "CA"];

export type OutboundVoiceReadiness = {
  ready: boolean;
  connectionId: string | null;
  connectionName: string | null;
  outboundVoiceProfileId: string | null;
  profileName: string | null;
  profileEnabled: boolean | null;
  whitelistedDestinations: string[];
  concurrentCallLimit: number | null;
  dailySpendLimit: string | null;
  dailySpendLimitEnabled: boolean | null;
  callerIdE164: string | null;
  createdProfile: boolean;
  updatedProfile: boolean;
  attachedConnection: boolean;
  issues: Array<{
    code: string;
    severity: "error" | "warn" | "info";
    message: string;
  }>;
  verifiedAt: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function readOutboundProfileId(app: Record<string, unknown> | null): string | null {
  if (!app) return null;
  const outbound = asRecord(app.outbound);
  const nested = outbound?.outbound_voice_profile_id;
  if (nested != null && String(nested).trim()) return String(nested);
  const top = app.outbound_voice_profile_id;
  if (top != null && String(top).trim()) return String(top);
  return null;
}

async function listOutboundVoiceProfiles(): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<{
      data?: Array<Record<string, unknown>>;
      meta?: { total_pages?: number };
    }>("/outbound_voice_profiles", {
      query: { "page[number]": page, "page[size]": 50 },
    });
    const rows = res.data || [];
    out.push(...rows);
    const totalPages = Number(res.meta?.total_pages || 1);
    if (page >= totalPages || rows.length === 0) break;
    page += 1;
    if (page > 10) break;
  }
  return out;
}

async function fetchOutboundVoiceProfile(
  id: string,
): Promise<Record<string, unknown> | null> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/outbound_voice_profiles/${encodeURIComponent(id)}`,
  );
  return asRecord(res.data);
}

function pickExistingProfile(
  profiles: Record<string, unknown>[],
): Record<string, unknown> | null {
  const envId = process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID?.trim() || "";
  if (envId) {
    const byEnv = profiles.find((p) => String(p.id) === envId);
    if (byEnv) return byEnv;
  }
  const byTag = profiles.find((p) => {
    const tags = Array.isArray(p.tags) ? p.tags.map(String) : [];
    return tags.includes(PROFILE_TAG);
  });
  if (byTag) return byTag;
  const byName = profiles.find(
    (p) => String(p.name || "").trim().toLowerCase() === PROFILE_NAME.toLowerCase(),
  );
  if (byName) return byName;
  // Prefer any enabled profile that already allows US.
  const usEnabled = profiles.find((p) => {
    if (p.enabled === false) return false;
    const dest = Array.isArray(p.whitelisted_destinations)
      ? p.whitelisted_destinations.map(String)
      : [];
    return dest.includes("US");
  });
  return usEnabled || profiles[0] || null;
}

function mergeDestinations(existing: unknown, required: string[]): string[] {
  const cur = Array.isArray(existing) ? existing.map(String) : [];
  const set = new Set([...cur, ...required]);
  return [...set];
}

async function attachProfileToCallControlApp(
  connectionId: string,
  profileId: string,
  app: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const patched = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/call_control_applications/${encodeURIComponent(connectionId)}`,
    {
      method: "PATCH",
      body: {
        application_name:
          String(app.application_name || "").trim() || "Transovo Voice",
        webhook_event_url: app.webhook_event_url || undefined,
        webhook_api_version: app.webhook_api_version || "2",
        active: true,
        outbound: {
          outbound_voice_profile_id: profileId,
        },
      },
    },
  );
  return asRecord(patched.data) || app;
}

function buildReport(input: {
  connectionId: string | null;
  app: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  createdProfile: boolean;
  updatedProfile: boolean;
  attachedConnection: boolean;
  callerIdE164?: string | null;
  extraIssues?: OutboundVoiceReadiness["issues"];
}): OutboundVoiceReadiness {
  const issues: OutboundVoiceReadiness["issues"] = [...(input.extraIssues || [])];
  const profile = input.profile;
  const dests = Array.isArray(profile?.whitelisted_destinations)
    ? profile!.whitelisted_destinations.map(String)
    : [];
  const profileId = profile?.id ? String(profile.id) : null;
  const attachedId = readOutboundProfileId(input.app);
  const enabled = profile ? profile.enabled !== false : null;

  if (!input.connectionId) {
    issues.push({
      code: "missing_voice_application",
      severity: "error",
      message: "No Call Control / Voice API Application resolved",
    });
  }
  if (!profileId) {
    issues.push({
      code: "missing_outbound_profile",
      severity: "error",
      message: "No Outbound Voice Profile available",
    });
  }
  if (profileId && enabled === false) {
    issues.push({
      code: "outbound_profile_disabled",
      severity: "error",
      message: "Outbound Voice Profile is disabled — outbound/transfer dials will fail",
    });
  }
  if (profileId && !dests.includes("US")) {
    issues.push({
      code: "destination_us_not_allowed",
      severity: "error",
      message: "Outbound Voice Profile does not whitelist US destinations",
    });
  }
  if (profileId && attachedId !== profileId) {
    issues.push({
      code: "voice_app_not_attached",
      severity: "error",
      message: `Voice application outbound profile is ${attachedId || "none"}, expected ${profileId}`,
    });
  }

  const ready = Boolean(
    input.connectionId &&
      profileId &&
      enabled &&
      dests.includes("US") &&
      attachedId === profileId &&
      !issues.some((i) => i.severity === "error"),
  );

  return {
    ready,
    connectionId: input.connectionId,
    connectionName: input.app
      ? String(input.app.application_name || input.app.connection_name || "") || null
      : null,
    outboundVoiceProfileId: profileId,
    profileName: profile ? String(profile.name || "") || null : null,
    profileEnabled: enabled,
    whitelistedDestinations: dests,
    concurrentCallLimit:
      profile?.concurrent_call_limit == null
        ? null
        : Number(profile.concurrent_call_limit),
    dailySpendLimit: profile?.daily_spend_limit
      ? String(profile.daily_spend_limit)
      : null,
    dailySpendLimitEnabled:
      profile?.daily_spend_limit_enabled == null
        ? null
        : Boolean(profile.daily_spend_limit_enabled),
    callerIdE164: input.callerIdE164 || null,
    createdProfile: input.createdProfile,
    updatedProfile: input.updatedProfile,
    attachedConnection: input.attachedConnection,
    issues,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Idempotent: find/create OVP, ensure US allowed + enabled, attach to Voice API app.
 */
export async function ensureTelnyxOutboundVoiceReady(input?: {
  connectionId?: string | null;
  callerIdE164?: string | null;
  requiredDestinations?: string[];
  /** When true, only report — do not create/attach. */
  diagnoseOnly?: boolean;
}): Promise<OutboundVoiceReadiness> {
  if (!getTelnyxApiKey()) {
    return buildReport({
      connectionId: null,
      app: null,
      profile: null,
      createdProfile: false,
      updatedProfile: false,
      attachedConnection: false,
      extraIssues: [
        {
          code: "missing_api_key",
          severity: "error",
          message: "TELNYX_API_KEY is not configured",
        },
      ],
    });
  }

  const required = input?.requiredDestinations?.length
    ? input.requiredDestinations
    : DEFAULT_DESTINATIONS;

  let connectionId = input?.connectionId?.trim() || "";
  let app: Record<string, unknown> | null = null;

  if (connectionId) {
    app = await fetchConnectionOrApp(connectionId);
    if (!isCallControlApplication(app)) {
      // Fall back to ensuring the platform Voice CC app.
      const ensured = await ensureVoiceCallControlApplication();
      connectionId = ensured.connectionId;
      app = ensured.app;
    }
  } else {
    const ensured = await ensureVoiceCallControlApplication();
    connectionId = ensured.connectionId;
    app = ensured.app;
  }

  let createdProfile = false;
  let updatedProfile = false;
  let attachedConnection = false;
  let profile: Record<string, unknown> | null = null;

  const profiles = await listOutboundVoiceProfiles();
  profile = pickExistingProfile(profiles);

  if (!profile && !input?.diagnoseOnly) {
    const created = await telnyxRequest<{ data?: Record<string, unknown> }>(
      "/outbound_voice_profiles",
      {
        method: "POST",
        body: {
          name: PROFILE_NAME,
          enabled: true,
          traffic_type: "conversational",
          service_plan: "global",
          concurrent_call_limit: 10,
          whitelisted_destinations: required,
          tags: [PROFILE_TAG, "production"],
        },
      },
    );
    profile = asRecord(created.data);
    createdProfile = true;
    if (!profile?.id) {
      return buildReport({
        connectionId,
        app,
        profile: null,
        createdProfile,
        updatedProfile,
        attachedConnection,
        callerIdE164: input?.callerIdE164,
        extraIssues: [
          {
            code: "profile_create_failed",
            severity: "error",
            message: "Telnyx did not return an Outbound Voice Profile id",
          },
        ],
      });
    }
  } else if (profile?.id && !input?.diagnoseOnly) {
    const dests = mergeDestinations(profile.whitelisted_destinations, required);
    const needsEnable = profile.enabled === false;
    const needsDest =
      dests.length !==
        (Array.isArray(profile.whitelisted_destinations)
          ? profile.whitelisted_destinations.length
          : 0) ||
      required.some(
        (d) =>
          !(Array.isArray(profile!.whitelisted_destinations)
            ? profile!.whitelisted_destinations.map(String)
            : []
          ).includes(d),
      );
    const tags = Array.isArray(profile.tags) ? profile.tags.map(String) : [];
    const needsTag = !tags.includes(PROFILE_TAG);
    if (needsEnable || needsDest || needsTag) {
      const patched = await telnyxRequest<{ data?: Record<string, unknown> }>(
        `/outbound_voice_profiles/${encodeURIComponent(String(profile.id))}`,
        {
          method: "PATCH",
          body: {
            name: String(profile.name || PROFILE_NAME),
            enabled: true,
            whitelisted_destinations: dests,
            tags: needsTag ? [...tags, PROFILE_TAG] : tags,
          },
        },
      );
      profile = asRecord(patched.data) || {
        ...profile,
        enabled: true,
        whitelisted_destinations: dests,
      };
      updatedProfile = true;
    }
  }

  const profileId = profile?.id ? String(profile.id) : null;
  const currentAttached = readOutboundProfileId(app);

  if (
    profileId &&
    connectionId &&
    !input?.diagnoseOnly &&
    currentAttached !== profileId
  ) {
    app = await attachProfileToCallControlApp(connectionId, profileId, app || {});
    attachedConnection = true;
  }

  // Re-fetch live resources for the readiness report.
  if (connectionId) {
    app = (await fetchConnectionOrApp(connectionId)) || app;
  }
  if (profileId) {
    profile = (await fetchOutboundVoiceProfile(profileId)) || profile;
  }

  return buildReport({
    connectionId,
    app,
    profile,
    createdProfile,
    updatedProfile,
    attachedConnection,
    callerIdE164: input?.callerIdE164 || null,
  });
}

export async function diagnoseTelnyxOutboundVoice(input?: {
  connectionId?: string | null;
  callerIdE164?: string | null;
}): Promise<OutboundVoiceReadiness> {
  return ensureTelnyxOutboundVoiceReady({
    ...input,
    diagnoseOnly: true,
  });
}

/**
 * Place a short direct outbound call (no AI assistant / Transfer tool).
 * Proves the Voice API Application + OVP can originate to the destination.
 */
export async function testTelnyxOutboundDial(input: {
  fromE164: string;
  toE164: string;
  connectionId?: string | null;
  workspaceId?: string | null;
}): Promise<{
  ok: boolean;
  callControlId: string | null;
  connectionId: string | null;
  outboundVoiceProfileId: string | null;
  fromE164: string;
  toE164: string;
  error: string | null;
  telnyxStatus: number | null;
  telnyxBody: unknown;
  readiness: OutboundVoiceReadiness;
}> {
  const fromE164 = normalizeE164(input.fromE164);
  const toE164 = normalizeE164(input.toE164);
  const readiness = await ensureTelnyxOutboundVoiceReady({
    connectionId: input.connectionId,
    callerIdE164: fromE164,
  });

  if (!readiness.ready || !readiness.connectionId) {
    return {
      ok: false,
      callControlId: null,
      connectionId: readiness.connectionId,
      outboundVoiceProfileId: readiness.outboundVoiceProfileId,
      fromE164,
      toE164,
      error:
        readiness.issues.find((i) => i.severity === "error")?.message ||
        "Outbound voice is not ready",
      telnyxStatus: null,
      telnyxBody: null,
      readiness,
    };
  }

  try {
    const res = await telnyxRequest<{ data?: { call_control_id?: string } }>(
      "/calls",
      {
        method: "POST",
        body: {
          connection_id: readiness.connectionId,
          from: fromE164,
          to: toE164,
          timeout_secs: 25,
          client_state: Buffer.from(
            JSON.stringify({
              kind: "outbound_voice_probe",
              workspaceId: input.workspaceId || null,
              fromE164,
              toE164,
              profileId: readiness.outboundVoiceProfileId,
            }),
          ).toString("base64"),
        },
      },
    );
    const callControlId = res.data?.call_control_id
      ? String(res.data.call_control_id)
      : null;
    return {
      ok: Boolean(callControlId),
      callControlId,
      connectionId: readiness.connectionId,
      outboundVoiceProfileId: readiness.outboundVoiceProfileId,
      fromE164,
      toE164,
      error: callControlId ? null : "Telnyx dial response missing call_control_id",
      telnyxStatus: 200,
      telnyxBody: res,
      readiness,
    };
  } catch (err) {
    const apiErr = err instanceof TelnyxApiError ? err : null;
    return {
      ok: false,
      callControlId: null,
      connectionId: readiness.connectionId,
      outboundVoiceProfileId: readiness.outboundVoiceProfileId,
      fromE164,
      toE164,
      error: err instanceof Error ? err.message : String(err),
      telnyxStatus: apiErr?.status ?? null,
      telnyxBody: apiErr?.body ?? null,
      readiness,
    };
  }
}

/** Handle probe leg: answer, short announcement, hang up. */
export async function handleOutboundVoiceProbeEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
  clientState: Record<string, unknown>;
}): Promise<boolean> {
  if (input.clientState.kind !== "outbound_voice_probe") return false;
  const controlId = String(input.eventPayload.call_control_id || "");
  if (!controlId) return true;

  if (input.eventType === "call.initiated") {
    await telnyxRequest(`/calls/${controlId}/actions/answer`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    return true;
  }

  if (input.eventType === "call.answered") {
    await telnyxRequest(`/calls/${controlId}/actions/speak`, {
      method: "POST",
      body: {
        payload:
          "This is a Transovo outbound voice diagnostic. The transfer path is working. Goodbye.",
        voice: "female",
        language: "en-US",
      },
    }).catch(() => undefined);
    // Speak is async on Telnyx — wait in the worker then hang up.
    await new Promise((r) => setTimeout(r, 6500));
    await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }
  return true;
}
