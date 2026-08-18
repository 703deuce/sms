import { decryptSecret } from "@/lib/messaging/crypto";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { getTwilioParentCredentials, isLiveMessagingAdapter, getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getPrisma } from "@/lib/db";

/** Twilio signs the public webhook URL — not the internal container URL from request.url. */
export function resolveTwilioWebhookRequestUrl(request: Request): string {
  const incoming = new URL(request.url);
  const path = `${incoming.pathname}${incoming.search}`;
  const base = getAppBaseUrl().replace(/\/$/, "");
  if (base && !base.includes("localhost")) {
    return `${base}${path}`;
  }
  return request.url;
}

export async function verifyTwilioVoiceWebhookSignature(
  request: Request,
  params: Record<string, string>,
  toE164?: string,
): Promise<boolean> {
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    if (process.env.NODE_ENV === "production") return false;
    if (isLiveMessagingAdapter()) return false;
    return true;
  }

  const tokens: string[] = [];
  const to = toE164 || params.To;
  if (to) {
    const prisma = getPrisma();
    const normalized = normalizeE164(to);
    const pn = await prisma.phoneNumber.findFirst({
      where: { e164: normalized, releasedAt: null },
      select: { workspaceId: true },
    });
    if (pn) {
      const reg = await getRegistrationByWorkspace(pn.workspaceId);
      if (reg?.subaccountAuthTokenEnc) {
        try {
          tokens.push(decryptSecret(reg.subaccountAuthTokenEnc));
        } catch {
          // ignore decrypt errors
        }
      }
    }
  }

  const parent = getTwilioParentCredentials().authToken;
  if (parent) tokens.push(parent);
  if (!tokens.length) return process.env.NODE_ENV !== "production";

  const validationUrl = resolveTwilioWebhookRequestUrl(request);
  return tokens.some((token) => validateTwilioSignature(token, signature, validationUrl, params));
}
