import "server-only";

/**
 * Canonical MCTB missed-call capture pipeline.
 *
 * All ingress paths (TeXML status callback, legacy Call Control, SIP) normalize
 * to MctbInboundCallEvent and flow through this single handler.
 *
 * @see src/lib/mctb/event-only/types.ts — MctbInboundCallEvent
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md
 */

export type {
  HandleMctbInboundEventResult,
} from "@/lib/mctb/event-only/handle";

export {
  handleMctbInboundEvent,
  enqueueMctbRecoverySms,
} from "@/lib/mctb/event-only/handle";

export type {
  MctbInboundCallEvent,
  MctbCaptureMode,
  MctbInboundProvider,
} from "@/lib/mctb/event-only/types";

export {
  normalizeTelnyxMctbInboundEvent,
  normalizeSipMctbInboundEvent,
} from "@/lib/mctb/event-only/normalize";

import {
  handleMctbInboundEvent,
  type HandleMctbInboundEventResult,
} from "@/lib/mctb/event-only/handle";
import type { MctbInboundCallEvent } from "@/lib/mctb/event-only/types";

/** Canonical capture entry — one pipeline for TeXML, Call Control, and SIP. */
export async function captureMctbMissedCall(
  event: MctbInboundCallEvent,
  options?: { lockWorkspaceId?: string },
): Promise<HandleMctbInboundEventResult> {
  return handleMctbInboundEvent(event, options);
}
