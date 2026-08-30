import "server-only";

import {
  buildMctbConsentInboundTexml,
  buildMctbVoicemailGreetingTexml,
  resolveMctbConsentTexmlPromptMode,
} from "@/lib/mctb/consent-prompt/texml-response";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import type { ResolvedMctbTexmlCertMode } from "@/lib/mctb/texml-ingress/cert-mode";
import { certModeForcesPress1Gather } from "@/lib/mctb/texml-ingress/cert-mode";
import {
  getMctbVoicemailRecordCallbackWithRoutingToken,
  type MctbInboundRoutingProfile,
} from "@/lib/mctb/texml-ingress/routing-profile";
import { normalizeForwardedFromE164, parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";
import { pickMctbTexmlField } from "@/lib/mctb/texml-ingress/parse-texml-fields";

export type InstantInboundTexmlBranch =
  | "press_1_gather"
  | "existing_consent"
  | "paused_voicemail"
  | "fail_open_press_1";

export type InstantInboundTexml = {
  body: string;
  branch: InstantInboundTexmlBranch;
  routingToken: string;
  press1PlayUrl?: string | null;
  voicemailPlayUrl?: string | null;
};

function parseForwardedFrom(fields: Record<string, string>): string {
  return (
    normalizeForwardedFromE164(pickMctbTexmlField(fields, "ForwardedFrom", "forwarded_from")) ||
    parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
    ""
  );
}

function appendRoutingTokenToGatherUrl(gatherActionUrl: string | null, routingToken: string): string | null {
  if (!gatherActionUrl || !routingToken || routingToken === "r_failopen") return gatherActionUrl;
  try {
    const url = new URL(gatherActionUrl);
    url.searchParams.set("r", routingToken);
    return url.toString();
  } catch {
    return gatherActionUrl;
  }
}

/** Synchronous TeXML — no DB. Uses setup-time routing profile only. */
export function buildInstantMctbInboundTexml(input: {
  profile: MctbInboundRoutingProfile;
  fields: Record<string, string>;
  certMode: ResolvedMctbTexmlCertMode;
}): InstantInboundTexml | null {
  if (input.certMode !== "D" || certModeForcesPress1Gather(input.certMode)) {
    return null;
  }

  const forwardedFrom = parseForwardedFrom(input.fields);
  const routeToVoicemailInitial = input.profile.consentMode === MCTB_CONSENT_MODE_EXISTING;
  const routeToVoicemail =
    routeToVoicemailInitial ||
    (!routeToVoicemailInitial && !input.profile.automationActive);

  if (routeToVoicemail) {
    const playUrl = input.profile.voicemail.playUrl?.trim() || null;
    const body = buildMctbVoicemailGreetingTexml({
      playUrl,
      sayText: playUrl ? null : "Please leave a message after the tone.",
      recordCallbackUrl: getMctbVoicemailRecordCallbackWithRoutingToken(
        input.profile.routingToken,
      ),
    });
    return {
      body,
      branch:
        input.profile.consentMode === MCTB_CONSENT_MODE_EXISTING
          ? "existing_consent"
          : "paused_voicemail",
      routingToken: input.profile.routingToken,
      voicemailPlayUrl: playUrl,
    };
  }

  const built = buildMctbConsentInboundTexml(forwardedFrom, {
    promptMode: resolveMctbConsentTexmlPromptMode("play-gather"),
    gatherBasePath: "mctb-consent",
    certMode: "D",
    press1PlayUrl: input.profile.press1PlayUrl,
    press1SayText: null,
  });

  const gatherWithToken = appendRoutingTokenToGatherUrl(built.gatherActionUrl, input.profile.routingToken);
  const body =
    gatherWithToken && built.gatherActionUrl
      ? built.body.replace(built.gatherActionUrl, gatherWithToken)
      : built.body;

  return {
    body,
    branch: "press_1_gather",
    routingToken: input.profile.routingToken,
    press1PlayUrl: input.profile.press1PlayUrl,
  };
}
