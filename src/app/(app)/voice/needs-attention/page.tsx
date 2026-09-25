import { redirect } from "next/navigation";

/** Legacy route — Voice attention work lives on Calls. */
export default function VoiceNeedsAttentionRedirectPage() {
  redirect("/voice/calls?attention=open");
}
