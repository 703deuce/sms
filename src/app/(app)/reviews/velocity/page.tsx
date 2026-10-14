import { redirect } from "next/navigation";
import { REVIEW_ROUTES } from "@/lib/reviews/routes";

export default function ReviewsVelocityLegacyRedirect() {
  redirect(REVIEW_ROUTES.velocity);
}
