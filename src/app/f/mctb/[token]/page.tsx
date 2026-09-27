import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MctbPublicRequestFormOpusPage } from "@/newui-transplant/connected/mctb/public-request-form-page";
import MctbPublicRequestFormLegacyPage from "./public-request-form-legacy";

export default async function MctbPublicRequestFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (isNewUiStage2Enabled()) {
    return <MctbPublicRequestFormOpusPage token={token} />;
  }
  return <MctbPublicRequestFormLegacyPage params={params} />;
}
