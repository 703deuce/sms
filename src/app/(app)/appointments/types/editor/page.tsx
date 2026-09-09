import { Suspense } from "react";
import { BookingTypesEditorClient } from "@/components/appointments/booking-types/booking-types-editor-client";

export default function BookingTypesEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-[#f7f8fb]" aria-busy="true" />}>
      <BookingTypesEditorClient />
    </Suspense>
  );
}
