import { EmptyState } from "@/components/ui/empty-state";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadContactById } from "@/lib/workspace-data";
import { ContactDetailConnected } from "@/features/contacts/kimi/contact-detail/contact-detail-connected";
import { UserX } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <EmptyState
        title="No workspace selected"
        description="Select or create a workspace to view this contact."
      />
    );
  }

  const contact = await loadContactById(workspaceId, id);

  if (!contact) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col justify-center py-8">
        <Link
          href="/contacts"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to contacts
        </Link>
        <EmptyState
          icon={<UserX className="h-5 w-5" />}
          title="Contact not found"
          description="This contact may have been deleted, or it belongs to a different workspace."
          actionLabel="Back to contacts"
          actionHref="/contacts"
        />
      </div>
    );
  }

  return <ContactDetailConnected contact={contact} />;
}
