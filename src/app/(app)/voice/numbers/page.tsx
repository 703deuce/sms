import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceNumbersPage() {
  redirect(MCTB_ROUTES.numbers);
}
