import { isScriptEditorEnabledFromEnv } from '@/lib/features/script-editor-enabled'

/** Client + shared bundle: NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED (default off). */
export function isScriptEditorEnabled(): boolean {
  return isScriptEditorEnabledFromEnv({
    NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED: process.env.NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED,
    SCRIPT_EDITOR_ENABLED: process.env.SCRIPT_EDITOR_ENABLED,
  })
}
