import { getIntegrationAppUrl } from "@/lib/integrations/framework/app-url";

export function getAppBaseUrl(): string {
  return getIntegrationAppUrl();
}
