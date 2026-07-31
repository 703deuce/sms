import { FieldsManager } from "@/components/contacts/fields-manager";
import { parseCustomFieldsConfig } from "@/lib/contacts/custom-fields";
import { getPrisma } from "@/lib/db";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function ContactFieldsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const workspace = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const fields = parseCustomFieldsConfig(workspace?.customFieldsConfig);

  return <FieldsManager initialFields={fields} />;
}
