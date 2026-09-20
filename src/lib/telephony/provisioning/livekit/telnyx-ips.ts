/**
 * Telnyx US SIP signaling (see https://sip.telnyx.com and Telnyx×LiveKit trunk guide).
 * Prefer the carrier CIDR on LiveKit inbound trunks; keep host IPs for legacy wildcard detection.
 */
export const TELNYX_US_SIGNALING_CIDR = "192.76.120.0/22";

/** Telnyx US SIP signaling IPs (see https://sip.telnyx.com). */
export const TELNYX_US_SIGNALING_IPS = [
  "192.76.120.10",
  "64.16.250.10",
] as const;

/**
 * Recommended LiveKit `allowed_addresses` for Telnyx-originated inbound SIP.
 * Telnyx×LiveKit docs use 192.76.120.0/22; Transovo also documents 64.16.250.10 (outside that /22).
 */
export const TELNYX_LIVEKIT_INBOUND_ALLOWED_ADDRESSES = [
  TELNYX_US_SIGNALING_CIDR,
  ...TELNYX_US_SIGNALING_IPS,
] as const;
