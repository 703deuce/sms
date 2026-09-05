import "server-only";

import {
  buildMctbConsentInboundTexml,
  resolveMctbConsentTexmlPromptMode,
} from "@/lib/mctb/consent-prompt/texml-response";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import type { ResolvedMctbTexmlCertMode } from "@/lib/mctb/texml-ingress/cert-mode";
import {
  certModeForcesPress1Gather,
  certModeUsesPlayGather,
} from "@/lib/mctb/texml-ingress/cert-mode";
import {
  type MctbInboundRoutingProfile,
} from "@/lib/mctb/texml-ingress/routing-profile";
import { buildInstantVoicemailTexml } from "@/lib/mctb/texml-ingress/instant-voicemail-texml";
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

function buildInstantPress1GatherTexml(input: {
  profile: MctbInboundRoutingProfile;
  fields: Record<string, string>;
  certMode: ResolvedMctbTexmlCertMode;
}): InstantInboundTexml {
  const forwardedFrom = parseForwardedFrom(input.fields);
  const promptMode =
    input.certMode === "D" || certModeUsesPlayGather(input.certMode)
      ? resolveMctbConsentTexmlPromptMode("play-gather")
      : resolveMctbConsentTexmlPromptMode("say-gather");

  const built = buildMctbConsentInboundTexml(forwardedFrom, {
    promptMode,
    gatherBasePath: "mctb-consent",
    certMode: input.certMode === "D" ? "D" : input.certMode,
    press1PlayUrl: input.profile.press1PlayUrl,
    press1SayText: null,
  });

  const gatherWithToken = appendRoutingTokenToGatherUrl(
    built.gatherActionUrl,
    input.profile.routingToken,
  );
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

/**
 * Synchronous TeXML — no DB. Uses setup-time routing profile (or fail-open).
 * Gather+Play/Say answers the PSTN leg as soon as Telnyx executes the response.
 */
export function buildInstantMctbInboundTexml(input: {
  profile: MctbInboundRoutingProfile;
  fields: Record<string, string>;
  certMode: ResolvedMctbTexmlCertMode;
}): InstantInboundTexml | null {
  if (!certModeForcesPress1Gather(input.certMode) && input.certMode !== "D") {
    return null;
  }

  // Cert B/B3/C/C3: always press-1 gather — no voicemail/automation DB branching before answer.
  if (certModeForcesPress1Gather(input.certMode)) {
    return buildInstantPress1GatherTexml(input);
  }

  const routeToVoicemailInitial = input.profile.consentMode === MCTB_CONSENT_MODE_EXISTING;
  const routeToVoicemail =
    routeToVoicemailInitial ||
    (!routeToVoicemailInitial && !input.profile.automationActive);

  if (routeToVoicemail) {
    const toE164 = input.profile.e164?.trim() || pickMctbTexmlField(input.fields, "To", "to", "Called");
    const built = buildInstantVoicemailTexml({
      toE164,
      greetingToken: input.profile.greetingToken,
      routingToken: input.profile.routingToken,
    });
    return {
      body: built.body,
      branch:
        input.profile.consentMode === MCTB_CONSENT_MODE_EXISTING
          ? "existing_consent"
          : "paused_voicemail",
      routingToken: built.routingToken,
      voicemailPlayUrl: built.playUrl,
    };
  }

  return buildInstantPress1GatherTexml({ ...input, certMode: "D" });
}
