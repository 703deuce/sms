import { syncWorkspaceCalendarConnection } from "@/lib/calendar/import-sync";
import { ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";

const ws = process.env.WORKSPACE_ID || "ws_1";
const connId = process.env.CONNECTION_ID || "cmu1uq7f15s1o5s4f6c5b6a57";

async function main() {
  const sub = await ensureMicrosoftCalendarSubscription(ws, connId);
  console.log("subscription after ensure:", sub);
  const stats = await syncWorkspaceCalendarConnection(ws, connId, {
    incremental: false,
    manual: true,
  });
  console.log("sync stats:", stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
