"use client";

import { TransplantVoiceCallHandlingPage } from "@/newui-transplant/mirror/routes/voice/call-handling/page";

/** Call-handling Opus controls map partially to `/api/call-handling` ownership; full transfer UI remains Opus-presentational until dedicated APIs are exposed. */
export function NewUiVoiceCallHandlingPage() {
  return <TransplantVoiceCallHandlingPage />;
}
