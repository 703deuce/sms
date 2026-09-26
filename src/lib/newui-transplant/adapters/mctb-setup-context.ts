import { businessContextFromWorkspace } from "@/lib/newui-transplant/adapters/business-context";
import type { BusinessContext } from "@/newui-transplant/lib/view-models";

export type MctbSetupGetJson = {
  config?: {
    businessLineE164?: string | null;
    timezone?: string;
    messageTemplate?: string;
  };
  messaging?: {
    senderE164?: string | null;
    senderLabel?: string | null;
  };
};

export function businessContextFromMctbSetup(
  setup: MctbSetupGetJson,
  workspaceName: string,
): BusinessContext {
  return businessContextFromWorkspace({
    name: workspaceName,
    businessLineE164: setup.config?.businessLineE164,
    senderE164: setup.messaging?.senderE164 ?? setup.messaging?.senderLabel,
    timezone: setup.config?.timezone,
    website: null,
  });
}
