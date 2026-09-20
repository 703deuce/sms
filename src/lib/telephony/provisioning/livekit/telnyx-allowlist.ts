import { ListUpdate } from "@livekit/protocol";
import type { SIPInboundTrunkInfo } from "livekit-server-sdk";
import type { MediaBackend } from "@/lib/voice/media-backend/types";
import { getLiveKitSipClient } from "./client";
import {
  TELNYX_LIVEKIT_INBOUND_ALLOWED_ADDRESSES,
  TELNYX_US_SIGNALING_CIDR,
  TELNYX_US_SIGNALING_IPS,
} from "./telnyx-ips";

function readAllowedAddresses(trunk: SIPInboundTrunkInfo): string[] {
  return (
    (trunk as { allowedAddresses?: string[] }).allowedAddresses ||
    (trunk as { allowed_addresses?: string[] }).allowed_addresses ||
    []
  );
}

/** True when `ip` is listed explicitly or falls inside a CIDR entry. */
export function telnyxSignalingIpAllowed(ip: string, allowed: string[]): boolean {
  if (allowed.includes(ip)) return true;
  for (const entry of allowed) {
    if (!entry.includes("/")) continue;
    const [base, bitsRaw] = entry.split("/");
    const bits = Number(bitsRaw);
    if (!base || !Number.isFinite(bits)) continue;
    const ipParts = ip.split(".").map((p) => Number(p));
    const baseParts = base.split(".").map((p) => Number(p));
    if (ipParts.length !== 4 || baseParts.length !== 4) continue;
    const ipNum =
      ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0;
    const baseNum =
      ((baseParts[0] << 24) | (baseParts[1] << 16) | (baseParts[2] << 8) | baseParts[3]) >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((ipNum & mask) === (baseNum & mask)) return true;
  }
  return false;
}

export function missingTelnyxSignalingIps(allowed: string[]): string[] {
  if (!allowed.length) return [];
  return TELNYX_US_SIGNALING_IPS.filter((ip) => !telnyxSignalingIpAllowed(ip, allowed));
}

export async function ensureTelnyxSignalingAllowlist(input: {
  trunkId: string;
  backend?: MediaBackend;
}): Promise<{ patched: boolean; allowedAddresses: string[]; actions: string[] }> {
  const client = getLiveKitSipClient(input.backend);
  const listed = await client.listSipInboundTrunk({ trunkIds: [input.trunkId] });
  const trunk = listed[0];
  if (!trunk?.sipTrunkId) {
    throw new Error(`LiveKit inbound trunk ${input.trunkId} not found`);
  }

  const current = readAllowedAddresses(trunk);
  const hasTelnyxCidr = current.some(
    (entry) => entry === TELNYX_US_SIGNALING_CIDR || entry === "192.76.120.0/22",
  );
  const hasExplicitIps =
    current.length > 0 &&
    TELNYX_US_SIGNALING_IPS.every((ip) => telnyxSignalingIpAllowed(ip, current));

  if (!current.length) {
    await client.updateSipInboundTrunkFields(input.trunkId, {
      allowedAddresses: new ListUpdate({
        set: [...TELNYX_LIVEKIT_INBOUND_ALLOWED_ADDRESSES],
      }),
    });
    return {
      patched: true,
      allowedAddresses: [...TELNYX_LIVEKIT_INBOUND_ALLOWED_ADDRESSES],
      actions: ["telnyx_allowlist_set_cidr"],
    };
  }

  const coversAllSignalingIps = TELNYX_US_SIGNALING_IPS.every((ip) =>
    telnyxSignalingIpAllowed(ip, current),
  );

  if (hasTelnyxCidr && coversAllSignalingIps) {
    return { patched: false, allowedAddresses: current, actions: ["telnyx_allowlist_ok"] };
  }

  if (!coversAllSignalingIps) {
    await client.updateSipInboundTrunkFields(input.trunkId, {
      allowedAddresses: new ListUpdate({
        set: [...TELNYX_LIVEKIT_INBOUND_ALLOWED_ADDRESSES],
      }),
    });
    return {
      patched: true,
      allowedAddresses: [...TELNYX_LIVEKIT_INBOUND_ALLOWED_ADDRESSES],
      actions: [
        hasTelnyxCidr
          ? "telnyx_allowlist_completed_us_signaling"
          : "telnyx_allowlist_upgraded_to_cidr",
      ],
    };
  }

  if (hasTelnyxCidr || hasExplicitIps) {
    return { patched: false, allowedAddresses: current, actions: ["telnyx_allowlist_ok"] };
  }

  const missing = missingTelnyxSignalingIps(current);
  const next = [...new Set([...current, ...TELNYX_US_SIGNALING_IPS, TELNYX_US_SIGNALING_CIDR])];
  await client.updateSipInboundTrunkFields(input.trunkId, {
    allowedAddresses: new ListUpdate({ set: next }),
  });

  return {
    patched: true,
    allowedAddresses: next,
    actions: [`telnyx_allowlist_patched:${missing.join(",")}`],
  };
}
