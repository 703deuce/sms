import { Suspense } from "react";
import { KimiFieldsConnected } from "@/components/contacts/kimi-fields-connected";
import { parseCustomFieldsConfig } from "@/lib/contacts/custom-fields";
import { getPrisma } from "@/lib/db";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function ContactsFieldsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const workspace = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const initialFields = parseCustomFieldsConfig(workspace?.customFieldsConfig);

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-contacts-fields">
        <KimiFieldsConnected initialFields={initialFields} />
      </div>
    </Suspense>
  );
}
