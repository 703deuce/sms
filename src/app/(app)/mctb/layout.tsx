import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";

export default async function MctbProductLayout({ children }: { children: React.ReactNode }) {
  if (!isNewUiStage2Enabled()) {
    const { MctbLegacyShellStyles } = await import("./mctb-legacy-shell-styles");
    return (
      <>
        <MctbLegacyShellStyles />
        {children}
      </>
    );
  }
  return children;
}
