/**
 * Stage 1 cert: count Telnyx HTTP calls during loadCallHandlingOwnershipState only.
 * Usage: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/newui-stage1-cert-provider-trace.ts [workspaceId]
 */
import * as telnyxClient from "@/lib/messaging/telnyx/client";
import { loadCallHandlingOwnershipState } from "@/lib/call-handling/ownership-state";
import { getPrisma } from "@/lib/db";
import { resolveDevAutoSession } from "@/lib/auth/dev-auto-session";

let telnyxCalls = 0;
const original = telnyxClient.telnyxRequest;
(telnyxClient as { telnyxRequest: typeof original }).telnyxRequest = async (...args) => {
  telnyxCalls += 1;
  console.error("UNEXPECTED_TELNYX_REQUEST", args[0]);
  return original(...args);
};

async function main() {
  const prisma = getPrisma();
  let workspaceId = process.argv[2]?.trim();
  if (!workspaceId) {
    process.env.DEV_AUTH_BYPASS = "1";
    const dev = await resolveDevAutoSession();
    workspaceId = dev?.workspaceId;
  }
  if (!workspaceId) {
    console.error("No workspaceId");
    process.exit(1);
  }

  telnyxCalls = 0;
  const state = await loadCallHandlingOwnershipState({ workspaceId });
  console.log(
    JSON.stringify(
      {
        workspaceId,
        telnyxCallsDuringLoad: telnyxCalls,
        hasState: Boolean(state),
        effectiveHandler: state?.effectiveHandler ?? null,
      },
      null,
      2,
    ),
  );
  process.exit(telnyxCalls > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
