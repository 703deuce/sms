import { BrandingSettingsForm } from "@/components/settings/branding-settings-form";
import { loadWorkspace, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function SettingsBrandingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const workspace = (await loadWorkspace(workspaceId)) as
    | (Record<string, unknown> & { name?: string })
    | null;

  return (
    <BrandingSettingsForm
      workspaceName={(workspace?.name as string) || ""}
      initial={{
        displayName: (workspace?.displayName as string) || "",
        logoUrl: (workspace?.logoUrl as string) || "",
        primaryColor: (workspace?.primaryColor as string) || "#0f766e",
        accentColor: (workspace?.accentColor as string) || "#0ea5e9",
        shortLinkDomain: (workspace?.shortLinkDomain as string) || "",
        formTheme: (workspace?.formTheme as string) || "light",
        reviewLinkUrl: (workspace?.reviewLinkUrl as string) || "",
      }}
    />
  );
}
