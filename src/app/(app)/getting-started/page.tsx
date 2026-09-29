import {
  deriveGettingStartedSteps,
} from "@/lib/compliance-helpers";
import {
  requireWorkspaceContext,
  loadComplianceOverview,
  loadDashboardMetrics,
  loadPhoneNumbers,
  loadContacts,
  loadTemplates,
  loadCampaigns,
} from "@/lib/workspace-data";
import { GettingStartedConnected } from "@/features/help/kimi/getting-started/getting-started-connected";
import { gettingStartedData, type GettingStartedData } from "@/components/help/kimi-ui/getting-started/types";
import { getPrisma } from "@/lib/db";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { MctbGettingStartedPage } from "@/newui-transplant/connected/mctb/mctb-getting-started-page";

function buildGettingStartedData(
  workspaceName: string,
  legacySteps: ReturnType<typeof deriveGettingStartedSteps>,
  messagingReady: boolean,
): GettingStartedData {
  const doneById = new Map(legacySteps.map((s) => [s.id, s.done]));
  const hrefById = new Map(legacySteps.map((s) => [s.id, s.href]));

  return {
    workspaceName,
    workspaceType: "Business",
    userRole: "OWNER",
    messagingStatus: messagingReady ? "READY" : "PENDING",
    steps: gettingStartedData.steps.map((step) => ({
      ...step,
      done: doneById.get(step.id) ?? step.done,
      href: hrefById.get(step.id) ?? step.href,
    })),
  };
}

export default async function GettingStartedPage() {
  if (isMctbV1Primary()) {
    return <MctbGettingStartedPage />;
  }

  const { workspaceId } = await requireWorkspaceContext();
  const workspace = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  const [overview, metrics, phoneNumbers, contacts, templates, campaigns] = await Promise.all([
    loadComplianceOverview(workspaceId),
    loadDashboardMetrics(workspaceId),
    loadPhoneNumbers(workspaceId),
    loadContacts(workspaceId),
    loadTemplates(workspaceId),
    loadCampaigns(workspaceId),
  ]);

  const legacySteps = deriveGettingStartedSteps({
    hasBusiness: Boolean(overview.registration?.legalBusinessName),
    hasPayment: metrics.balance > 0,
    a2pReady: overview.ready,
    hasNumber: phoneNumbers.length > 0 || Boolean(overview.registration?.phoneE164),
    contactCount: contacts.length,
    templateCount: templates.length,
    hasSentCampaign: campaigns.some((c) => c.sent > 0),
  });

  const data = buildGettingStartedData(
    workspace?.name || "your workspace",
    legacySteps,
    overview.ready,
  );

  return <GettingStartedConnected data={data} />;
}
