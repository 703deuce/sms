import { redirect } from "next/navigation";

/** Legacy agent list → canonical Receptionist home. APIs preserved under /api/voice/agents. */
export default function LegacyVoiceAgentsListPage() {
  redirect("/voice/receptionist");
}
