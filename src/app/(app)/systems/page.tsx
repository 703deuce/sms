import { redirect } from "next/navigation";

/** Compatibility alias — /systems redirects to /agents (Your Team). */
export default function SystemsAliasPage() {
  redirect("/agents");
}
