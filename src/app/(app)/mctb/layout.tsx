import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MctbLegacyShellStyles } from "./mctb-legacy-shell-styles";

export default function MctbProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {!isNewUiStage2Enabled() ? <MctbLegacyShellStyles /> : null}
      {children}
    </>
  );
}
