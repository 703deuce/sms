import { redirect } from "next/navigation";

export default function RealtorNeedsAttentionRedirect() {
  redirect("/realtor/leads/needs-attention");
}
