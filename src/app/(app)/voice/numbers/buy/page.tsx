import { redirect } from "next/navigation";

/** Canonical standard number purchase lives at /numbers/buy. */
export default function VoiceBuyNumbersPage() {
  redirect("/numbers/buy");
}
