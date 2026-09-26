import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "src/app/(app)");

const MAP = {
  "voice/calls/page.tsx": {
    imp: `import { NewUiVoiceCallsPage } from "@/newui-transplant/connected/voice/calls-page";`,
    ret: `return <NewUiVoiceCallsPage />;`,
  },
  "voice/calls/[id]/page.tsx": {
    imp: `import { NewUiVoiceCallDetailPage } from "@/newui-transplant/connected/voice/call-detail-page";`,
    ret: `return <NewUiVoiceCallDetailPage callId={id} />;`,
  },
  "voice/analytics/page.tsx": {
    imp: `import { NewUiVoiceAnalyticsPage } from "@/newui-transplant/connected/voice/analytics-page";`,
    ret: `return <NewUiVoiceAnalyticsPage />;`,
  },
  "voice/receptionist/page.tsx": {
    imp: `import { NewUiVoiceReceptionistPage } from "@/newui-transplant/connected/voice/receptionist-page";`,
    ret: `return <NewUiVoiceReceptionistPage />;`,
  },
  "voice/knowledge/page.tsx": {
    imp: `import { NewUiVoiceKnowledgePage } from "@/newui-transplant/connected/voice/knowledge-page";`,
    ret: `return <NewUiVoiceKnowledgePage />;`,
  },
  "voice/call-handling/page.tsx": {
    imp: `import { NewUiVoiceCallHandlingPage } from "@/newui-transplant/connected/voice/call-handling-page";`,
    ret: `return <NewUiVoiceCallHandlingPage />;`,
  },
  "voice/numbers/page.tsx": {
    imp: `import { NewUiVoiceNumbersPage } from "@/newui-transplant/connected/voice/numbers-page";`,
    ret: `return <NewUiVoiceNumbersPage />;`,
  },
  "mctb/page.tsx": {
    imp: `import { NewUiMctbOverviewPage } from "@/newui-transplant/connected/mctb/overview-page";`,
    ret: `return <NewUiMctbOverviewPage data={data} />;`,
    extra: `const { workspaceId } = await requireWorkspaceContext();\n    const data = await loadMctbOverview(workspaceId);`,
  },
  "mctb/missed-calls/page.tsx": {
    imp: `import { NewUiMctbMissedCallsPage } from "@/newui-transplant/connected/mctb/missed-calls-page";`,
    ret: `return <NewUiMctbMissedCallsPage />;`,
  },
  "mctb/missed-calls/[id]/page.tsx": {
    imp: `import { NewUiMctbMissedCallDetailPage } from "@/newui-transplant/connected/mctb/missed-call-detail-page";`,
    ret: `return <NewUiMctbMissedCallDetailPage eventId={id} />;`,
  },
  "mctb/conversations/page.tsx": {
    imp: `import { NewUiMctbConversationsPage } from "@/newui-transplant/connected/mctb/conversations-page";`,
    ret: `return <NewUiMctbConversationsPage initialConversationId={initialConversationId} initialFilter={initialFilter} />;`,
    extra: `const params = await searchParams;
    const initialConversationId = typeof params.conversation === "string" ? params.conversation : undefined;
    const initialFilter = params.filter === "needs_reply" ? "Needs reply" : "All";`,
  },
  "mctb/analytics/page.tsx": {
    imp: `import { NewUiMctbAnalyticsPage } from "@/newui-transplant/connected/mctb/analytics-page";`,
    ret: `return <NewUiMctbAnalyticsPage initialData={initialData} initialRange={range} />;`,
    extra: `const params = await searchParams;
    const range = parseRange(params.range);
    const initialData = await loadMctbAnalytics(workspaceId, range);`,
  },
  "mctb/page.tsx": {
    imp: `import { NewUiMctbOverviewPage } from "@/newui-transplant/connected/mctb/overview-page";`,
    ret: `return <NewUiMctbOverviewPage data={data} />;`,
    extra: `const data = await loadMctbOverview(workspaceId);`,
  },
  "mctb/voicemail/page.tsx": {
    imp: `import { NewUiMctbVoicemailPage } from "@/newui-transplant/connected/mctb/voicemail-page";`,
    ret: `return <NewUiMctbVoicemailPage numberId={numberId} />;`,
    extra: `const { numberId } = await searchParams;`,
  },
  "mctb/ai-recovery/page.tsx": {
    imp: `import { NewUiMctbAiRecoveryPage } from "@/newui-transplant/connected/mctb/ai-recovery-page";`,
    ret: `return <NewUiMctbAiRecoveryPage />;`,
  },
  "mctb/voicemail/page.tsx": {
    imp: `import { NewUiMctbVoicemailPage } from "@/newui-transplant/connected/mctb/voicemail-page";`,
    ret: `return <NewUiMctbVoicemailPage />;`,
  },
  "mctb/setup/page.tsx": {
    imp: `import { NewUiMctbSetupOverviewPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupOverviewPage />;`,
  },
  "mctb/setup/phone/page.tsx": {
    imp: `import { NewUiMctbSetupPhonePage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupPhonePage />;`,
  },
  "mctb/setup/consent/page.tsx": {
    imp: `import { NewUiMctbSetupConsentPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupConsentPage />;`,
  },
  "mctb/setup/text-back/page.tsx": {
    imp: `import { NewUiMctbSetupTextBackPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupTextBackPage workspaceName={session.name ?? "Workspace"} />;`,
    extra: `const { session } = await requireWorkspaceContext();`,
  },
  "mctb/setup/exclusions/page.tsx": {
    imp: `import { NewUiMctbSetupExclusionsPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupExclusionsPage />;`,
  },
  "mctb/setup/recovery/page.tsx": {
    imp: `import { NewUiMctbSetupRecoveryPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupRecoveryPage />;`,
  },
  "mctb/setup/voicemail/page.tsx": {
    imp: `import { NewUiMctbSetupVoicemailPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupVoicemailPage />;`,
  },
  "mctb/setup/notifications/page.tsx": {
    imp: `import { NewUiMctbSetupNotificationsPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupNotificationsPage />;`,
  },
  "mctb/setup/links/page.tsx": {
    imp: `import { NewUiMctbSetupLinksPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupLinksPage />;`,
  },
  "mctb/setup/test/page.tsx": {
    imp: `import { NewUiMctbSetupTestPage } from "@/newui-transplant/connected/mctb/setup-pages";`,
    ret: `return <NewUiMctbSetupTestPage />;`,
  },
};

for (const [rel, cfg] of Object.entries(MAP)) {
  const file = path.join(APP, rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(/import \{ Transplant[^}]+\} from "@\/newui-transplant\/mirror\/routes\/[^"]+";?\n/g, "");
  if (!src.includes(cfg.imp.split(" ")[2])) {
    src = src.replace(
      /import \{ isNewUiStage2Enabled \}[^\n]+\n/,
      `import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";\n${cfg.imp}\n`,
    );
  }
  const body = cfg.extra ? `${cfg.extra}\n    ${cfg.ret}` : cfg.ret;
  src = src.replace(/if \(isNewUiStage2Enabled\(\)\) \{[\s\S]*?\n  \}/m, `if (isNewUiStage2Enabled()) {\n    ${body}\n  }`);
  fs.writeFileSync(file, src);
  console.log("wired", rel);
}
