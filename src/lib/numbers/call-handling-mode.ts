import "server-only";

import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { readPhoneMctbSettings } from "@/lib/mctb/sip-ingress/sync";
import { transitionNumberService } from "@/lib/numbers/state-service";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  readCallHandlingMode,
  snapshotCallHandlingMode,
  type CallHandlingMode,
  type CallHandlingModeSnapshot,
} from "@/lib/numbers/call-handling-mode-shared";

export type { CallHandlingMode, CallHandlingModeSnapshot };
export { readCallHandlingMode, snapshotCallHandlingMode };

function readSettings(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>)
    : {};
}

function isFrozenPlatformDemoNumber(e164: string): boolean {
  try {
    return normalizeE164(e164) === normalizeE164(MCTB_PLATFORM_DEMO_E164);
  } catch {
    return e164.includes("5714073615");
  }
}

async function ensureTelnyxCallControlProvision(workspaceId: string, phoneNumberId: string) {
  const { provisionPurchasedNumber } = await import("@/lib/phone/telnyx-dual-provision");
  await provisionPurchasedNumber({ workspaceId, phoneNumberId });
}

async function ensureMctbSipProvision(workspaceId: string, phoneNumberId: string) {
  const { provisionMctbTelnyxSipIngress } = await import("@/lib/mctb/provisioning/telnyx-sip-ingress");
  await provisionMctbTelnyxSipIngress({ workspaceId, phoneNumberId });
}

/**
 * Switch inbound call handling for a customer-owned number.
 * Does not modify the frozen platform demo 571 unless explicitly allowed elsewhere.
 */
export async function setCallHandlingMode(input: {
  workspaceId: string;
  phoneNumberId: string;
  mode: CallHandlingMode;
}): Promise<{ ok: true; snapshot: CallHandlingModeSnapshot }> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Number not found");

  if (isFrozenPlatformDemoNumber(row.e164)) {
    throw new Error(
      "The platform demo number is frozen for MCTB regression. Use a different number for Smart Routing tests.",
    );
  }

  const settings = readSettings(row.settingsJson);

  if (input.mode === "mctb") {
    const entitled = await hasWorkspaceProductFeature(input.workspaceId, "mctb");
    if (!entitled) throw new Error("Missed Call Text Back is not active on this workspace");

    if (settings.routingOwner === "smart_routing") {
      await transitionNumberService(input.workspaceId, input.phoneNumberId, "clear_smart_routing_owner");
    }
    if (settings.routingOwner === "smart_routing_callback") {
      await transitionNumberService(
        input.workspaceId,
        input.phoneNumberId,
        "clear_smart_routing_callback_owner",
      );
    }

    await ensureMctbSipProvision(input.workspaceId, input.phoneNumberId);

    const refreshed = await prisma.phoneNumber.findUnique({ where: { id: input.phoneNumberId } });
    const merged = readSettings(refreshed?.settingsJson);
    await prisma.phoneNumber.update({
      where: { id: input.phoneNumberId },
      data: {
        settingsJson: {
          ...merged,
          callHandlingMode: "mctb",
          mctbSipIngress: true,
          mctbRole: merged.mctbRole || "customer_mctb",
          routingOwner: null,
          parked: false,
          personalParked: false,
        },
      },
    });
  } else if (input.mode === "smart_routing") {
    const entitled = await hasWorkspaceProductFeature(input.workspaceId, "smart_routing");
    if (!entitled) throw new Error("Smart Routing is not active on this workspace");

    const mctbSettings = readPhoneMctbSettings(row.settingsJson);
    if (mctbSettings.mctbSipIngress === true || mctbSettings.mctbRole) {
      await prisma.phoneNumber.update({
        where: { id: input.phoneNumberId },
        data: {
          settingsJson: {
            ...settings,
            mctbSipIngress: false,
            mctbRole: null,
            routingOwner: settings.routingOwner,
          },
        },
      });
    }

    await ensureTelnyxCallControlProvision(input.workspaceId, input.phoneNumberId);
    await transitionNumberService(input.workspaceId, input.phoneNumberId, "set_smart_routing_owner");

    const afterOwner = await prisma.phoneNumber.findUnique({ where: { id: input.phoneNumberId } });
    const merged = readSettings(afterOwner?.settingsJson);
    await prisma.phoneNumber.update({
      where: { id: input.phoneNumberId },
      data: {
        settingsJson: {
          ...merged,
          callHandlingMode: "smart_routing",
          mctbSipIngress: false,
          mctbRole: null,
        },
      },
    });
  } else {
    if (settings.routingOwner === "smart_routing") {
      await transitionNumberService(input.workspaceId, input.phoneNumberId, "clear_smart_routing_owner");
    }
    if (settings.routingOwner === "smart_routing_callback") {
      await transitionNumberService(
        input.workspaceId,
        input.phoneNumberId,
        "clear_smart_routing_callback_owner",
      );
    }
    await prisma.phoneNumber.update({
      where: { id: input.phoneNumberId },
      data: {
        settingsJson: {
          ...settings,
          callHandlingMode: "none",
          mctbSipIngress: false,
          mctbRole: null,
        },
      },
    });
  }

  const final = await prisma.phoneNumber.findUnique({ where: { id: input.phoneNumberId } });
  return { ok: true, snapshot: snapshotCallHandlingMode(final?.settingsJson) };
}
