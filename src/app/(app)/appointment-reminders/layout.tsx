import { Suspense } from "react";

export default function AppointmentRemindersLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
