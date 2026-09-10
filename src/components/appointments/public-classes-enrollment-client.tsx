"use client";

import { PublicGroupEnrollmentClient } from "./public-group-enrollment-client";

/** Public class registration — uses workshop-independent labels and API filter. */
export function PublicClassesEnrollmentClient({
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
      offeringKind="class"
    />
  );
}
