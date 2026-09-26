/**
 * Point Stage 2 app routes at connected (wired) pages instead of mirror sandbox pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "src/app/(app)");

const REPLACEMENTS = [
  {
    file: "voice/overview/page.tsx",
    transplant: "TransplantVoiceOverviewPage",
    connected: "NewUiVoiceOverviewPage",
    connectedPath: "@/newui-transplant/connected/voice/overview-page",
    stage2Body: `  const workspaceId = await getActiveWorkspaceId();
    const initialResult = await loadVoiceOverviewSummary(workspaceId);
    return <NewUiVoiceOverviewPage initial={initialResult} />;`,
  },
  {
    file: "voice/calls/page.tsx",
    transplant: "TransplantVoiceCallsPage",
    connected: "NewUiVoiceCallsPage",
    connectedPath: "@/newui-transplant/connected/voice/calls-page",
    stage2Body: `    return <NewUiVoiceCallsPage />;`,
  },
  {
    file: "voice/calls/[id]/page.tsx",
    transplant: "TransplantVoiceCallsIdPage",
    connected: "NewUiVoiceCallDetailPage",
    connectedPath: "@/newui-transplant/connected/voice/call-detail-page",
    stage2Body: `    return <NewUiVoiceCallDetailPage callId={id} />;`,
  },
  {
    file: "voice/analytics/page.tsx",
    transplant: "TransplantVoiceAnalyticsPage",
    connected: "NewUiVoiceAnalyticsPage",
    connectedPath: "@/newui-transplant/connected/voice/analytics-page",
    stage2Body: `    return <NewUiVoiceAnalyticsPage />;`,
  },
  {
    file: "voice/receptionist/page.tsx",
    transplant: "TransplantVoiceReceptionistPage",
    connected: "NewUiVoiceReceptionistPage",
    connectedPath: "@/newui-transplant/connected/voice/receptionist-page",
    stage2Body: `    return <NewUiVoiceReceptionistPage />;`,
  },
  {
    file: "voice/knowledge/page.tsx",
    transplant: "TransplantVoiceKnowledgePage",
    connected: "NewUiVoiceKnowledgePage",
    connectedPath: "@/newui-transplant/connected/voice/knowledge-page",
    stage2Body: `    return <NewUiVoiceKnowledgePage />;`,
  },
  {
    file: "voice/call-handling/page.tsx",
    transplant: "TransplantVoiceCallHandlingPage",
    connected: "NewUiVoiceCallHandlingPage",
    connectedPath: "@/newui-transplant/connected/voice/call-handling-page",
    stage2Body: `    return <NewUiVoiceCallHandlingPage />;`,
  },
  {
    file: "voice/numbers/page.tsx",
    transplant: "TransplantVoiceNumbersPage",
    connected: "NewUiVoiceNumbersPage",
    connectedPath: "@/newui-transplant/connected/voice/numbers-page",
    stage2Body: `    return <NewUiVoiceNumbersPage />;`,
  },
  {
    file: "mctb/page.tsx",
    transplant: "TransplantMctbPage",
    connected: "NewUiMctbOverviewPage",
    connectedPath: "@/newui-transplant/connected/mctb/overview-page",
    stage2Body: `  const { workspaceId } = await requireWorkspaceContext();
    const data = await loadMctbOverview(workspaceId);
    return <NewUiMctbOverviewPage data={data} />;`,
  },
  {
    file: "mctb/missed-calls/page.tsx",
    transplant: "TransplantMctbMissedCallsPage",
    connected: "NewUiMctbMissedCallsPage",
    connectedPath: "@/newui-transplant/connected/mctb/missed-calls-page",
    stage2Body: null,
  },
  {
    file: "mctb/missed-calls/[id]/page.tsx",
    transplant: "TransplantMctbMissedCallsIdPage",
    connected: "NewUiMctbMissedCallDetailPage",
    connectedPath: "@/newui-transplant/connected/mctb/missed-call-detail-page",
    stage2Body: `    return <NewUiMctbMissedCallDetailPage missedCallId={id} />;`,
  },
  {
    file: "mctb/conversations/page.tsx",
    transplant: "TransplantMctbConversationsPage",
    connected: "NewUiMctbConversationsPage",
    connectedPath: "@/newui-transplant/connected/mctb/conversations-page",
    stage2Body: null,
  },
  {
    file: "mctb/ai-recovery/page.tsx",
    transplant: "TransplantMctbAiRecoveryPage",
    connected: "NewUiMctbAiRecoveryPage",
    connectedPath: "@/newui-transplant/connected/mctb/ai-recovery-page",
    stage2Body: `    return <NewUiMctbAiRecoveryPage />;`,
  },
  {
    file: "mctb/voicemail/page.tsx",
    transplant: "TransplantMctbVoicemailPage",
    connected: "NewUiMctbVoicemailPage",
    connectedPath: "@/newui-transplant/connected/mctb/voicemail-page",
    stage2Body: `    return <NewUiMctbVoicemailPage />;`,
  },
  {
    file: "mctb/analytics/page.tsx",
    transplant: "TransplantMctbAnalyticsPage",
    connected: "NewUiMctbAnalyticsPage",
    connectedPath: "@/newui-transplant/connected/mctb/analytics-page",
    stage2Body: null,
  },
];

for (const r of REPLACEMENTS) {
  const full = path.join(APP, r.file);
  if (!fs.existsSync(full)) continue;
  let src = fs.readFileSync(full, "utf8");
  src = src.replace(
    /import \{ Transplant[^}]+\} from "@\/newui-transplant\/mirror\/routes\/[^"]+";?\n/g,
    "",
  );
  if (!src.includes(r.connected)) {
    const gate = `import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";`;
    src = src.replace(gate, `${gate}\nimport { ${r.connected} } from "${r.connectedPath}";`);
  }
  if (r.stage2Body) {
    src = src.replace(
      /if \(isNewUiStage2Enabled\(\)\) \{[\s\S]*?\n  \}/m,
      `if (isNewUiStage2Enabled()) {\n    ${r.stage2Body.trim()}\n  }`,
    );
  } else {
    src = src.replace(/return <Transplant[^>]+>[\s\S]*?\/>;/g, `return <${r.connected} />;`);
    src = src.replace(/Transplant[A-Za-z]+Page/g, r.connected);
  }
  fs.writeFileSync(full, src);
  console.log("updated", r.file);
}
