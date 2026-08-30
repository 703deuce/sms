import "server-only";

import {
  buildMctbConsentInboundTexml,
  getMctbConsentPlaybackUrl,
  resolveMctbConsentTexmlPromptMode,
} from "@/lib/mctb/consent-prompt/texml-response";
import { routingTokenForE164 } from "@/lib/mctb/texml-ingress/routing-profile";
import { normalizeForwardedFromE164, parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";
import { pickMctbTexmlField } from "@/lib/mctb/texml-ingress/parse-texml-fields";

function parseForwardedFrom(fields: Record<string, string>): string {
  return (
    normalizeForwardedFromE164(pickMctbTexmlField(fields, "ForwardedFrom", "forwarded_from")) ||
    parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
    ""
  );
}

function appendRoutingTokenToGatherUrl(
  gatherActionUrl: string | null,
  routingToken: string,
): string | null {
  if (!gatherActionUrl || !routingToken) return gatherActionUrl;
  try {
    const url = new URL(gatherActionUrl);
    url.searchParams.set("r", routingToken);
    return url.toString();
  } catch {
    return gatherActionUrl;
  }
}

/**
 * Press-1 TeXML — zero DB, zero routing profile.
 * Platform standard audio + Gather; routing token on callback URL.
 */
export function buildInstantPress1Texml(input: {
  toE164: string;
  fields: Record<string, string>;
  routingToken?: string | null;
}): { body: string; routingToken: string; press1PlayUrl: string } {
  const routingToken = input.routingToken?.trim() || routingTokenForE164(input.toE164);
  const press1PlayUrl = getMctbConsentPlaybackUrl();
  const forwardedFrom = parseForwardedFrom(input.fields);

  const built = buildMctbConsentInboundTexml(forwardedFrom, {
    promptMode: resolveMctbConsentTexmlPromptMode("play-gather"),
    gatherBasePath: "mctb-consent",
    certMode: "D",
    press1PlayUrl,
    press1SayText: null,
  });

  const gatherWithToken = appendRoutingTokenToGatherUrl(built.gatherActionUrl, routingToken);
  const body =
    gatherWithToken && built.gatherActionUrl
      ? built.body.replace(built.gatherActionUrl, gatherWithToken)
      : built.body;

  return { body, routingToken, press1PlayUrl };
}
