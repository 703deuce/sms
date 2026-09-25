import { redirect } from "next/navigation";

/** Legacy stub — operational call behavior lives on Call Handling. */
export default function VoiceOperationsPage() {
  redirect("/voice/call-handling");
}
