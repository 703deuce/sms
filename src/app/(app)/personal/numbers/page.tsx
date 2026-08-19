import { redirect } from "next/navigation";

/** My Numbers list is consolidated into Number Vault. */
export default function PersonalNumbersPage() {
  redirect("/personal/vault");
}
