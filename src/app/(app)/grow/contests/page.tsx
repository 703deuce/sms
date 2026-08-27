import { redirect } from "next/navigation";

/** Contests removed from V1 — keywords remain the primary opt-in mechanic. */
export default function GrowContestsRedirect() {
  redirect("/grow/keywords");
}
