#!/usr/bin/env npx tsx
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, isMessagingSendAuthorized } from "@/lib/messaging/status";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";

const WS = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const reg = await getRegistrationByWorkspace(WS);
  const config = await loadMissedCallTextConfig(WS);
  const route = await resolveMctbOutboundSmsRoute({
    workspaceId: WS,
    config,
    demoMode: false,
  });
  const phoneAuth = config.smsPhoneNumberId
    ? await isPhoneAuthorizedForOutboundSms(config.smsPhoneNumberId)
    : null;
  console.log(
    JSON.stringify(
      {
        workspaceId: WS,
        registration: reg
          ? {
              phoneE164: reg.phoneE164,
              status: reg.status,
              messagingProvider: reg.messagingProvider,
              brandStatus: reg.brandStatus,
              campaignStatus: reg.campaignStatus,
            }
          : null,
        isMessagingReady: isMessagingReady(reg),
        isMessagingSendAuthorized: isMessagingSendAuthorized(reg),
        mctbRoute: route,
        smsPhoneAuth: phoneAuth,
      },
      null,
      2,
    ),
  );
}

main();
