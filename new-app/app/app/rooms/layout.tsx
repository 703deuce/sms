import { requireScriptEditorPageEnabled } from '@/lib/server/clips/require-script-editor-page'

export default function RoomsSectionLayout({ children }: { children: React.ReactNode }) {
  requireScriptEditorPageEnabled()
  return children
}
