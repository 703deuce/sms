import { redirect } from "next/navigation";

export default async function ReputationIndexPage() {
  redirect("/reviews/overview");
}
