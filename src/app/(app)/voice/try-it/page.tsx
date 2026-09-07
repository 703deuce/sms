import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceTryItPage() {
  redirect(MCTB_ROUTES.setupTest);
}
