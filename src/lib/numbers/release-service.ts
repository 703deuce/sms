import { getPrisma } from "@/lib/db";
import { messagingOnboarding } from "@/lib/messaging/service";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { getNumberProvider } from "@/lib/numbers/providers/number-search-service";
import { resolvePhoneNumberProvider } from "@/lib/numbers/providers/normalize";
import { customerSmartRoutingFlowWhere } from "@/lib/smart-routing/flow-kind";
import { normalizeTelnyxError } from "./telnyx-errors";

export type ReleaseNumberResult = {
  ok: boolean;
  releasedE164?: string;
  providerReleased?: boolean;
  error?: string;
};

function readSettings(row: { settingsJson: unknown }): Record<string, unknown> {
  return row.settingsJson && typeof row.settingsJson === "object"
    ? (row.settingsJson as Record<string, unknown>)
    : {};
}

export async function assertNumberReleasable(
  workspaceId: string,
  numberId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) return { ok: false, error: "Number not found" };
  if (row.status === "Released" || row.releasedAt) {
    return { ok: false, error: "Number is already released" };
  }

  const settings = readSettings(row);
  const portState = settings.personalServiceState as string | undefined;
  if (portState === "PORTING_OUT" || portState === "PORT_AWAY_WINDOW") {
    return {
      ok: false,
      error: "This number is in a port-away window. Complete port-out before releasing.",
    };
  }

  const portStatus = settings.portStatus as string | undefined;
  if (portStatus === "porting_out" || portStatus === "PORTING_OUT") {
    return {
      ok: false,
      error: "Port-out is in progress. Release is blocked until port completes.",
    };
  }

  return { ok: true };
}

export async function releaseWorkspaceNumber(
  workspaceId: string,
  numberId: string,
): Promise<ReleaseNumberResult> {
  const releasable = await assertNumberReleasable(workspaceId, numberId);
  if (!releasable.ok) {
    return { ok: false, error: releasable.error };
  }

  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) return { ok: false, error: "Number not found" };

  const reg = await getRegistrationByWorkspace(workspaceId);
  const isRegistrationPrimary =
    reg?.phoneE164 === row.e164 || reg?.phoneSid === row.providerNumberId;

  let providerReleased = false;
  const upstream = resolvePhoneNumberProvider(row);
  const upstreamNumberId =
    row.providerNumberId ||
    (upstream === "twilio" ? row.twilioSid : row.providerNumberId) ||
    null;

  if (upstreamNumberId && !upstreamNumberId.startsWith("DRY_RUN:")) {
    try {
      if (isRegistrationPrimary) {
        await messagingOnboarding.releaseNumber(workspaceId);
        providerReleased = true;
      } else {
        const provider = getNumberProvider(upstream);
        await provider.releaseNumber(upstreamNumberId, workspaceId);
        providerReleased = true;
      }
    } catch (err) {
      const normalized = upstream === "telnyx" ? normalizeTelnyxError(err) : undefined;
      return {
        ok: false,
        error:
          normalized?.message ??
          (err instanceof Error ? err.message : "Provider release failed"),
      };
    }
  } else if (isRegistrationPrimary) {
    try {
      await messagingOnboarding.releaseNumber(workspaceId);
      providerReleased = true;
    } catch {
      // registration row may already be cleared
    }
  }

  const settings = readSettings(row);
  await prisma.phoneNumber.update({
    where: { id: numberId },
    data: {
      status: "Released",
      releasedAt: new Date(),
      voiceForwardTo: null,
      settingsJson: {
        ...settings,
        personalServiceState: "RELEASED",
        parked: true,
        personalParked: true,
        routingOwner: null,
        callHandlingMode: null,
        mctbSipIngress: false,
      },
    },
  });

  await prisma.callForwardingRule.updateMany({
    where: { workspaceId, phoneNumberId: numberId, active: true },
    data: { active: false },
  });

  await prisma.smartRoutingFlow.updateMany({
    where: {
      workspaceId,
      assignedPhoneNumberId: numberId,
      status: "active",
      ...customerSmartRoutingFlowWhere,
    },
    data: { status: "paused" },
  });

  const { loadSmartRoutingWorkspaceSettings, updateSmartRoutingWorkspaceSettings } = await import(
    "@/lib/smart-routing/workspace-settings"
  );
  const { sameSmartRoutingE164 } = await import("@/lib/smart-routing/internal-numbers");
  const srSettings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (
    srSettings?.assignedPhoneNumberId === numberId ||
    (srSettings?.routingNumberE164 && sameSmartRoutingE164(srSettings.routingNumberE164, row.e164))
  ) {
    await updateSmartRoutingWorkspaceSettings(workspaceId, {
      assignedPhoneNumberId: null,
      routingNumberE164: null,
    });
  }
  if (
    srSettings?.assignedCallbackPhoneNumberId === numberId ||
    (srSettings?.callbackNumberE164 && sameSmartRoutingE164(srSettings.callbackNumberE164, row.e164))
  ) {
    await updateSmartRoutingWorkspaceSettings(workspaceId, {
      assignedCallbackPhoneNumberId: null,
      callbackNumberE164: null,
    });
  }

  const { loadCallForwardingWorkspaceSettings, updateCallForwardingWorkspaceSettings } = await import(
    "@/lib/call-forwarding/workspace-settings"
  );
  const cfSettings = await loadCallForwardingWorkspaceSettings(workspaceId);
  if (cfSettings) {
    const cfPatch: Partial<{
      assignedPhoneNumberId: string | null;
      businessNumberE164: string | null;
      controlPhoneNumberId: string | null;
      controlNumberE164: string | null;
    }> = {};
    if (cfSettings.assignedPhoneNumberId === numberId) {
      cfPatch.assignedPhoneNumberId = null;
      cfPatch.businessNumberE164 = null;
    }
    if (cfSettings.controlPhoneNumberId === numberId) {
      cfPatch.controlPhoneNumberId = null;
      cfPatch.controlNumberE164 = null;
    }
    if (Object.keys(cfPatch).length > 0) {
      await updateCallForwardingWorkspaceSettings(workspaceId, cfPatch);
    }
  }

  return { ok: true, releasedE164: row.e164, providerReleased };
}

export async function releaseAllWorkspaceNumbers(workspaceId: string): Promise<{
  released: number;
  errors: string[];
}> {
  const prisma = getPrisma();
  const rows = await prisma.phoneNumber.findMany({
    where: { workspaceId, releasedAt: null, status: { not: "Released" } },
    select: { id: true },
  });

  let released = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const result = await releaseWorkspaceNumber(workspaceId, row.id);
    if (result.ok) released += 1;
    else if (result.error) errors.push(result.error);
  }
  return { released, errors };
}
