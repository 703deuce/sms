import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Legacy route — number management lives in Phone & Forwarding drawers. */
export default function MctbNumbersLegacyPage() {
  redirect(`${MCTB_ROUTES.phone}?open=manage`);
}
