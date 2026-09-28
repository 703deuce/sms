import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MctbSetupPhoneView } from "@/components/mctb/setup/setup-phone-view";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default async function MctbSetupPhonePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  if (isNewUiStage2Enabled()) {
    redirect(resolveMctbSetupIaRedirect(MCTB_ROUTES.setupPhone, sp) ?? MCTB_ROUTES.phone);
  }
  return <MctbSetupPhoneView />;
}
