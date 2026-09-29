import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { MctbHelpPage } from "@/newui-transplant/connected/mctb/mctb-help-page";
import { redirect } from "next/navigation";

export default function HelpPage() {
  if (isMctbV1Primary()) {
    return <MctbHelpPage />;
  }
  redirect("/getting-started");
}
