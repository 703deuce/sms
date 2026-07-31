import { Button } from "@/components/ui/button";
import { NewTemplateForm } from "@/components/templates/new-template-form";
import { PageHeader } from "@/components/ui/page-header";
import {
  loadRegistration,
  loadWorkspace,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NewTemplatePage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [workspace, registration] = await Promise.all([
    loadWorkspace(workspaceId),
    loadRegistration(workspaceId),
  ]);
  const businessName =
    registration?.legalBusinessName ||
    registration?.dbaName ||
    workspace?.name ||
    "Your Business";

  return (
    <div>
      <PageHeader
        title="Create template"
        description="Save a reusable message for campaigns, inbox replies, or automation steps."
        actions={
          <Link href="/templates">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </Link>
        }
      />
      <NewTemplateForm businessName={businessName} />
    </div>
  );
}
