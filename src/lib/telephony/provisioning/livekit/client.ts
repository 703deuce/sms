import { SipClient } from "livekit-server-sdk";
import { assertLiveKitProvisioningEnv } from "./config";

let sipClient: SipClient | null = null;

export function getLiveKitSipClient(): SipClient {
  if (!sipClient) {
    const { url, apiKey, apiSecret } = assertLiveKitProvisioningEnv();
    sipClient = new SipClient(url, apiKey, apiSecret);
  }
  return sipClient;
}

export function resetLiveKitSipClientForTests() {
  sipClient = null;
}
