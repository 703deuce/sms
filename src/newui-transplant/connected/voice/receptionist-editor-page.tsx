"use client";

import { useVoiceReceptionistEditor } from "@/lib/voice/receptionist/use-voice-receptionist-editor";
import { ReceptionistEditorOpus } from "./receptionist-editor/receptionist-editor-opus";

export function NewUiVoiceReceptionistEditorPage() {
  const editor = useVoiceReceptionistEditor();
  return <ReceptionistEditorOpus editor={editor} />;
}
