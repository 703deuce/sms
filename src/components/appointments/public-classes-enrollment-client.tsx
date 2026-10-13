"use client";

import { Suspense } from "react";
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
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <PublicGroupEnrollmentClient
        slug={slug}
        businessName={businessName}
        offeringKind="class"
      />
    </Suspense>
  );
}
