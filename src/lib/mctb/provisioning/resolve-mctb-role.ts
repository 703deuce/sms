import "server-only";

import { getPlatformDemoPhoneRecord } from "@/lib/mctb/platform-demo-access";

/** Only the canonical shared platform-demo phone row uses platform_demo carrier role. */
export async function resolveMctbProvisionRole(input: {
  phoneNumberId: string;
}): Promise<"platform_demo" | "customer_mctb"> {
  const demo = await getPlatformDemoPhoneRecord();
  if (demo?.phoneNumberId === input.phoneNumberId) {
    return "platform_demo";
  }
  return "customer_mctb";
}
