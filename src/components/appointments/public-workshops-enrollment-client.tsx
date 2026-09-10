"use client";

import { PublicGroupEnrollmentClient } from "./public-group-enrollment-client";

/** Public workshop registration — Workshop labels, filtered API. */
export function PublicWorkshopsEnrollmentClient({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  return (
    <PublicGroupEnrollmentClient
      slug={slug}
      businessName={businessName}
      offeringKind="workshop"
    />
  );
}
