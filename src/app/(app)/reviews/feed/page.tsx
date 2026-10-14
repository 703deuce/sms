import { redirect } from "next/navigation";
import { REVIEW_ROUTES } from "@/lib/reviews/routes";

export default function ReviewsFeedLegacyRedirect() {
  redirect(REVIEW_ROUTES.feed);
}
