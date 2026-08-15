import { redirect } from "next/navigation";

/** Find a Number on Personal uses the same premium search product as Business. */
export default function PersonalFindNumberRedirect() {
  redirect("/personal/numbers/premium");
}
