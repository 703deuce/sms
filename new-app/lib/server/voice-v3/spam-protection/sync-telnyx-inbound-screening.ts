import "server-only";

import { getPrisma } from "@/lib/server/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  telnyxInboundScreeningForPolicy,
  type TelnyxInboundCallScreening,
  type VoiceV3SpamLikelyPolicy,
} from "./types";

export type SpamScreeningSyncState = {
  desiredPolicy: VoiceV3SpamLikelyPolicy | null;
  desiredTelnyxMode: TelnyxInboundCallScreening | null;
  confirmedTelnyxMode: TelnyxInboundCallScreening | null;
  lastSyncedAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncError: string | null;
};

function readVoiceSettings(data: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!data) return null;
  const vs = data.voice_settings;
  if (vs && typeof vs === "object" && !Array.isArray(vs)) return vs as Record<string, unknown>;
  return data;
}

async function fetchTelnyxVoiceSettings(providerNumberId: string): Promise<{
  inbound_call_screening?: string;
}> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}/voice`,
  );
  const data = readVoiceSettings(res.data) || res.data || {};
  return {
    inbound_call_screening: data.inbound_call_screening
      ? String(data.inbound_call_screening)
      : undefined,
  };
}

export async function syncTelnyxInboundCallScreeningForPhone(input: {
  workspaceId: string;
  phoneNumberId: string;
  spamLikelyPolicy: VoiceV3SpamLikelyPolicy | null;
  agentId?: string;
}): Promise<{
  ok: boolean;
  skipped: boolean;
  desired: TelnyxInboundCallScreening | null;
  previous: TelnyxInboundCallScreening | null;
  confirmed: TelnyxInboundCallScreening | null;
  error?: string;
}> {
  const desired = telnyxInboundScreeningForPolicy(input.spamLikelyPolicy);
  if (!desired) {
    return { ok: true, skipped: true, desired: null, previous: null, confirmed: null };
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, providerNumberId: true, metadata: true },
  });
  if (!phone?.providerNumberId) {
    return {
      ok: false,
      skipped: false,
      desired,
      previous: null,
      confirmed: null,
      error: "Phone number missing Telnyx provider id",
    };
  }

  const providerNumberId = String(phone.providerNumberId);
  let previous: TelnyxInboundCallScreening = "disabled";
  try {
    const current = await fetchTelnyxVoiceSettings(providerNumberId);
    const cur = String(current.inbound_call_screening || "disabled") as TelnyxInboundCallScreening;
    if (cur === "reject_calls" || cur === "flag_calls" || cur === "disabled") {
      previous = cur;
    }
    if (previous === desired) {
      await persistSpamSyncMetadata(phone.id, phone.metadata, {
        desiredPolicy: input.spamLikelyPolicy,
        desiredTelnyxMode: desired,
        confirmedTelnyxMode: previous,
        lastSyncedAt: new Date().toISOString(),
        lastSyncOk: true,
        lastSyncError: null,
      });
      console.log("VOICE_V3_SPAM_POLICY_SYNC_SUCCEEDED", {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        phoneNumberId: phone.id,
        providerNumberId,
        desired,
        previous,
        idempotent: true,
      });
      return { ok: true, skipped: false, desired, previous, confirmed: previous };
    }

    console.log("VOICE_V3_SPAM_POLICY_SYNC_STARTED", {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      phoneNumberId: phone.id,
      providerNumberId,
      desired,
      previous,
    });

    await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}/voice`, {
      method: "PATCH",
      body: { inbound_call_screening: desired },
    });

    const verified = await fetchTelnyxVoiceSettings(providerNumberId);
    const confirmed = String(
      verified.inbound_call_screening || "disabled",
    ) as TelnyxInboundCallScreening;
    const ok = confirmed === desired;

    await persistSpamSyncMetadata(phone.id, phone.metadata, {
      desiredPolicy: input.spamLikelyPolicy,
      desiredTelnyxMode: desired,
      confirmedTelnyxMode: confirmed,
      lastSyncedAt: new Date().toISOString(),
      lastSyncOk: ok,
      lastSyncError: ok ? null : `Telnyx reported ${confirmed}, expected ${desired}`,
    });

    if (ok) {
      console.log("VOICE_V3_SPAM_POLICY_SYNC_SUCCEEDED", {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        phoneNumberId: phone.id,
        providerNumberId,
        desired,
        previous,
        confirmed,
      });
    } else {
      console.error("VOICE_V3_SPAM_POLICY_SYNC_FAILED", {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        phoneNumberId: phone.id,
        providerNumberId,
        desired,
        confirmed,
      });
    }

    return {
      ok,
      skipped: false,
      desired,
      previous,
      confirmed,
      error: ok ? undefined : `Telnyx screening is ${confirmed}, expected ${desired}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persistSpamSyncMetadata(phone.id, phone.metadata, {
      desiredPolicy: input.spamLikelyPolicy,
      desiredTelnyxMode: desired,
      confirmedTelnyxMode: previous,
      lastSyncedAt: new Date().toISOString(),
      lastSyncOk: false,
      lastSyncError: message.slice(0, 500),
    });
    console.error("VOICE_V3_SPAM_POLICY_SYNC_FAILED", {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      phoneNumberId: phone.id,
      providerNumberId,
      error: message,
    });
    return {
      ok: false,
      skipped: false,
      desired,
      previous,
      confirmed: null,
      error: message,
    };
  }
}

async function persistSpamSyncMetadata(
  phoneNumberId: string,
  metadata: unknown,
  sync: SpamScreeningSyncState,
): Promise<void> {
  const prisma = getPrisma();
  const prev =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      metadata: {
        ...prev,
        voiceV3SpamScreeningSync: sync,
      } as object,
    },
  });
}
