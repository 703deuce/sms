/**
 * Point Stage 2 branches at exact Opus mirror pages without rewriting legacy paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "src/app/(app)");

const ROUTES = [
  ["voice/overview/page.tsx", "TransplantVoiceOverviewPage", "return <TransplantVoiceOverviewPage />;"],
  ["voice/calls/page.tsx", "TransplantVoiceCallsPage", "return <TransplantVoiceCallsPage />;"],
  ["voice/calls/[id]/page.tsx", "TransplantVoiceCallsIdPage", "return <TransplantVoiceCallsIdPage params={params} />;"],
  ["voice/analytics/page.tsx", "TransplantVoiceAnalyticsPage", "return <TransplantVoiceAnalyticsPage />;"],
  ["voice/receptionist/page.tsx", "TransplantVoiceReceptionistPage", "return <TransplantVoiceReceptionistPage />;"],
  ["voice/knowledge/page.tsx", "TransplantVoiceKnowledgePage", "return <TransplantVoiceKnowledgePage />;"],
  ["voice/call-handling/page.tsx", "TransplantVoiceCallHandlingPage", "return <TransplantVoiceCallHandlingPage />;"],
  ["voice/numbers/page.tsx", "TransplantVoiceNumbersPage", "return <TransplantVoiceNumbersPage />;"],
  ["mctb/page.tsx", "TransplantMctbPage", "return <TransplantMctbPage />;"],
  ["mctb/missed-calls/page.tsx", "TransplantMctbMissedCallsPage", "return <TransplantMctbMissedCallsPage />;"],
  ["mctb/missed-calls/[id]/page.tsx", "TransplantMctbMissedCallsIdPage", "return <TransplantMctbMissedCallsIdPage params={params} />;"],
  ["mctb/conversations/page.tsx", "TransplantMctbConversationsPage", "return <TransplantMctbConversationsPage searchParams={searchParams} />;"],
  ["mctb/ai-recovery/page.tsx", "TransplantMctbAiRecoveryPage", "return <TransplantMctbAiRecoveryPage />;"],
  ["mctb/voicemail/page.tsx", "TransplantMctbVoicemailPage", "return <TransplantMctbVoicemailPage />;"],
  ["mctb/analytics/page.tsx", "TransplantMctbAnalyticsPage", "return <TransplantMctbAnalyticsPage />;"],
  ["mctb/setup/page.tsx", "TransplantMctbSetupPage", "return <TransplantMctbSetupPage />;"],
  ["mctb/setup/phone/page.tsx", "TransplantMctbSetupPhonePage", "return <TransplantMctbSetupPhonePage />;"],
  ["mctb/setup/consent/page.tsx", "TransplantMctbSetupConsentPage", "return <TransplantMctbSetupConsentPage />;"],
  ["mctb/setup/text-back/page.tsx", "TransplantMctbSetupTextBackPage", "return <TransplantMctbSetupTextBackPage />;"],
  ["mctb/setup/exclusions/page.tsx", "TransplantMctbSetupExclusionsPage", "return <TransplantMctbSetupExclusionsPage />;"],
  ["mctb/setup/recovery/page.tsx", "TransplantMctbSetupRecoveryPage", "return <TransplantMctbSetupRecoveryPage />;"],
  ["mctb/setup/voicemail/page.tsx", "TransplantMctbSetupVoicemailPage", "return <TransplantMctbSetupVoicemailPage />;"],
  ["mctb/setup/notifications/page.tsx", "TransplantMctbSetupNotificationsPage", "return <TransplantMctbSetupNotificationsPage />;"],
  ["mctb/setup/links/page.tsx", "TransplantMctbSetupLinksPage", "return <TransplantMctbSetupLinksPage />;"],
  ["mctb/setup/test/page.tsx", "TransplantMctbSetupTestPage", "return <TransplantMctbSetupTestPage />;"],
];

function mirrorImport(rel, exportName) {
  const routePath = rel.replace(/\/page\.tsx$/, "");
  return `import { ${exportName} } from "@/newui-transplant/mirror/routes/${routePath}/page";`;
}

for (const [rel, exportName, stage2Line] of ROUTES) {
  const file = path.join(APP, rel);
  if (!fs.existsSync(file)) {
    console.warn("missing", rel);
    continue;
  }
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(/import \{[^}]*\} from "@\/newui-transplant\/connected\/[^"]+";?\n/g, "");
  src = src.replace(/import \{ mapMctbMissedCallsListToNewUi \}[^\n]+\n/g, "");

  const imp = mirrorImport(rel, exportName);
  if (!src.includes(exportName)) {
    const anchor = `import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";`;
    if (src.includes(anchor)) {
      src = src.replace(anchor, `${anchor}\n${imp}`);
    } else {
      src = `${imp}\n${src}`;
    }
  }

  src = src.replace(/return <NewUi[A-Za-z0-9]+[^;]*;/g, stage2Line);
  src = src.replace(
    /if \(isNewUiStage2Enabled\(\)\) \{[\s\S]*?\n  \}/m,
    `if (isNewUiStage2Enabled()) {\n    ${stage2Line}\n  }`,
  );

  fs.writeFileSync(file, src);
  console.log("ok", rel);
}
