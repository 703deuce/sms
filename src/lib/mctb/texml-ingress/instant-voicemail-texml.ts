import "server-only";

import {
  buildMctbVoicemailGreetingTexml,
  getMctbTexmlVoicemailRecordCallbackUrl,
} from "@/lib/mctb/consent-prompt/texml-response";
import {
  greetingTokenForE164,
  resolveStableVoicemailGreetingPlayUrl,
} from "@/lib/phone/voicemail-active-greeting";
import { routingTokenForE164 } from "@/lib/mctb/texml-ingress/routing-profile";

function recordCallbackWithRoutingToken(routingToken: string): string {
  const url = new URL(getMctbTexmlVoicemailRecordCallbackUrl());
  url.searchParams.set("r", routingToken);
  return url.toString();
}

/**
 * Voicemail TeXML — zero DB, zero in-memory routing profile.
 * Play URL derived only from e164 (or explicit g= query param).
 */
export function buildInstantVoicemailTexml(input: {
  toE164: string;
  greetingToken?: string | null;
  routingToken?: string | null;
}): { body: string; greetingToken: string; routingToken: string; playUrl: string } {
  const greetingToken = input.greetingToken?.trim() || greetingTokenForE164(input.toE164);
  const routingToken = input.routingToken?.trim() || routingTokenForE164(input.toE164);
  const playUrl = resolveStableVoicemailGreetingPlayUrl(greetingToken);
  const body = buildMctbVoicemailGreetingTexml({
    playUrl,
    sayText: null,
    recordCallbackUrl: recordCallbackWithRoutingToken(routingToken),
  });
  return { body, greetingToken, routingToken, playUrl };
}
