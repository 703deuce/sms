import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import {
  requireWorkspaceContext,
  loadTemplates,
} from "@/lib/workspace-data";
import Link from "next/link";

export default async function SavedRepliesPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const templates = await loadTemplates(workspaceId);
  const inboxReplies = templates.filter((t) => t.type === "Inbox reply");

  return (
    <div>
      <PageHeader
        title="Saved replies"
        description="Reusable conversation snippets your team can insert while replying to customers."
        actions={
          <>
            <Link href="/conversations">
              <Button variant="outline">Back to conversations</Button>
            </Link>
            <Link href="/templates/new">
              <Button>Create reply template</Button>
            </Link>
          </>
        }
      />

      {inboxReplies.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Category</TH>
              <TH>Preview</TH>
              <TH>Tags</TH>
              <TH>Shared</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {inboxReplies.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium">
                  <Link href={`/templates/${t.id}`} className="text-primary hover:underline">
                    {t.name}
                  </Link>
                </TD>
                <TD className="text-muted-foreground">{t.category}</TD>
                <TD className="max-w-md truncate text-muted-foreground">{t.body}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </TD>
                <TD>
                  <StatusChip status={t.shared ? "Active" : "Draft"} />
                </TD>
                <TD className="text-right">
                  <Link href={`/templates/${t.id}`} className="text-sm font-medium text-primary hover:underline">
                    Edit
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <Card className="text-center">
          <CardTitle>No saved replies yet</CardTitle>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create saved replies for common questions like estimates, scheduling, and follow-ups.
          </p>
          <Link href="/templates/new" className="mt-4 inline-flex">
            <Button>Create reply template</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
