import { redirect } from "next/navigation";

/** A2P registration — use Transovo SMS compliance hub instead of LSE messaging wizard. */
export default function ReputationMessagingRedirect() {
  redirect("/compliance");
}
