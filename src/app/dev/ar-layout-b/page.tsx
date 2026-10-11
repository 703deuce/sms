import { notFound } from "next/navigation";
import { AppointmentRemindersCalendarWorkspacePage } from "@/newui-transplant/connected/appointment-reminders/ar-calendar-workspace-page";

export default function DevArLayoutBPreviewPage() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_AR_LAYOUT_B_PREVIEW !== "1") {
    notFound();
  }
  return <AppointmentRemindersCalendarWorkspacePage />;
}
