export interface Macro {
  id: string
  label: string
  text: string
  hotkey?: string
}

export function applyMacro(macros: Macro[], id: string): string | null {
  return macros.find((m) => m.id === id)?.text ?? null
}

export function macroForHotkey(macros: Macro[], key: string): Macro | undefined {
  return macros.find((m) => m.hotkey === key)
}
