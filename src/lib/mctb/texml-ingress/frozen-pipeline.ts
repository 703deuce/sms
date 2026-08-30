/**
 * FROZEN — MCTB Final Production Pipeline (mctb_texml_final_v1)
 *
 * PSTN-certified 2026-08-30. Do not change behavior without updating
 * docs/MCTB_FINAL_PRODUCTION_PIPELINE.md and re-certifying both modes.
 */
import { MCTB_TEXML_DEFAULT_APP_ID } from "./constants";

export const MCTB_FINAL_PIPELINE_ID = "mctb_texml_final_v1" as const;

/** Press-1 consent recording (Gather inner Play). */
export const MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID = "cmt3o8tyd1o5r0o4k3e4n5v2l";

/** Existing-consent voicemail greeting (Play/Say + Record — SMS after recording saved). */
export const MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID = "cmt8pz72y1o096i6y3c24383j";

export const MCTB_FINAL_PRODUCTION_ENTRY_PATH = "/api/telnyx/voice/mctb-entry" as const;
export const MCTB_FINAL_PRODUCTION_CONSENT_PATH = "/api/telnyx/voice/mctb-consent" as const;
export const MCTB_FINAL_PRODUCTION_CERT_MODE = "D" as const;

export const MCTB_FINAL_REFERENCE_DID = "+18663464256";
export const MCTB_FINAL_REFERENCE_PHONE_ID = "cmsc3numa1j17084g391t2z5l";
export const MCTB_FINAL_REFERENCE_WORKSPACE_ID = "ws_1";
export const MCTB_FINAL_REFERENCE_SMS_PHONE_ID = "cmsgtjms84g6l2h0o255w1e3v";
export const MCTB_FINAL_TEXML_APP_ID = MCTB_TEXML_DEFAULT_APP_ID;

/** Files that implement the frozen pipeline — CI/verify script uses this list. */
export const MCTB_FINAL_PIPELINE_SOURCE_FILES = [
  "src/app/api/telnyx/voice/mctb-entry/route.ts",
  "src/app/api/telnyx/voice/mctb-consent/route.ts",
  "src/app/api/telnyx/voice/mctb-texml-voicemail/route.ts",
  "src/lib/mctb/consent-prompt/texml-response.ts",
  "src/lib/mctb/texml-ingress/frozen-pipeline.ts",
  "src/lib/mctb/texml-ingress/existing-consent-capture.ts",
  "src/lib/mctb/texml-ingress/voicemail-session.ts",
  "src/lib/mctb/texml-ingress/voicemail-start.ts",
  "src/lib/mctb/texml-ingress/press1-playback.ts",
  "src/lib/voice/telnyx/texml-status-callback.ts",
] as const;
