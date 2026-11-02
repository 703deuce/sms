#!/usr/bin/env node
/**
 * Ensures prod clip editor (EditorShell + panels) exposes hand-tested features
 * instead of leaving them only under flag-gated script-editor.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clipEditor = join(root, 'components/clips/editor')
const clipsComponents = join(root, 'components/clips')

function readClip(rel) {
  if (rel.startsWith('../')) {
    return readFileSync(join(clipsComponents, rel.replace(/^\.\.\//, '')), 'utf8')
  }
  return readFileSync(join(clipEditor, rel), 'utf8')
}

const MOUNTS = [
  { name: 'Edit for clarity', testId: 'clarity-run', inFiles: ['cleanup-panel.tsx'] },
  { name: 'Remove retakes', testId: 'retake-run', inFiles: ['cleanup-panel.tsx'] },
  { name: 'Apply all clarity (single undo)', marker: "applyAllOfKind('clarity')", inFiles: ['cleanup-panel.tsx'] },
  { name: 'Music, SFX & mix', testId: 'audio-music-sfx-mix', inFiles: ['audio-panel.tsx'] },
  { name: 'Music suggest', testId: 'audio-music-suggest', inFiles: ['audio-panel.tsx'] },
  { name: 'SFX Kenney badge', testId: 'stock-sfx-license-badge', inFiles: ['stock-audio-picker.tsx'] },
  { name: 'Cut to beat (audio panel)', testId: 'audio-beat-cut', inFiles: ['beat-cut-controls.tsx', 'audio-panel.tsx'] },
  { name: 'AI voiceover (text to speech)', testId: 'audio-panel-ai-voiceover', inFiles: ['audio-panel.tsx'] },
  { name: 'Record AI voiceover menu', testId: 'record-ai-voiceover', inFiles: ['recording/record-menu.tsx'] },
  { name: 'Export share from dialog', testId: 'export-share-open-dialog', inFiles: ['export-dialog.tsx'] },
  { name: 'Export NLE zip', testId: 'export-xml-download', inFiles: ['export-dialog.tsx'] },
  { name: 'Export stems (visible)', testId: 'export-stems-main', inFiles: ['export-dialog.tsx'] },
]

const errors = []

for (const m of MOUNTS) {
  const found = m.inFiles.some((f) => {
    const src = readClip(f)
    if (m.testId) return src.includes(`data-testid="${m.testId}"`)
    if (m.marker) return src.includes(m.marker)
    return false
  })
  if (!found) errors.push(`${m.name}: missing in ${m.inFiles.join(', ')}`)
}

const shellSrc = readClip('editor-shell.tsx')
if (!shellSrc.includes('onOpenAiVoiceover')) {
  errors.push('editor-shell.tsx: wire Record menu AI voiceover (onOpenAiVoiceover)')
}
const forbiddenShellImports = [
  'script-clarity-panel',
  'script-retakes-panel',
  'timeline-music-lane',
  'share-clip-viewer',
]
for (const frag of forbiddenShellImports) {
  if (shellSrc.includes(frag)) errors.push(`editor-shell.tsx imports script-editor-only ${frag}`)
}

if (errors.length) {
  console.error('verify-clip-editor-feature-parity failed:\n' + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}

console.log('verify-clip-editor-feature-parity: OK')
