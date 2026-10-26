# Transovo Clips: UI polish spec (restyle only)

**Status:** ready for a Cursor cloud agent · **Repo:** `703deuce/sms` · **App:** `new-app/` (Next.js 16.4.3, React 19, Tailwind v4, shadcn `base-nova` on `@base-ui/react`) · **Written:** Mon Oct 26 2026 (America/New_York)

> **Goal (from Rick):** "This looks so simple. The pages look cookie cutter, there's no icons, there's no design." Get every existing Clips page to a premium creative-tool look in the style of Opus Clip, Descript and CapCut web, **before** any Descript feature work starts.
>
> **Hard rule: RESTYLE ONLY.** Every handler, fetch, prop, reducer action, API route, polling loop and keyboard shortcut stays exactly as it is. See §12 (no-regression contract). The only behavioural additions allowed are the ones marked **[DATA-WIRE]**. Each one reads data through an existing server function or route and changes no data flow.

---

## 0. TL;DR for the agent
1. Work on a branch: `git checkout -b ui/polish-v1 master`.
2. Do the commits in §13, in that order. Each commit is small and has a browser checklist. Run `pnpm -C new-app typecheck && pnpm -C new-app test` before every commit.
3. Tokens are in §3, the shell is in §5, the shared components are in §6 and the page specs are in §7–§10.
4. Do **not** touch `prisma/`, `app/api/**`, `lib/server/**`, `lib/clips/**` (except the read-only imports listed), or `worker/**`.
5. Dark mode is the default. A light mode is available from a toggle in the top bar, via `next-themes`, which is already installed.

---

## 1. Inventory: routes, components and weaknesses (as of `master` today)

Screenshots of the current state are in `/workspace/plan/ui_before/` (1024×640 viewport, light theme). The filenames are listed in §1.9.

### 1.1 App shell
| File | What it does now | Weaknesses |
|---|---|---|
| `app/layout.tsx` | Loads Geist and Geist_Mono with `next/font/google`, then **discards them** (`const _geist = Geist(...)` is never applied). Sets `viewport.colorScheme:'light'` and `themeColor:'#f8f9fb'`. Metadata is still the SMS-era copy ("Transovo business communications…", `generator: 'v0.app'`). | The font never loads, because `globals.css` sets `--font-sans: 'Geist'` literally and next/font hashes the family name, so it falls back to the system font. Light mode is forced. The metadata is stale. |
| `app/app/layout.tsx` → `components/shell/app-shell.tsx` | `AppHeader` (h-16), a sticky `aside` holding `SidebarNav` (compact `w-20` / expanded `w-60`, `expanded` defaults to false), and a mobile `Sheet` (w-64). Wrapped in `ShellContextProvider` and `ClipsWorkspaceProvider`. | The sidebar is a hand-rolled copy of a shadcn sidebar: no tooltips in compact mode, labels truncate to "Brand tem…", and there is no keyboard shortcut. The rail-plus-tiny-label pattern looks like an admin panel. |
| `components/shell/app-header.tsx` | Logo tile "Transovo Clips", workspace name "Harbor & Pine", a "Clips" tab, `GlobalSearch`, a "Test mode · all features unlocked" pill, a New project button, plug/settings/help/bell/avatar icons. | Too many equal-weight icons. There are no breadcrumbs, so deep pages have no location cue. The "Clips" tab with only one tab is noise. The test-mode pill is grey and indistinct. |
| `components/shell/sidebar-nav.tsx` + `lib/nav.ts` | `CLIPS` context has: Projects (`Clapperboard`, group Create), New project (`Upload`, Create), Brand template (`Palette`, Customize), Exports (`Download`, Library). Exports uses `ClipsExportsSidebarLink`. | Groups don't match the product (Brand sits under "Customize"). There is no Record item, no Editor/Voice placeholders, no count badges and no active indicator besides the bg. |

### 1.2 `/app` and `/app/home`
- `app/app/page.tsx` and `app/app/home/page.tsx` (112 B): a redirect to `/app/clips`. Screenshot: `home.png`, which shows the Projects page.
- **Weakness:** there is no dashboard. The old app had one (`pre-clips-cleanup:new-app/app/app/home/page.tsx`, 5 KB) with `Stat` tiles, product cards and a checklist. The polish keeps the redirect. **Do not build a home dashboard in this pass.** Its Clips replacement is the Projects page header strip in §7.1.

### 1.3 `/app/clips` (Projects)
- `app/app/clips/page.tsx` renders `Page` + `PageHeader` + `EmptyState(icon=Upload)` only.
- **BUG (non-styling): the page never lists projects.** It is hard-coded to an empty state even when projects exist (`projects.png` and `projects_delayed.png` show "No projects yet" while `/app/clips/proj_87fe33…` exists). **[DATA-WIRE-1]** Wire it to the existing `listClipProjects(workspaceId, {limit:50})` in `lib/server/clips/projects.ts`, the same way `[projectId]/page.tsx` already uses `resolveWorkspaceId()`. This adds no new API, migration or handler.
- Other weaknesses: no grid, no thumbnails, no status, no search or filter.

### 1.4 `/app/clips/new` (New project)
- `app/app/clips/new/page.tsx` → `components/clips/new-project-workspace.tsx`, which uses `Dropzone`, `UploadProgressItem`, `ProjectSettingsForm` (Mode & genre, Clip length, Layout & aspect) and the Get clips `Button`. Uploads use `uploadClipFile` (tus) with `cancelClipUpload`, `probeDuration` and `estimateCredits`, then `createProject` → `router.push`.
- Screenshots: `new.png` and `mobile_new.png`.
- Weaknesses:
  - The dropzone is a flat dashed box with a gradient tile. It has no drag-over state, no file-type and size hint, and no link-paste tab. F1 (link import) needs a link tab.
  - The settings are text-only option buttons with no icons, previews or aspect-ratio glyphs.
  - The estimate is grey micro-text.
  - The primary CTA is a plain full-width button with no sticky footer.

### 1.5 `/app/clips/[projectId]` (Project detail, processing and clips grid)
- `page.tsx` (server: `resolveWorkspaceId` + `prisma.clipProject.findFirst` + `listProjectClips(...,'score')`) → `components/clips/project-clips-view.tsx`, which uses `JobStatus` (polls `getProjectStatus` every 4 s) and `ProjectResults` (clip grid, export / export-all, sort).
- `JobStatus` uses `Panel`, `StatusBadge`, `StepRail` (steps Upload, Transcribe, Scan scenes, Find clips, Reframe & caption, Ready), `Progress` and Cancel processing.
- `ClipCard` has a 9:16 `<video>` with hover-play (POST event `preview_play`), a `ScoreBadge`, Hook/Flow/Value/Trend grade chips, a reason, and the buttons Edit (`render={<Link/>}`) / Download / Make thumbnail (POST `/api/clips/clips/{id}/thumbnail {aspect:'9:16'}`).
- Screenshots: `project.png` (failed: "Processing failed: The system is experiencing heavy traffic" as plain red text), `project_87fe33.png` (1 clip) and `project_5a5610.png`.
- Weaknesses:
  - The failure state has no icon, retry or explanation styling.
  - The stepper is a generic rail.
  - The score is a flat pill, not a ring.
  - There is no duration chip on the thumbnail.
  - The three equal-weight buttons make the card cluttered.
  - The source time range is shown as a raw string.

### 1.6 `/app/clips/[projectId]/edit/[clipId]` (Editor)
- `page.tsx` → `components/clips/editor/editor-shell.tsx` (413 lines).
- Its hooks:
  - `useEditorState` returns edits, undo, redo, canUndo, canRedo, saveState, addCutRange, setWordFix, restoreWord, setLayoutMode, setShotOverride, setTrim, setCaptions, toggleEmphasis, mergeBroll, removeBroll, updateBrollItem, attachMusicGeneration, patchMusic, setMusic, addSfx, updateSfx, removeSfx, setEdits, applyProducerPatch and flushSave.
  - Also `useGeneration`, `useDubPreview` and `useAudioMix`.
  - Keyboard: Space; ←/→ for ±1 s; Backspace/Delete to cut the selection; ⌘Z and ⇧⌘Z. The title autosaves via `patchClip` after 800 ms.
- Layout: `flex h-[calc(100dvh-4rem)] flex-col`, then `EditorTopBar`, then a grid of `[PreviewStage + PlayerControls + Timeline] | aside 400px Tabs defaultValue="transcript"`.
- **9 tabs**, all text-only `TabsTrigger`s, which overflow horizontally at 400 px (see `editor_export_dialog.png`, where the tab bar is scrolled to "…Layout Captions B-roll Audio Thumbnail Dub Brand"):

| Tab value | Panel component | Weaknesses (screenshot) |
|---|---|---|
| `producer` | `producer/producer-panel.tsx` + `tool-call-card.tsx` | Bubbles are `rounded-lg bg-muted px-2 py-1 text-xs` with no avatar, typing state or tool-call visual. The textarea is a raw `min-h-[64px] rounded border`. The Send button looks disabled. The paid-confirm card is an amber border box (`editor_tab_producer.png`). |
| `transcript` | `editor/transcript-panel.tsx` | Speaker labels are small yellow and green dots. Cut words have weak strike styling. There is no search and no speaker chip colours (`editor_tab_transcript.png`). |
| `layout` | `editor/layout-panel.tsx` | Text buttons have no layout glyphs. The shot list is plain (`editor_tab_layout.png`). |
| `captions` | `editor/captions-panel.tsx` + `caption-preset-picker.tsx` + `caption-anim.css` | The preset tiles (Bold Pop, Clean White, Boxed, Karaoke, Minimal, Neon, Bounce, Typewriter, Slide Up, Highlighter) have a live "CLIP THIS" preview, but the label sits above a black box on white. Animation is a **native `<select>`**. The toggles are default (`editor_tab_captions.png`). |
| `broll` | `editor/broll-panel.tsx`, `stock-broll-picker.tsx`, `ai-broll-card.tsx` | Plain lists and buttons (`editor_tab_b_roll.png`). |
| `audio` | `editor/audio-panel.tsx`, `use-audio-mix.ts` | Raw range inputs and no icons (`editor_tab_audio.png`). |
| `thumbnail` | `editor/thumbnail-panel.tsx` | Plain grid (`editor_tab_thumbnail.png`). |
| `dub` | `editor/dub-panel.tsx`, `use-dub-preview.ts` | Native select for language, list rows (`editor_tab_dub.png`). |
| `brand` | inline `<p>` in editor-shell | Only a sentence and a link (`editor_tab_brand.png`). |

- `PlayerControls`: a tiny play button, a thin native-looking scrubber and a "0%" label.
- `Timeline`: word chips in blue and purple, a green audio bar, grey b-roll blocks and a red playhead. It has no lane labels or icons, no time ruler and no zoom.
- `EditorTopBar`: Back, a title `Input`, a "Saved" text label, undo/redo, and an "AI Producer" button that looks disabled (grey outline) next to Export.
- `ExportDialog` (`editor_export_dialog.png`): "720p · captions burned in", a native `<select>` for the audio track, a native ".srt" checkbox, a monospace Pixabay credits blob with Copy credits, and 4 equal buttons (Export MP4 / Download thumbnail / Copy title / Close).

### 1.7 `/app/clips/brand` (Brand template)
- `page.tsx` → `brand-editor.tsx`.
- Screenshot: `brand.png`.
- **The worst page.** Raw native inputs, a native `<input type=file>`, a native `<select>` for the font, raw range sliders, plain caption buttons and a black "BRAND" preview box.
- There is a single template only, but F4 needs multiple templates and intro/outro.

### 1.8 `/app/clips/exports` (Exports)
- `page.tsx` → `exports-list.tsx`.
- Screenshot: `exports.png`.
- The table shows: thumbnail, raw project id, resolution, watermark, created, expires, **uppercase status text with no badge colour** (READY/FAILED), size, and Download.
- There are All/Ready/Failed filter pills.
- Weaknesses: no project title, no aspect column (F2), no bulk download and no empty or skeleton state.

### 1.9 Screenshot index (`/workspace/plan/ui_before/`)
`home.png`, `projects.png`, `projects_delayed.png`, `new.png`, `mobile_new.png`, `project.png`, `project_87fe33.png`, `project_5a5610.png`, `editor.png`, `editor_tab_producer.png`, `editor_tab_transcript.png`, `editor_tab_layout.png`, `editor_tab_captions.png`, `editor_tab_b_roll.png`, `editor_tab_audio.png`, `editor_tab_thumbnail.png`, `editor_tab_dub.png`, `editor_tab_brand.png`, `editor_export_dialog.png`, `brand.png`, `exports.png`.

Capture scripts: `/workspace/shot/shot.js` and `/workspace/shot/shot2.js` (Playwright, port 3100). Re-run them into `/workspace/plan/ui_after/` after the polish to get a before/after.

### 1.10 Other pages (only inherit the tokens)
`app/app/help`, `app/app/integrations`, `app/app/settings` pick up the new tokens, PageHeader and shell automatically. Do not redesign them.

---

## 2. Old UI kit at tag `pre-clips-cleanup`: what exists vs what was deleted

**Finding: the shadcn primitives were never deleted.** `new-app/components/ui/*` is identical between `pre-clips-cleanup` and `master`. These are the 21 files: avatar, badge, button, card, chart, checkbox, dialog, dropdown-menu, input, label, popover, progress, select, separator, sheet, sonner, switch, table, tabs, textarea, tooltip. **There is nothing to restore there.**

The old app also had **no dark theme**. Every old globals file (`new-app`, `newui/`, `newui2/`, `src/app/globals.css`) is light-only. The "richer" look came from **domain compositions**, not a different kit:

| Old file (tag `pre-clips-cleanup`) | Status on master | Useful pattern | Restore? |
|---|---|---|---|
| `new-app/app/app/home/page.tsx` | Replaced by a redirect | `Stat` tile row, product cards with an icon tile (`size-10 rounded-lg bg-primary/10 text-primary`), `StatusBadge`, a setup checklist with `CheckCircle2`/`Circle` | Reference only (imports deleted `@/lib/data`, `@/lib/metrics`) |
| `new-app/components/receptionist/ai-ui.tsx` | Deleted | `AgentStatusBadge`, `DraftBar` (sticky save bar), `Section`, `JumpChips`, `ToggleRow`, `NotAvailable`, `Pills`, `DemoNote` | **Port the patterns** into `components/app/kit.tsx` (§6.12). It imports deleted `agent-provider`, so don't restore the file as is. |
| `new-app/components/power-dialer/overview-content.tsx` | Deleted | Stat grid + Panel + table composition | Reference only (imports `phone-api`) |
| `new-app/components/calls/recent-calls.tsx` | Deleted | Dense table with a leading avatar, status badge and relative time | Reference for the Exports table |
| `new-app/components/shell/sidebar-nav.tsx`, `app-header.tsx` | Shrunk on master | Context icon tile header, group labels, pulsing green status dot card, collapse button | Reference |
| `new-app/components/app/page-primitives.tsx`, `status.tsx` | **Still on master** | `Page`, `PageHeader` (already has breadcrumbs), `IconTile`, `Panel`, `Stat`, `EmptyState`, `KeyValue`, `StatusBadge` | Extend in place |
| power-dialer/*, phone/*, receptionist/*, contacts/*, numbers/*, mctb/*, calls/*, routing/*, providers | Deleted | SMS-era domain UI | **Do not restore.** They import deleted libs (`@/lib/data`, `phone-api`, providers) and are off-product. |

**Better pattern sources already on master (no checkout needed):**
- `src/newui-transplant/components/app/kit.tsx`: `Pill`, `Rows`, `FeatureEmphasisStrip`, `Callout`, `SetupProgressBar`, `OpusIconBadge`, `ConfigSection`, `SettingRow`, `FieldRow`, `Field`, `KeyValueRow` and `Initials`. Port `Callout`, `ConfigSection`, `SettingRow` and `Field`.
- `src/newui-transplant/components/app/opus-surfaces.ts`: class constants such as `OPUS_CARD = 'rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,18,40,0.04)]'`.
- `newui/components/ui/sidebar.tsx`, `skeleton.tsx` and `radio-group.tsx` are Radix-based, so **do not copy them**. Use the shadcn CLI (§4.2) so they match `base-nova`.

**Exact commands (reference extraction only, never into live import paths):**
```bash
git fetch --tags
mkdir -p new-app/_reference/old-kit
git show pre-clips-cleanup:new-app/app/app/home/page.tsx                        > new-app/_reference/old-kit/home-page.tsx
git show pre-clips-cleanup:new-app/components/receptionist/ai-ui.tsx           > new-app/_reference/old-kit/ai-ui.tsx
git show pre-clips-cleanup:new-app/components/power-dialer/overview-content.tsx > new-app/_reference/old-kit/pd-overview.tsx
git show pre-clips-cleanup:new-app/components/calls/recent-calls.tsx           > new-app/_reference/old-kit/recent-calls.tsx
git show pre-clips-cleanup:new-app/components/shell/sidebar-nav.tsx            > new-app/_reference/old-kit/sidebar-nav.tsx
git show pre-clips-cleanup:new-app/components/shell/app-header.tsx             > new-app/_reference/old-kit/app-header.tsx
cp src/newui-transplant/components/app/kit.tsx          new-app/_reference/old-kit/opus-kit.tsx
cp src/newui-transplant/components/app/opus-surfaces.ts new-app/_reference/old-kit/opus-surfaces.ts
echo "_reference/" >> new-app/.gitignore
# and add "_reference" to new-app/tsconfig.json "exclude"
```
The command below restores the literal old files into the tree. **This is not recommended**: they fail typecheck against deleted libs and pull SMS UI back in.
```bash
git checkout pre-clips-cleanup -- new-app/components/receptionist/ai-ui.tsx new-app/app/app/home/page.tsx
```

---

## 3. Design tokens (dark-first, light option)

### 3.1 Direction
- **Surfaces:** near-black blue-violet (`oklch(0.145 0.012 275)` ≈ `#0d0e14`), like CapCut and Opus. Use layered surfaces (background → card → raised → overlay), each about 3–4 % lighter.
- **Brand:** a violet → magenta → amber gradient ("Transovo Spark"). Use it only for the primary CTA, the logo, the score ring, active nav indicators and the AI Producer. Never use it as a page background.
- **Domain accent colours ("lanes"):**
  - captions: amber;
  - b-roll: cyan;
  - music: emerald;
  - SFX: pink;
  - voice/dub: sky;
  - AI: violet;
  - record: red;
  - brand: fuchsia.
  The timeline lanes, rail icons and chips all reuse them.
- **Radius:** 12 px cards, 10 px controls, pills fully rounded.
- **Type:** Geist Sans for the UI and Geist Mono for timecodes, wired **properly via CSS variables**.

### 3.2 `app/layout.tsx` (replace the font and theme wiring; keep Analytics, TooltipProvider and Toaster)
```tsx
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'                 // ^0.4.6 already installed
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Transovo Clips', template: '%s · Transovo Clips' },
  description: 'Turn long videos into short clips, edit by transcript, and export ready-to-post videos.',
}
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0d0e14' },
    { media: '(prefers-color-scheme: light)', color: '#f7f7fa' },
  ],
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
        {process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}
```
- `components/ui/sonner.tsx` (the shadcn default) already calls `useTheme()` from next-themes. Verify that; if it hard-codes `theme="light"`, change it to `theme={resolvedTheme as 'light'|'dark'}`.
- Do **not** add the `geist` npm package (latest is 1.8.2). next/font/google is already used and works once the variables are applied.

### 3.3 `app/globals.css`: token block
Keep the `@import 'tailwindcss'`, `@import 'tw-animate-css'` and `@import 'shadcn/tailwind.css'` lines and `@custom-variant dark (&:is(.dark *));`. **Replace** the `:root` block, **add** a `.dark` block, and **extend** `@theme inline`. Keep the existing color mappings in `@theme inline` (`--color-background: var(--background)` etc.) and add the following:

```css
@theme inline {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;

  --color-surface-raised: var(--surface-raised);
  --color-surface-overlay: var(--surface-overlay);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-lane-caption: var(--lane-caption);
  --color-lane-broll: var(--lane-broll);
  --color-lane-music: var(--lane-music);
  --color-lane-sfx: var(--lane-sfx);
  --color-lane-voice: var(--lane-voice);
  --color-lane-ai: var(--lane-ai);
  --color-lane-record: var(--lane-record);
  --color-lane-brand: var(--lane-brand);
  --color-speaker-1: var(--speaker-1);
  --color-speaker-2: var(--speaker-2);
  --color-speaker-3: var(--speaker-3);
  --color-speaker-4: var(--speaker-4);
  --color-speaker-5: var(--speaker-5);
  --color-speaker-6: var(--speaker-6);
  --color-sidebar-muted: var(--sidebar-muted);

  --radius-sm: calc(var(--radius) - 4px);   /* 8px  */
  --radius-md: calc(var(--radius) - 2px);   /* 10px */
  --radius-lg: var(--radius);               /* 12px */
  --radius-xl: calc(var(--radius) + 4px);   /* 16px */
  --radius-2xl: calc(var(--radius) + 8px);  /* 20px */

  --shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.06);
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.10), 0 1px 2px -1px oklch(0 0 0 / 0.10);
  --shadow-md: 0 4px 12px -2px oklch(0 0 0 / 0.18), 0 2px 4px -2px oklch(0 0 0 / 0.12);
  --shadow-lg: 0 12px 32px -8px oklch(0 0 0 / 0.35);
  --shadow-glow: 0 0 0 1px oklch(0.66 0.24 300 / 0.35), 0 8px 28px -6px oklch(0.66 0.24 300 / 0.45);

  --animate-shimmer: shimmer 1.6s linear infinite;
  @keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
}

:root {                                   /* LIGHT */
  color-scheme: light;
  --radius: 0.75rem;
  --background: oklch(0.985 0.002 280);
  --foreground: oklch(0.2 0.02 280);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.2 0.02 280);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.2 0.02 280);
  --surface-raised: oklch(0.975 0.004 280);
  --surface-overlay: oklch(1 0 0);
  --primary: oklch(0.55 0.24 295);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.96 0.006 280);
  --secondary-foreground: oklch(0.25 0.02 280);
  --muted: oklch(0.965 0.005 280);
  --muted-foreground: oklch(0.5 0.02 280);
  --accent: oklch(0.95 0.03 295);
  --accent-foreground: oklch(0.35 0.15 295);
  --destructive: oklch(0.58 0.22 25);
  --success: oklch(0.6 0.15 155);
  --warning: oklch(0.72 0.15 70);
  --warning-foreground: oklch(0.35 0.08 70);
  --info: oklch(0.62 0.15 235);
  --border: oklch(0.92 0.006 280);
  --input: oklch(0.9 0.008 280);
  --ring: oklch(0.55 0.24 295 / 0.55);
  --brand: oklch(0.6 0.25 300);
  --brand-foreground: oklch(0.99 0 0);
  --brand-gradient: linear-gradient(135deg, oklch(0.58 0.25 290) 0%, oklch(0.63 0.26 340) 55%, oklch(0.78 0.17 60) 100%);
  --sidebar: oklch(0.975 0.004 280);
  --sidebar-foreground: oklch(0.3 0.02 280);
  --sidebar-primary: oklch(0.55 0.24 295);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --sidebar-accent: oklch(0.94 0.02 295);
  --sidebar-accent-foreground: oklch(0.3 0.12 295);
  --sidebar-border: oklch(0.92 0.006 280);
  --sidebar-ring: oklch(0.55 0.24 295 / 0.55);
  --sidebar-muted: oklch(0.55 0.02 280);
  --lane-caption: oklch(0.72 0.16 75);
  --lane-broll: oklch(0.66 0.13 210);
  --lane-music: oklch(0.64 0.15 160);
  --lane-sfx: oklch(0.64 0.2 350);
  --lane-voice: oklch(0.64 0.14 240);
  --lane-ai: oklch(0.6 0.22 295);
  --lane-record: oklch(0.6 0.23 25);
  --lane-brand: oklch(0.62 0.24 330);
  --speaker-1: oklch(0.6 0.2 295);
  --speaker-2: oklch(0.62 0.14 200);
  --speaker-3: oklch(0.68 0.15 75);
  --speaker-4: oklch(0.62 0.17 150);
  --speaker-5: oklch(0.62 0.2 350);
  --speaker-6: oklch(0.64 0.16 30);
  --chart-1: oklch(0.55 0.24 295);
  --chart-2: oklch(0.66 0.13 210);
  --chart-3: oklch(0.64 0.15 160);
  --chart-4: oklch(0.72 0.16 75);
  --chart-5: oklch(0.64 0.2 350);
}

.dark {                                   /* DARK (default) */
  color-scheme: dark;
  --background: oklch(0.145 0.012 275);
  --foreground: oklch(0.96 0.005 275);
  --card: oklch(0.185 0.014 275);
  --card-foreground: oklch(0.96 0.005 275);
  --popover: oklch(0.205 0.016 275);
  --popover-foreground: oklch(0.96 0.005 275);
  --surface-raised: oklch(0.225 0.016 275);
  --surface-overlay: oklch(0.255 0.018 275);
  --primary: oklch(0.68 0.22 295);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.24 0.014 275);
  --secondary-foreground: oklch(0.92 0.005 275);
  --muted: oklch(0.22 0.012 275);
  --muted-foreground: oklch(0.7 0.015 275);
  --accent: oklch(0.28 0.05 295);
  --accent-foreground: oklch(0.92 0.06 295);
  --destructive: oklch(0.66 0.22 25);
  --success: oklch(0.74 0.16 155);
  --warning: oklch(0.82 0.15 75);
  --warning-foreground: oklch(0.92 0.1 75);
  --info: oklch(0.74 0.14 235);
  --border: oklch(1 0 0 / 0.08);
  --input: oklch(1 0 0 / 0.12);
  --ring: oklch(0.68 0.22 295 / 0.6);
  --brand: oklch(0.68 0.24 300);
  --brand-foreground: oklch(0.99 0 0);
  --brand-gradient: linear-gradient(135deg, oklch(0.62 0.25 290) 0%, oklch(0.67 0.26 340) 55%, oklch(0.8 0.17 60) 100%);
  --sidebar: oklch(0.165 0.013 275);
  --sidebar-foreground: oklch(0.82 0.01 275);
  --sidebar-primary: oklch(0.68 0.22 295);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --sidebar-accent: oklch(0.25 0.03 295);
  --sidebar-accent-foreground: oklch(0.97 0.01 295);
  --sidebar-border: oklch(1 0 0 / 0.06);
  --sidebar-ring: oklch(0.68 0.22 295 / 0.6);
  --sidebar-muted: oklch(0.62 0.015 275);
  --lane-caption: oklch(0.8 0.16 75);
  --lane-broll: oklch(0.76 0.13 210);
  --lane-music: oklch(0.74 0.15 160);
  --lane-sfx: oklch(0.74 0.2 350);
  --lane-voice: oklch(0.74 0.14 240);
  --lane-ai: oklch(0.7 0.22 295);
  --lane-record: oklch(0.68 0.23 25);
  --lane-brand: oklch(0.72 0.24 330);
  --speaker-1: oklch(0.74 0.17 295);
  --speaker-2: oklch(0.78 0.13 200);
  --speaker-3: oklch(0.82 0.15 75);
  --speaker-4: oklch(0.76 0.16 150);
  --speaker-5: oklch(0.74 0.2 350);
  --speaker-6: oklch(0.76 0.14 30);
  --chart-1: oklch(0.68 0.22 295);
  --chart-2: oklch(0.76 0.13 210);
  --chart-3: oklch(0.74 0.15 160);
  --chart-4: oklch(0.8 0.16 75);
  --chart-5: oklch(0.74 0.2 350);
}
```

### 3.4 Utilities (replace the existing `.surface`, `.surface-raised` and `.tile-primary`; keep `.tabular` and `.bg-grid-fade`)
```css
@layer utilities {
  .surface        { background: var(--card); border: 1px solid var(--border); box-shadow: var(--shadow-xs); }
  .surface-raised { background: var(--surface-raised); border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
  .bg-brand-gradient   { background-image: var(--brand-gradient); }
  .text-brand-gradient { background-image: var(--brand-gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .shadow-glow  { box-shadow: var(--shadow-glow); }
  .tile-primary { background-image: var(--brand-gradient); color: var(--brand-foreground); box-shadow: inset 0 1px 0 oklch(1 0 0 / .25), var(--shadow-sm); }
  .skeleton-shimmer { background: linear-gradient(90deg, var(--muted) 0%, var(--surface-raised) 50%, var(--muted) 100%); background-size: 200% 100%; animation: var(--animate-shimmer); }
  .scrollbar-thin { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
}
.dark .bg-grid-fade { opacity: .5; }
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
```

### 3.5 Typography scale (use these classes only)
| Role | Classes |
|---|---|
| Page title | `text-2xl font-semibold tracking-tight md:text-[28px]` |
| Page subtitle | `text-sm text-muted-foreground` |
| Section title | `text-sm font-semibold` |
| Body | `text-sm` |
| Meta | `text-xs text-muted-foreground` |
| Overline / group label | `text-[11px] font-medium uppercase tracking-wider text-muted-foreground` |
| Timecode | `font-mono text-xs tabular-nums` |
| Big number | `text-3xl font-semibold tabular-nums` |

### 3.6 Spacing and layout constants
- Page gutter: `px-4 md:px-6 xl:px-8`. Vertical: `py-6`. Section gap: `gap-6`. Card padding: `p-4` (dense) or `p-5`.
- Control heights: `h-9` (default), `h-8` (sm), `h-10` (lg CTA).
- Grids:
  - project cards `grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4`;
  - clip cards `grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4`.
- `Page` max width changes from `max-w-7xl` to `max-w-[1400px]`.
- **Tailwind v4 cannot see dynamic class names** (`bg-lane-${x}`). Always map tones through literal class tables, e.g.
  ```ts
  export const TONE_TILE = {
    brand: 'bg-brand-gradient text-white', caption: 'bg-lane-caption/15 text-lane-caption', broll: 'bg-lane-broll/15 text-lane-broll',
    music: 'bg-lane-music/15 text-lane-music', voice: 'bg-lane-voice/15 text-lane-voice', record: 'bg-lane-record/15 text-lane-record',
    ai: 'bg-lane-ai/15 text-lane-ai', brandkit: 'bg-lane-brand/15 text-lane-brand',
  } as const
  export const SPEAKER_CHIP = ['bg-speaker-1/15 text-speaker-1','bg-speaker-2/15 text-speaker-2','bg-speaker-3/15 text-speaker-3','bg-speaker-4/15 text-speaker-4','bg-speaker-5/15 text-speaker-5','bg-speaker-6/15 text-speaker-6'] as const
  ```
  These go in `lib/ui/tones.ts`.

---

## 4. Packages and shadcn components

### 4.1 Packages (npm latest checked 2026-10-26)
| Package | Version | Action |
|---|---|---|
| `lucide-react` | `^1.16.0` installed; latest `1.61.0` | `pnpm -C new-app add lucide-react@^1.61.0`, so every icon in §14 exists (e.g. `CloudCheck`, `GaugeCircle`). It is a minor bump with the same API. |
| `sonner` | `^2.0.8` (latest) | Installed; now used everywhere (§6.13) |
| `next-themes` | `^0.4.6` (latest) | Installed; now actually mounted |
| `motion` (formerly framer-motion) | `^14.6.0` | **Optional.** `pnpm -C new-app add motion@^14.6.0`, imported from `motion/react`. Use it only for the producer message enter and the rail active indicator (`layoutId`). Every other animation is CSS via `tw-animate-css` (`animate-in fade-in slide-in-from-bottom-2 duration-200`). Skip it if you want zero new deps. |
| `@base-ui/react` | `^1.5.0` | Installed (shadcn `base-nova`). Base UI uses `render={<Link …/>}`, **not** `asChild`. |
| `tw-animate-css` | installed | Keep |

**Do not add any `@radix-ui/*` package.**

### 4.2 shadcn CLI (run inside `new-app/`; `components.json` style is `base-nova`; CLI latest `4.22.1`)
```bash
cd new-app
pnpm dlx shadcn@latest add sidebar skeleton scroll-area toggle toggle-group slider radio-group \
  breadcrumb alert-dialog collapsible aspect-ratio kbd empty accordion hover-card command spinner
```
- When asked to overwrite an existing file (`button`, `input`, `separator`, `sheet`, `tooltip`), answer **N**. Afterwards, `git status components/ui hooks` must show only **new** files plus `hooks/use-mobile.ts`.
- If a name is not in the base registry (the CLI prints "not found"), remove just that name and re-run. The hard requirements are `sidebar skeleton scroll-area toggle-group slider breadcrumb alert-dialog`.
- Sidebar reference (verified 2026-10-26): https://ui.shadcn.com/docs/components/base/sidebar. It provides `SidebarProvider` (`defaultOpen`, the `--sidebar-width` CSS var, the `⌘/Ctrl+B` shortcut), `Sidebar collapsible="icon"`, `SidebarGroup` / `SidebarGroupLabel` / `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton render={<a/>} isActive` / `SidebarMenuBadge` / `SidebarRail` / `SidebarInset` / `SidebarTrigger`, and the `--sidebar-*` theme vars, which are already defined in §3.3.

---

## 5. App shell

### 5.1 `lib/nav.ts` (data change only; `resolveContext`, `isItemActive` and `groupItems` keep their signatures)
Add optional fields to `NavItem`: `badge?: 'soon' | 'new'`, `disabled?: boolean`. Replace `CLIPS.items` with:
```ts
import { Plus, Video, Clapperboard, Scissors, AudioLines, Palette, LayoutTemplate, Download } from 'lucide-react'
// Group render order: Create, Library, Brand, Exports
items: [
  { title: 'New project', href: '/app/clips/new',     icon: Plus,          group: 'Create' },
  { title: 'Record',      href: '/app/record',        icon: Video,         group: 'Create',  badge: 'soon', disabled: true }, // enabled by descript_build_spec D5
  { title: 'Projects',    href: '/app/clips',         icon: Clapperboard,  group: 'Library', exact: true },
  { title: 'Editor',      href: '/app/editor',        icon: Scissors,      group: 'Library', badge: 'soon', disabled: true }, // D1
  { title: 'Voice',       href: '/app/voice',         icon: AudioLines,    group: 'Library', badge: 'soon', disabled: true }, // D2
  { title: 'Brand kit',   href: '/app/clips/brand',   icon: Palette,       group: 'Brand' },
  { title: 'Templates',   href: '/app/clips/brand?tab=templates', icon: LayoutTemplate, group: 'Brand' },
  { title: 'Exports',     href: '/app/clips/exports', icon: Download,      group: 'Exports' },
]
```
- If `groupItems` sorts groups alphabetically, add `export const GROUP_ORDER = ['Create','Library','Brand','Exports']` and sort by it inside the new sidebar (keep the function unchanged).
- A disabled item renders `aria-disabled="true"`, `tabIndex={-1}`, `className="pointer-events-none opacity-50"` and a "Soon" badge. It does **not** link anywhere (render a `<span>` instead of a `Link`). When a milestone ships its route, flip `disabled:false` and remove `badge`.
- If `isItemActive` doesn't consider the query string, `Templates` must not mark `Brand kit` inactive. Compare `pathname` plus the `tab` search param inside the sidebar only.

### 5.2 `components/shell/app-sidebar.tsx` (new; replaces the visuals of `sidebar-nav.tsx`)
```tsx
'use client'
<Sidebar collapsible="icon" className="border-r border-sidebar-border">
  <SidebarHeader className="h-14 flex-row items-center gap-2.5 px-3">
    <LogoMark className="size-7 shrink-0" />  {/* components/brand/logo-mark.tsx: rounded-lg bg-brand-gradient ring-1 ring-inset ring-white/20 grid place-items-center; inner <Scissors className="size-4 text-white" /> */}
    <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
      <p className="text-sm font-semibold">Transovo <span className="text-brand-gradient">Clips</span></p>
      <p className="truncate text-[11px] text-sidebar-muted">{workspaceName}</p>   {/* same source the header uses today */}
    </div>
  </SidebarHeader>
  <SidebarContent className="scrollbar-thin">
    <div className="px-2 pb-1">
      <PrimaryButton render={<Link href="/app/clips/new" />} className="h-9 w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
        <Plus className="size-4" /><span className="group-data-[collapsible=icon]:hidden">Create</span>
      </PrimaryButton>
    </div>
    {orderedGroups.map(([group, items]) => (
      <SidebarGroup key={group}>
        <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">{group}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((it) => (
            <SidebarMenuItem key={it.href}>
              <SidebarMenuButton tooltip={it.title} isActive={active(it)}
                render={it.disabled ? <span aria-disabled="true" /> : <Link href={it.href} />}
                className={cn('relative h-9 gap-3 rounded-md text-sm',
                  'data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground',
                  'data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-brand-gradient',
                  it.disabled && 'pointer-events-none opacity-50')}>
                <it.icon className="size-4" /><span>{it.title}</span>
              </SidebarMenuButton>
              {it.badge === 'soon' && <SidebarMenuBadge className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">Soon</SidebarMenuBadge>}
              {it.href === '/app/clips/exports' && <ExportsCountBadge />}{/* moved out of ClipsExportsSidebarLink, same data hook */}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    ))}
  </SidebarContent>
  <SidebarFooter className="p-2">
    {testMode && (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs group-data-[collapsible=icon]:hidden">
        <p className="flex items-center gap-1.5 font-medium text-warning"><FlaskConical className="size-3.5" />Test mode</p>
        <p className="mt-0.5 text-muted-foreground">All features unlocked. No billing.</p>
      </div>
    )}
  </SidebarFooter>
  <SidebarRail />
</Sidebar>
```
- Check the actual Base UI attribute shadcn uses for active state in the generated `sidebar.tsx` (`data-active`). Adjust the selectors if it differs.
- If `tooltip` on `SidebarMenuButton` isn't supported in the generated base file, wrap the button in `Tooltip` with `side="right"`, shown only when `state==='collapsed'`.

### 5.3 `components/shell/app-shell.tsx`
```tsx
<ShellContextProvider><ClipsWorkspaceProvider>
  <SidebarProvider defaultOpen={defaultOpen} style={{ '--sidebar-width': '15rem', '--sidebar-width-icon': '3.5rem' } as React.CSSProperties}>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
    <AppSidebar />
    <SidebarInset className="min-w-0 bg-background">
      <AppTopBar />
      <main id="main" className="min-h-[calc(100dvh-3.5rem)]">{children}</main>
    </SidebarInset>
  </SidebarProvider>
</ClipsWorkspaceProvider></ShellContextProvider>
```
- `defaultOpen` comes from the `sidebar_state` cookie, which shadcn's provider writes. In `app/app/layout.tsx` (server), use `const defaultOpen = (await cookies()).get('sidebar_state')?.value !== 'false'` and pass it down.
- The mobile `Sheet` in today's shell is removed, because `Sidebar` renders a Sheet below `md` automatically.
- **The header height changes from h-16 to h-14.** The single coupled value is the editor root: change `h-[calc(100dvh-4rem)]` to `h-[calc(100dvh-3.5rem)]`.

### 5.4 `components/shell/app-topbar.tsx` (new; absorbs `app-header.tsx` and keeps every link and popover)
Root: `sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-4`

From left to right:
1. `<SidebarTrigger className="-ml-1" />`, then `<Separator orientation="vertical" className="mx-1 h-5" />`.
2. `<AppBreadcrumbs />` (§5.5), with `min-w-0 flex-1`.
3. The existing `GlobalSearch` component, trigger restyled to `hidden h-9 w-64 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted md:flex`, with a `Search` icon and `<Kbd className="ml-auto">⌘K</Kbd>`. Show the Kbd only if the component already binds ⌘K; otherwise omit it. **No new shortcut behaviour.**
4. The test-mode pill becomes `<StatusBadge tone="warning"><FlaskConical className="size-3" />Test mode</StatusBadge>` wrapped in a `Tooltip` "All features unlocked · no billing". It uses the same `testMode` source as today.
5. `<ThemeToggle />` (new `components/shell/theme-toggle.tsx`): `Button variant="ghost" size="icon" aria-label="Toggle theme"` with `onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}`, showing `Sun` in dark and `Moon` in light. Render it after mount to avoid a hydration mismatch (`useEffect(() => setMounted(true), [])`).
6. The existing notifications popover with the `Bell` icon. Its count dot becomes `absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand-gradient text-[10px] font-semibold text-white`.
7. An avatar `DropdownMenu` (`Avatar size-8`) that collects the header's icon links: `Plug` Integrations, `Settings` Settings, `LifeBuoy` Help (**same hrefs as today**), a separator, and `SunMoon` "Theme" (the same action as ThemeToggle).
8. A mobile-only `Button size="icon" className="md:hidden"` with `Plus` linking to `/app/clips/new` (the desktop New project button moves to the sidebar Create button).
- Remove the one-item "Clips" context tab. Product context now lives in the sidebar header.

### 5.5 Breadcrumbs: `components/shell/app-breadcrumbs.tsx` + `components/shell/breadcrumb-context.tsx`
The shadcn `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink render={<Link/>}`, `BreadcrumbPage` and `BreadcrumbSeparator` (with `ChevronRight`).

| Path | Crumbs |
|---|---|
| `/app/clips` | **Projects** |
| `/app/clips/new` | Projects › **New project** |
| `/app/clips/[projectId]` | Projects › **{project title}** |
| `/app/clips/[projectId]/edit/[clipId]` | Projects › {project title} › **{clip title}** |
| `/app/clips/brand` | Brand › **Brand kit** (or **Templates** with `?tab=templates`) |
| `/app/clips/exports` | **Exports** |
| `/app/settings` etc. | **Settings** / **Integrations** / **Help** |

- Dynamic titles come from `BreadcrumbTitleProvider` (a client context in the shell) via `useSetBreadcrumbTitle(key: 'project' | 'clip', title?: string)`. Pages call it with **props they already have**: `ProjectClipsView` (`projectTitle`) and `EditorShell` (`initialTitle`, then the live `title` state). Until it's set, render `<Skeleton className="h-4 w-24" />`.
- Each crumb is `max-w-[22ch] truncate`. On mobile, show only the last crumb plus a back `ChevronLeft` link to its parent.

---

## 6. Shared components (`components/app/*`, `components/clips/ui/*`)

### 6.1 `PageHeader` (extend `components/app/page-primitives.tsx`; keep the existing props)
New optional props: `icon?: LucideIcon`, `iconTone?: keyof typeof TONE_TILE` (default `'brand'`), `meta?: ReactNode` (a row under the subtitle for chips and counts).
```tsx
<header className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between">
  <div className="flex min-w-0 items-start gap-3.5">
    {Icon && <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl shadow-sm ring-1 ring-inset ring-white/10', TONE_TILE[iconTone])}><Icon className="size-5" /></div>}
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
    </div>
  </div>
  {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
</header>
```
- Breadcrumbs now live in the top bar, so the `breadcrumbs` prop stays accepted but is **ignored** (kept so no call site breaks).
- `IconTile` uses the same `TONE_TILE` mapping.
- `Panel` becomes `rounded-xl border border-border bg-card shadow-xs`, with header `flex items-center justify-between gap-3 border-b border-border px-5 py-3.5` and title `text-sm font-semibold`.

### 6.2 `PrimaryButton` (`components/app/primary-button.tsx`)
```tsx
export function PrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={cn('relative bg-brand-gradient text-white shadow-sm ring-1 ring-inset ring-white/15 transition-[filter,box-shadow] hover:shadow-glow hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:shadow-none', className)} />
}
```
Use it for one primary CTA per view at most: Create, Get clips, Export, Export all, Send (Producer), Save brand kit.

### 6.3 Status badges (`components/app/status.tsx`; extend, don't break existing exports)
- `StatusBadge` gains an optional leading `icon`. Tones are a literal map:
  - `success`: `bg-success/12 text-success ring-1 ring-inset ring-success/25`;
  - `warning`: `bg-warning/12 text-warning ring-warning/25`;
  - `danger`: `bg-destructive/12 text-destructive ring-destructive/25`;
  - `info`: `bg-info/12 text-info ring-info/25`;
  - `brand`: `bg-lane-ai/12 text-lane-ai ring-lane-ai/25`;
  - `neutral`: `bg-muted text-muted-foreground ring-border`.
  
  Base: `inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium`.
- New `ProjectStatusBadge({ status })` maps the existing `CLIP_JOB_STATE` buckets:
  - **Processing** (any non-terminal: QUEUED/UPLOADING/TRANSCRIBING/…): tone `info`, icon `Loader2` with `animate-spin`, label "Processing" (or the step label if available);
  - **Ready**: tone `success`, icon `CheckCircle2`;
  - **Failed**: tone `danger`, icon `XCircle`;
  - **Canceled**: tone `neutral`, icon `Ban`;
  - **Draft**: tone `neutral`, icon `FilePen`.
- New `RenderStatusBadge({ state })` uses `CLIP_RENDER_STATE`: Queued (`neutral`, `Clock`), Rendering (`info`, `Loader2` spin), Ready (`success`, `CheckCircle2`), Failed (`danger`, `XCircle`), Expired (`neutral`, `TimerOff`).
- The SMS-era maps (call/number/agent states) can stay exported but unused. Do not delete them in this pass, because deleting them is not a restyle.

### 6.4 `ScoreRing` (`components/clips/ui/score-ring.tsx`)
```tsx
export function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score))); const r = 15; const c = 2 * Math.PI * r
  const tone = s >= 75 ? 'url(#score-grad)' : s >= 50 ? 'var(--lane-caption)' : 'var(--muted-foreground)'
  return (
    <div className="relative grid place-items-center rounded-full bg-black/55 backdrop-blur-sm" style={{ width: size, height: size }} role="img" aria-label={`Virality score ${s} out of 100`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <defs><linearGradient id="score-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="oklch(0.62 0.25 290)" /><stop offset="55%" stopColor="oklch(0.67 0.26 340)" /><stop offset="100%" stopColor="oklch(0.8 0.17 60)" /></linearGradient></defs>
        <circle cx="18" cy="18" r={r} fill="none" stroke="white" strokeOpacity=".15" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="relative text-[11px] font-semibold tabular-nums text-white">{s}</span>
    </div>
  )
}
```
- Use `useId()` for the gradient id so multiple rings don't collide.
- The score uses whatever `ScoreBadge` reads today (`clip.score`). If that's 0–10, multiply by 10 **in the display only**.

### 6.5 `DurationChip` + `lib/clips/format.ts`
- Move the duration formatter that `clip-card.tsx` and `project-results.tsx` already use into `lib/clips/format.ts` as `formatDur(ms)` and `formatTimecode(ms)`. Only the import location changes; keep identical output.
- `DurationChip`: `absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-white backdrop-blur-sm`.

### 6.6 `ClipCard` restyle (`components/clips/clip-card.tsx`; keep all props, handlers, hover-play logic and the `preview_play` event)
```tsx
<article className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
  <div className="relative aspect-[9/16] overflow-hidden bg-black">
    {/* existing <video>/poster element, add: */} className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
    <div className="absolute left-2 top-2"><ScoreRing score={clip.score} /></div>
    <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">#{rank}</span>
    <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
      <span className="grid size-12 place-items-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur-md"><Play className="size-5 translate-x-0.5 fill-white text-white" /></span>
    </div>
    <DurationChip ms={durationMs} />
    {/* hover action bar: same three handlers as today */}
    <div className="absolute inset-x-2 bottom-2 flex translate-y-2 gap-1.5 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
      <Button size="sm" className="h-8 flex-1 bg-white text-black hover:bg-white/90" render={<Link href={editHref} />}><Scissors className="size-3.5" />Edit</Button>
      <Tooltip><TooltipTrigger render={<Button size="icon" variant="secondary" className="size-8 bg-black/60 text-white hover:bg-black/80" aria-label="Download" onClick={onDownload} />}><Download className="size-4" /></TooltipTrigger><TooltipContent>Download</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger render={<Button size="icon" variant="secondary" className="size-8 bg-black/60 text-white hover:bg-black/80" aria-label="Make thumbnail" onClick={onMakeThumbnail} />}><ImagePlus className="size-4" /></TooltipTrigger><TooltipContent>Make thumbnail</TooltipContent></Tooltip>
    </div>
  </div>
  <div className="space-y-2 p-3">
    <h3 className="line-clamp-2 text-sm font-medium leading-snug">{clip.title}</h3>
    <div className="flex flex-wrap gap-1">{/* Hook/Flow/Value/Trend: same data */}
      {grades.map(g => <span key={g.k} className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', gradeTone(g.v))}>{g.k} {g.v}</span>)}
    </div>
    {clip.reason && <p className="line-clamp-2 text-xs text-muted-foreground">{clip.reason}</p>}
    <p className="font-mono text-[11px] text-muted-foreground tabular-nums">{formatTimecode(startMs)}–{formatTimecode(endMs)}</p>
  </div>
</article>
```
- `gradeTone`: A → `bg-success/12 text-success`, B → `bg-info/12 text-info`, C → `bg-warning/12 text-warning`, else `bg-muted text-muted-foreground`.
- Keep the busy and disabled states of Download and Make thumbnail. While pending, swap the icon for `<Loader2 className="size-4 animate-spin" />`.

### 6.7 `ProjectCard` + `ProjectGrid` (`components/clips/project-card.tsx`; new, presentational)
- Props: `{ id, title, status, createdAt, durationMs?, clipCount?, thumbnailUrl? }`. These are exactly the fields `listClipProjects` already returns. If a field isn't in its `select`, **omit it from the UI**; do not change the query.
- The card is a `Link href={/app/clips/${id}}` styled `group block overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
  - **Thumbnail:** `aspect-video bg-muted` with the image (`object-cover`). If there is none, show a fallback `bg-brand-gradient/20` grid with a centered `Film` icon at `size-8 text-muted-foreground`. While processing, overlay `absolute inset-0 grid place-items-center bg-black/50` with `Loader2 animate-spin` and the step label.
  - **Overlays:** `ProjectStatusBadge` at top-left, `DurationChip` at bottom-right.
  - **Body:** `p-3.5`, title `line-clamp-1 text-sm font-medium`, meta row `mt-1 flex items-center gap-3 text-xs text-muted-foreground` with `<Sparkles className="size-3.5"/>{clipCount} clips` and `<Clock className="size-3.5"/>{relativeTime(createdAt)}` (use `Intl.RelativeTimeFormat`).
- `ProjectGrid` is the grid from §3.6. Add a first "New project" tile: `Link` with `border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/40 grid place-items-center aspect-video rounded-xl`, holding a gradient `Plus` tile and the text "New project".

### 6.8 `SourcePicker` / Dropzone (restyle `components/clips/dropzone.tsx` (or wherever `Dropzone` is defined); keep `onFiles` and accept/size validation)
- Wrapper: `Tabs defaultValue="upload"` with `TabsList className="h-9 rounded-lg bg-muted p-1"`. Triggers: `Upload` "Upload file" and `Link2` "Paste link".
  - **The link tab is rendered only if the F1 link-import feature exists in the codebase** (an existing `importFromUrl`/`/api/clips/projects/import-url` handler). If it doesn't exist yet, render nothing; **do not create a backend**. The tab calls the existing handler unchanged.
- **Drop area:** `relative grid min-h-[280px] place-items-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 text-center transition`.
  - **Drag-over:** `data-[drag=true]:border-primary data-[drag=true]:bg-primary/5 data-[drag=true]:shadow-glow`. Track it with a local `isDragging` state on `onDragEnter`/`onDragLeave`/`onDrop`. This is a purely visual state, and the existing drop handler is untouched.
  - **Content:** a `size-14 rounded-2xl tile-primary` tile with `UploadCloud size-7` (it bobs `animate-bounce` while dragging), then `text-base font-semibold` "Drop a video or audio file", then `text-sm text-muted-foreground` "or click to browse · MP4, MOV, WebM, MP3, WAV · up to {maxSize}" (use the existing limit constant), then `Button variant="outline"` "Choose file" with `FolderOpen`.
- **Link tab:** `Input` with `pl-9` plus a `Link2` icon (`absolute left-3 top-1/2 size-4 -translate-y-1/2`). Placeholder: "Paste a YouTube, Vimeo, Drive or direct video URL". Next to it, a `PrimaryButton` "Import". Below it, a row of `text-xs text-muted-foreground` with source icons: `Youtube`, `Globe`.
- **`UploadProgressItem`:** `flex items-center gap-3 rounded-lg border border-border bg-card p-3`, with a `FileVideo` tile, name `truncate text-sm font-medium`, `Progress className="h-1.5"`, a `font-mono text-xs` percent, and a `Button size="icon" variant="ghost" aria-label="Cancel upload"` with `X`. It is wired to the existing `cancelClipUpload`.

### 6.9 `ProcessingStepper` (restyle `StepRail` inside `components/clips/job-status.tsx`; keep the STEPS array, the 4 s poll and the cancel handler)
- Icons per step: Upload `UploadCloud`, Transcribe `FileText`, Scan scenes `ScanLine`, Find clips `Sparkles`, Reframe & caption `Crop`, Ready `CheckCircle2`.
- Layout: horizontal on `md+`, vertical below `md`. `ol className="flex flex-col gap-3 md:flex-row md:items-center md:gap-0"`.
- Each step is a circle `grid size-9 place-items-center rounded-full ring-1 ring-inset`:
  - done: `bg-success/15 text-success ring-success/30`, with a `Check` icon;
  - active: `bg-brand-gradient text-white ring-white/20 shadow-glow`, with the step icon plus an outer `animate-ping` halo (`absolute inset-0 rounded-full bg-primary/30`);
  - pending: `bg-muted text-muted-foreground ring-border`.
- Connector (md+): `h-0.5 flex-1 mx-2 rounded-full` (done `bg-success/50`, else `bg-border`). Label: `text-xs font-medium` (active `text-foreground`, others `text-muted-foreground`).
- Panel: title "Processing your video" plus an ETA if one exists. `Progress` overall, `h-2` with indicator `bg-brand-gradient`. Message line `text-sm text-muted-foreground` with `Loader2 animate-spin`.
- **Cancel:** `Button variant="ghost"` with `CircleStop` "Cancel processing", now behind an `AlertDialog`: "Cancel processing? This project will stop processing. Uploaded media is kept." The dialog's confirm calls **the same existing cancel function**.
- **Failed state** (replaces the red text):
  ```tsx
  <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/8 p-4">
    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive"><AlertTriangle className="size-4.5" /></div>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Processing failed</p><p className="mt-0.5 text-sm text-muted-foreground">{errorMessage}</p></div>
    {/* show only if an existing retry/reprocess handler exists, otherwise a link: */}
    <Button variant="outline" size="sm" render={<Link href="/app/clips/new" />}><RotateCcw className="size-3.5" />Start over</Button>
  </div>
  ```

### 6.10 `EmptyState` (restyle in `page-primitives.tsx`; same props + optional `secondaryAction`)
```tsx
<div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
  <div className="pointer-events-none absolute inset-0 bg-grid-fade" aria-hidden />
  <div className="relative mx-auto grid size-14 place-items-center rounded-2xl tile-primary"><Icon className="size-6" /></div>
  <h3 className="relative mt-4 text-base font-semibold">{title}</h3>
  <p className="relative mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  <div className="relative mt-5 flex justify-center gap-2">{action}{secondaryAction}</div>
</div>
```
Copy per page:
- Projects: `Clapperboard` "No projects yet" / "Upload a long video and we'll find the best moments."
- Exports: `Download` "No exports yet" / "Exported clips appear here for 7 days."
- Clips: `Sparkles` "No clips found" / "Try a different clip length or genre."
- Producer: `Sparkles` "Ask the AI Producer" with 4 suggestion chips (§8.4).

### 6.11 Skeletons and `loading.tsx` files (new; render-only)
- `components/ui/skeleton.tsx` comes from the shadcn add. Add the `skeleton-shimmer` utility class at call sites.
- Create:
  - `app/app/clips/loading.tsx`: PageHeader skeleton + 8 × `ProjectCardSkeleton` (`aspect-video rounded-xl` + 2 lines);
  - `app/app/clips/[projectId]/loading.tsx`: header + 6 × `aspect-[9/16]` card skeletons;
  - `app/app/clips/[projectId]/edit/[clipId]/loading.tsx`: preview `aspect-[9/16] h-[70%]` + rail + panel lines;
  - `app/app/clips/exports/loading.tsx`: 6 table-row skeletons;
  - `app/app/clips/brand/loading.tsx`.
- Client lists that fetch (exports, stock b-roll, thumbnails, dub voices) show skeleton rows while their **existing** loading flag is true.

### 6.12 `components/app/kit.tsx` (new; patterns ported from old `ai-ui.tsx` and `opus-kit.tsx`)
| Export | Markup |
|---|---|
| `Section({icon,title,description,actions,children})` | `section className="space-y-3"` with header `flex items-start justify-between` (icon `size-4 text-muted-foreground`, `text-sm font-semibold`, `text-xs text-muted-foreground`) |
| `SettingRow({label,hint,children})` | `flex items-center justify-between gap-4 py-3 border-b border-border last:border-0` |
| `Field({label,htmlFor,hint,error,children})` | `Label` + child + hint/error `text-xs` (error `text-destructive`, `aria-describedby` wired) |
| `ToggleRow({icon,label,hint,checked,onCheckedChange})` | `SettingRow` + `Switch` (the same callback the caller passes) |
| `OptionTile({selected,onSelect,icon,label,hint,preview})` | `button role="radio" aria-checked` `rounded-xl border p-3 text-left transition hover:border-primary/40 data-[selected=true]:border-primary data-[selected=true]:bg-primary/8 data-[selected=true]:ring-1 data-[selected=true]:ring-primary/40`; wrap the group in `div role="radiogroup"` |
| `Callout({tone,icon,title,children})` | `flex gap-3 rounded-xl border p-3.5`, tone map info/warning/danger/brand |
| `StickyActionBar({children})` | `sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6` |
| `AspectGlyph({ratio})` | `span` sized from the ratio (9:16 `h-5 w-3`, 1:1 `size-4`, 16:9 `h-3 w-5`, 4:5 `h-5 w-4`), `rounded-[3px] border-2 border-current` |

### 6.13 Toasts for every async action (sonner; add `toast.*` **around** existing calls, never replacing them)
Pattern: `toast.promise(existingCall(args), { loading, success, error: (e) => e?.message ?? 'Something went wrong' })`. Where the existing code already awaits and handles errors, add `toast.success` / `toast.error` next to the existing state updates instead, so control flow is unchanged.

| Action (existing function) | Loading | Success | Error |
|---|---|---|---|
| Upload complete (`uploadClipFile` resolve) | none (progress row) | "Upload complete" | "Upload failed" |
| `cancelClipUpload` | none | "Upload canceled" | none |
| `createProject` | "Creating project…" | "Project created, processing started" | "Couldn't create project" |
| Cancel processing | "Canceling…" | "Processing canceled" | "Couldn't cancel" |
| Make thumbnail (`POST …/thumbnail`) | "Generating thumbnail…" | "Thumbnail ready" | "Thumbnail failed" |
| Download clip / export | none | "Download started" | "Download failed" |
| Export (editor `ExportDialog`, project Export all) | "Queuing export…" | "Export queued; find it in Exports" with action `{label:'View', onClick: () => router.push('/app/clips/exports')}` | "Export failed" |
| `patchClip` title autosave | none | none (top-bar saved state) | "Couldn't save title" |
| `useEditorState` save error (`saveState==='error'`) | none | none | "Changes not saved; retrying" (once per error transition) |
| Producer send / apply | none (typing dots) | "Applied {n} edits" when a patch applies | "Producer error" |
| Paid tool confirm (music/AI b-roll/dub/thumbnail generation) | "Generating {kind}…" | "{kind} ready" | "{kind} failed" |
| Stock b-roll insert | none | "B-roll added" | "Couldn't add b-roll" |
| Dub preview/generate | "Dubbing…" | "Dub ready" | "Dub failed" |
| Brand kit save | "Saving brand kit…" | "Brand kit saved" | "Couldn't save brand kit" |
| Logo upload | "Uploading logo…" | "Logo uploaded" | "Logo upload failed" |
| Copy title / Copy credits | none | "Copied" | none |

---

## 7. Pages

### 7.1 `/app/clips` Projects (`app/app/clips/page.tsx`; server component) **[DATA-WIRE-1]**
```tsx
import { Clapperboard, Plus } from 'lucide-react'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { listClipProjects } from '@/lib/server/clips/projects'
export const dynamic = 'force-dynamic'
export default async function ClipsProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: 'processing' | 'ready' | 'failed' }> }) {
  const { q, status } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  const projects = await listClipProjects(workspaceId, { q, status, limit: 50 })
  return (
    <Page>
      <PageHeader icon={Clapperboard} title="Projects" description="Your long videos and the clips we found in them."
        meta={<span className="text-xs text-muted-foreground">{projects.length} project{projects.length === 1 ? '' : 's'}</span>}
        actions={<PrimaryButton render={<Link href="/app/clips/new" />}><Plus className="size-4" />New project</PrimaryButton>} />
      <ProjectsToolbar q={q} status={status} />
      {projects.length === 0 && !q && !status ? <EmptyState icon={Clapperboard} title="No projects yet" description="Upload a long video and we'll find the best moments." action={<PrimaryButton render={<Link href="/app/clips/new" />}><Plus className="size-4" />New project</PrimaryButton>} />
        : projects.length === 0 ? <EmptyState icon={SearchX} title="No matches" description="Try a different search or filter." action={<Button variant="outline" render={<Link href="/app/clips" />}>Clear filters</Button>} />
        : <ProjectGrid projects={projects} />}
    </Page>
  )
}
```
- Check the real signature of `listClipProjects` before using it (`(workspaceId, { q?, status?, limit? })`, status buckets processing/ready/failed, `deletedAt: null`, `createdAt desc`). If `searchParams` isn't a Promise in this Next version's types, follow the pattern used in `[projectId]/page.tsx`.
- `ProjectsToolbar` (client) is `flex flex-wrap items-center gap-2 pb-4`:
  - a search `Input` (`h-9 w-64 pl-9`) with a `Search` icon, updating `?q=` with `router.replace` and a 300 ms debounce;
  - a `ToggleGroup` (All / Processing / Ready / Failed) writing `?status=`, where each item has a dot `size-1.5 rounded-full` coloured info/success/destructive;
  - a right-aligned view toggle (`LayoutGrid` / `List`) that is **visual only, optional**.
  
  This is URL state only, read by the server component above.
- If any project is processing, the client child `<AutoRefresh intervalMs={8000} />` calls `router.refresh()`. Mount it only when `projects.some(p => bucket(p.status)==='processing')`. Note: this is a new refresh, but it is read-only and reuses the same server read. If the reviewer considers it a behaviour change, drop it.

### 7.2 `/app/clips/new` New project (`new-project-workspace.tsx`; restyle only)
- `PageHeader icon={Plus} title="New project" description="Upload a long video. We'll transcribe it, find the best moments and reframe them for social."`
- Layout: `grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]`. The left column holds `SourcePicker` (§6.8) and the upload items. The right column holds `ProjectSettingsForm` in a `Panel` with `lg:sticky lg:top-20`.
- `ProjectSettingsForm` sections (`Section` from kit). These are the same fields and the same `onChange`:
  - **Mode & genre** (`Wand2`): `OptionTile` grid `grid-cols-2 gap-2`. Icons per option: Podcast `Mic`, Talking head `User`, Gaming `Gamepad2`, Education `GraduationCap`, Interview `Users`, Vlog `Camera`, Other `Shapes`. Use the existing option list and only add the icons by value; unknown values get `Sparkles`.
  - **Clip length** (`Timer`): `ToggleGroup` of the existing presets (e.g. `<30s`, `30–60s`, `60–90s`, Auto), with `h-9 rounded-lg` items.
  - **Layout & aspect** (`RectangleVertical`): `OptionTile`s with `AspectGlyph` previews for 9:16, 1:1, 16:9 and 4:5 (the existing list only).
    - **F2:** if multi-aspect export exists (an array value in form state), the tiles are multi-select `role="checkbox"` and show a count badge.
  - **F3/F5 toggles** (`ToggleRow`) render **only if the fields already exist** in the form state:
    - Auto emojis `SmilePlus`;
    - Progress bar `GaugeCircle`;
    - Caption preset `Captions` (opens the preset picker in a `Popover`);
    - Auto zoom `ZoomIn`;
    - Silence trim `Scissors`.
  - **F4:** a brand template `Select` with `Palette`, plus intro/outro `ToggleRow`s with `Clapperboard`, only if the form already supports them.
- **Estimate** (`estimateCredits` output): `Callout tone="brand" icon={Coins}`, text "Estimated: {n} credits · ~{mins} min to process". Test mode adds a `StatusBadge tone="warning"` "Free in test mode".
- **CTA:** `StickyActionBar` on mobile, or the panel footer on desktop, holding `PrimaryButton size="lg" className="h-11 w-full"` with `Sparkles` "Get clips". Its disabled and loading logic is unchanged; while loading it shows `Loader2 animate-spin` "Creating…".

### 7.3 `/app/clips/[projectId]` Project detail (`project-clips-view.tsx`, `project-results.tsx`, `job-status.tsx`)
- **Header:** `PageHeader icon={Film} title={projectTitle}`. `meta` shows `ProjectStatusBadge`, a `DurationChip`-style inline duration, `{clips.length} clips` and a created date. `actions`:
  - **Export all** (F2): `PrimaryButton` with `PackageOpen`, wired to the existing export-all handler. If there is an aspect selection, it is a `DropdownMenu` of aspect `CheckboxItem`s with `AspectGlyph`s, then "Export {n} clips".
  - **Producer** (F6): `Button variant="outline"` with `Sparkles` "AI Producer", only if the project-wide producer exists. It opens a right `Sheet` (`w-full sm:max-w-[440px]`) that mounts the existing project-level producer component, restyled per §8.4.
  - `DropdownMenu` (`MoreHorizontal`): Copy link `Link2`, Open source `ExternalLink`, and the existing actions only.
- **Processing:** `JobStatus` (§6.9) inside `Panel`. Results are hidden while processing (as today), with a skeleton grid below the stepper at `opacity-60`.
- **Results toolbar:** `flex items-center justify-between pb-4`. On the left, `text-sm font-semibold` "Clips" plus a count `Badge`. On the right, the sort `Select` (existing options, e.g. Score / Duration / Time) with `ArrowUpDown`, and a grid density `ToggleGroup` (`LayoutGrid`/`Grid3x3`), visual only.
- **Grid:** the clip grid from §3.6 with `ClipCard`s (§6.6). Empty: `EmptyState icon={Sparkles}`.
- **Failed:** the §6.9 failed block as the page's main panel. `project.png` must show it instead of red text.

---

## 8. Editor `/app/clips/[projectId]/edit/[clipId]`

### 8.1 Layout (`editor-shell.tsx`; JSX and classes only. All hooks, shortcuts, refs, and `patchClip` debounce stay byte-identical)
```tsx
const [tab, setTab] = useState<EditorTab>('transcript')   // was Tabs defaultValue="transcript"; now controlled, same default
<div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background">
  <EditorTopBar … />                                         {/* §8.2 */}
  <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_56px_380px] xl:grid-cols-[minmax(0,1fr)_56px_420px]">
    <section className="flex min-h-0 flex-col">
      <div className="relative grid min-h-0 flex-1 place-items-center bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.02_280)_0%,var(--background)_70%)] p-4 md:p-6">
        <div className="h-full max-h-full aspect-[9/16] overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10"><PreviewStage … /></div>
      </div>
      <PlayerControls … />                                   {/* §8.5 */}
      <Timeline … />                                         {/* §8.6 */}
    </section>
    <EditorRail value={tab} onValueChange={setTab} />       {/* §8.3, hidden <lg */}
    <aside className="flex min-h-0 flex-col border-l border-border bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <RailIcon tab={tab} className="size-4" /><h2 className="text-sm font-semibold">{TAB_META[tab].label}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{TAB_META[tab].hint}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1"><div className="p-4">{/* the SAME 9 panel components, chosen by tab */}</div></ScrollArea>
    </aside>
  </div>
</div>
```
- Keep `Tabs` / `TabsContent` if the panels rely on them (e.g. `keepMounted`). Otherwise switch with a `{tab === 'x' && <Panel/>}` map. **Panels that hold local state (Producer chat, Dub preview) must stay mounted.** Use `Tabs value={tab} onValueChange={setTab}` with `TabsContent keepMounted` (a Base UI prop) to preserve today's behaviour, and hide the old `TabsList` visually.
- **Below `lg`:** the rail turns into a horizontal `ScrollArea` icon strip above the aside (`flex gap-1 overflow-x-auto border-b p-2`), and the aside becomes a bottom `Sheet` on `<md`, opened by a floating `Button` with `PanelRightOpen`.
- Anything that opened the Producer tab programmatically (the "AI Producer" button) now calls `setTab('producer')`.

### 8.2 `EditorTopBar` (`editor/editor-top-bar.tsx`; same props)
`flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur`:
- A back `Button variant="ghost" size="icon" aria-label="Back to project"` with `ArrowLeft` and the same href.
- The title `Input`: `h-9 max-w-md border-transparent bg-transparent text-base font-semibold shadow-none hover:border-input focus-visible:border-input`. Same `value`/`onChange`.
- **Save state** (from `saveState`, `aria-live="polite"`):
  - saving: `Loader2 animate-spin` "Saving…";
  - saved: `CloudCheck` "Saved" in `text-muted-foreground`;
  - error: `CloudAlert` "Not saved" in `text-destructive`.
  
  Icons are `size-3.5`, the text `text-xs`.
- `ml-auto` group:
  - undo/redo `Button size="icon" variant="ghost"` with `Undo2`/`Redo2`, inside `Tooltip`s "Undo ⌘Z" / "Redo ⇧⌘Z" that use `<Kbd>`. They keep the `disabled={!canUndo}` logic.
  - `Separator vertical h-6`.
  - "AI Producer" becomes `Button variant="outline"` with `Sparkles className="text-lane-ai"`, `onClick={() => setTab('producer')}`, plus a dot when `pendingPaid` > 0.
  - **Export** becomes `PrimaryButton` with `Download` "Export", using the same dialog trigger.

### 8.3 `EditorRail` (`editor/editor-rail.tsx`; new, presentational)
`nav aria-label="Editor tools" className="hidden flex-col items-center gap-1 border-l border-border bg-sidebar py-2 lg:flex"`. Each item is a `Tooltip side="left"` wrapping:
```tsx
<button type="button" aria-label={m.label} aria-current={active ? 'page' : undefined} onClick={() => onValueChange(m.value)}
  className={cn('relative grid size-10 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active && 'bg-accent text-foreground before:absolute before:inset-y-2 before:-left-2 before:w-[3px] before:rounded-full before:bg-brand-gradient')}>
  <m.icon className={cn('size-5', active && m.tone)} />
</button>
```
Use a roving tabindex: ↑/↓ moves focus and Enter selects.

| value (unchanged) | Label | lucide icon | active tone class |
|---|---|---|---|
| `producer` | AI Producer | `Sparkles` | `text-lane-ai` |
| `transcript` | Script | `FileText` | `text-foreground` |
| `layout` | Layout | `LayoutPanelTop` | `text-lane-broll` |
| `captions` | Captions | `Captions` | `text-lane-caption` |
| `broll` | B-roll | `Clapperboard` | `text-lane-broll` |
| `audio` | Audio | `Music2` | `text-lane-music` |
| `thumbnail` | Cover | `ImageIcon` (`Image` export) | `text-lane-brand` |
| `dub` | Dub | `Languages` | `text-lane-voice` |
| `brand` | Brand | `Palette` | `text-lane-brand` |

`TAB_META` hints: Producer "Edit by chatting", Script "Edit video by editing text", Layout "Framing & reframe", Captions "Style & animation", B-roll "Stock & AI footage", Audio "Music, SFX & mix", Cover "Thumbnail", Dub "Translate & voice", Brand "Apply your kit".

### 8.4 Panels (restyle each file in place; same props and callbacks)
**Producer** (`producer/producer-panel.tsx`, `tool-call-card.tsx`)
- Container: `flex h-full flex-col`. Messages go in a `ScrollArea` (`flex-1`) with `space-y-4`, auto-scrolled to the bottom on new messages via the existing ref or a new `ref.scrollIntoView` (visual).
- **User bubble:** `ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground`.
- **Assistant:** a row `flex gap-2.5` with the avatar `grid size-7 shrink-0 place-items-center rounded-full bg-brand-gradient` holding `Sparkles size-3.5 text-white`, then the bubble `max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 text-sm`.
- **Typing indicator** (while the existing `pending`/`loading` flag is true): three `size-1.5 rounded-full bg-muted-foreground animate-bounce` dots with `[animation-delay:-0.2s]` and `[animation-delay:-0.1s]`.
- **Tool-call card:** `rounded-xl border border-border bg-card p-3` with header `flex items-center gap-2 text-xs font-medium` showing the tool icon plus label, then a `StatusBadge` (applied `success` `Check`, pending `info` `Loader2`, failed `danger`). Icon map by `ProducerToolName`:
  - `trim` `Scissors`, `set_captions` `Captions`, `set_layout` `LayoutPanelTop`, `set_title` `Type`;
  - `set_music_mix` `SlidersHorizontal`, `add_sfx` `AudioWaveform`, `remove_broll` `Trash2`, `insert_stock_broll` `Film`;
  - `generate_ai_broll` `Wand2`, `generate_music` `Music2`, `generate_thumbnail` `ImagePlus`, `dub` `Languages`, `apply_brand` `Palette`.
- **Paid confirm card** (`pendingPaid`): `rounded-xl border border-warning/40 bg-warning/8 p-3`, with a `Coins` "Uses credits" title, the cost line, and buttons `PrimaryButton size="sm"` "Generate" / `Button variant="ghost" size="sm"` "Skip". The callbacks are unchanged.
- **Empty state:** an `EmptyState` variant without a border, plus suggestion chips (`Button variant="outline" size="sm" className="h-8 rounded-full"`) that **only prefill the textarea** (`setInput(text)`), never auto-send:
  - "Cut the filler words" `Scissors`;
  - "Make captions bold and yellow" `Captions`;
  - "Add upbeat music" `Music2`;
  - "Write a punchier title" `Type`.
- **Composer:** `sticky bottom-0 border-t border-border bg-card p-3`. Wrapper `relative rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring`, with `Textarea` `min-h-[44px] max-h-40 resize-none border-0 bg-transparent pr-12 shadow-none focus-visible:ring-0` (the same value/onChange/onKeyDown, including Enter-to-send if it exists). Send is `PrimaryButton size="icon" className="absolute bottom-2 right-2 size-8 rounded-lg"` with `ArrowUp`, enabled when the input is non-empty and not pending (the same condition). The hint below reads `text-[11px] text-muted-foreground` "Enter to send · Shift+Enter for new line" (only if that's the real behaviour).
- **F6:** the same component works inside the project-level Sheet.

**Script / Transcript** (`transcript-panel.tsx`)
- A toolbar row with a search `Input` (`h-8 pl-8`, `Search`) that **only highlights matches visually** (`<mark className="rounded bg-lane-caption/30 text-foreground">`), plus a `Badge` "{n} cuts".
- **Speaker chips:** `inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium ${SPEAKER_CHIP[speakerIndex % 6]}` with `User size-3` and the label "Speaker {n}" (or the name). Each paragraph shows its chip plus a timecode `font-mono text-[11px] text-muted-foreground`.
- **Words:** `rounded px-0.5 transition hover:bg-accent cursor-text`:
  - current playback word: `bg-primary/20 text-foreground`;
  - selected: `bg-primary/30 ring-1 ring-primary/50`;
  - cut: `text-muted-foreground/60 line-through decoration-destructive/70 decoration-2 bg-destructive/5`;
  - word-fixed: `underline decoration-dotted decoration-lane-ai`.
- **Selection action bubble** (if a selection state exists): a floating `rounded-lg border bg-popover p-1 shadow-md` with `Scissors` "Cut" and `Undo2` "Restore", calling the existing `addCutRange` / `restoreWord`.

**Layout** (`layout-panel.tsx`)
- Mode `OptionTile`s with glyphs: Fill `Maximize`, Fit `Minimize`, Split/stacked `Rows2`, Speaker focus `ScanFace`, Screen+cam `PictureInPicture2` (existing modes only).
- **F5:** an Auto zoom `ToggleRow` (`ZoomIn`) and a Silence trim `ToggleRow` (`Scissors`) with a threshold `Slider`, **only if those fields exist** on `edits.layout`/`edits.audio`.
- **Shot list:** `rounded-lg border divide-y`, rows `flex items-center gap-3 p-2.5 hover:bg-accent/50` with a timecode, a `Crop` override `Select` (existing setter `setShotOverride`) and a mini thumbnail when available.

**Captions** (`captions-panel.tsx`, `caption-preset-picker.tsx`)
- **Preset tiles:** `grid grid-cols-2 gap-2`. Each tile is an `OptionTile` with a **live preview area** `relative aspect-[4/3] overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1f2030,#0e0f16)]`, which keeps the existing animated "CLIP THIS" sample and `caption-anim.css`. The label goes below (`text-xs font-medium`), and the selected tile gets a `Check` badge at top-right (`size-5 rounded-full bg-primary text-white`).
- The **Animation** native `<select>` becomes a shadcn `Select` (same options and setter).
- Sections:
  - Style `Type` (font `Select`, size `Slider`, colors as `size-8 rounded-full ring-2 ring-offset-2 ring-offset-card` swatches + `Input type="color"` hidden behind a swatch button);
  - Position `AlignVerticalSpaceAround` (`ToggleGroup` Top/Middle/Bottom);
  - Emphasis `Highlighter` (existing `toggleEmphasis`).
- **F3 toggles** (only if present): Auto emojis `SmilePlus`, Progress bar `GaugeCircle` with a color swatch, Highlight keywords `Highlighter`.

**B-roll** (`broll-panel.tsx`, `stock-broll-picker.tsx`, `ai-broll-card.tsx`)
- A `Tabs` header with "Stock" `Film` / "AI" `Wand2` (the existing two sources), plus the current inserts list.
- **Stock results:** `grid grid-cols-2 gap-2` of `aspect-video rounded-lg overflow-hidden` cards, each with hover-play of the preview, a `DurationChip`, a hover overlay holding `Plus` "Insert" (same handler), and a footer `text-[10px]` "Pixabay · {user}".
- **AI card:** a prompt `Textarea` plus `PrimaryButton` with `Wand2` "Generate" (same paid flow), and a generation progress `Progress` with `bg-brand-gradient`.
- **Insert list rows:** a lane-coloured left border `border-l-2 border-lane-broll`, a time range, `Trash2` remove (`removeBroll`), and a duration `Slider` (`updateBrollItem`).

**Audio** (`audio-panel.tsx`)
- Sections:
  - Music `Music2`: the current track card with play `Play`/`Pause`, name, and the generate button `Wand2` (same flow);
  - Mix `SlidersHorizontal`: every raw `<input type=range>` becomes `Slider` (same min/max/step/value/onChange; Base UI `onValueChange` gives an array or number, so adapt with `(v) => existingHandler(Array.isArray(v) ? v[0] : v)`) with an icon per row: Voice `Mic`, Music `Music2`, SFX `AudioWaveform`, Ducking `ArrowDownToLine`;
  - SFX `AudioWaveform`: a list with `border-l-2 border-lane-sfx`;
  - Voice track: a `Select` for the dub/original audio track (`Languages`).

**Cover / Thumbnail** (`thumbnail-panel.tsx`)
- A `grid grid-cols-2 gap-2` of `aspect-[9/16]` options, each with a selected ring `ring-2 ring-primary` and a `Check` badge. There is a generate tile (dashed, `ImagePlus` "Generate", same handler) and a skeleton tile while generating. `Download` stays on hover.

**Dub** (`dub-panel.tsx`)
- The language native `<select>` becomes a `Select` with flag-less labels plus a `Languages` icon. The voice list rows are `flex items-center gap-3 rounded-lg border p-2.5` with a `Play` preview button (existing `useDubPreview`), the name, and a gender/accent `Badge`. Generate is a `PrimaryButton`. The status uses `RenderStatusBadge`.

**Brand** (inline in editor-shell → new `editor/brand-tab.tsx`, presentational)
- A `Panel` showing the active brand kit: a mini preview (logo, colors, caption sample), `Button` with `Palette` "Apply brand kit" (calls the existing apply/`apply_brand` path if one exists in `useEditorState`; otherwise it is a link), and `Link` "Edit brand kit →" `/app/clips/brand`.
- **F4:** a template `Select` and intro/outro toggles **only if supported in `edits.brand`**.

### 8.5 `PlayerControls`
`flex h-12 shrink-0 items-center gap-3 border-t border-border px-4`:
- a play `Button size="icon" className="size-9 rounded-full bg-foreground text-background hover:bg-foreground/90"` with `Play`/`Pause` (`fill-current`);
- the timecode `font-mono text-xs tabular-nums` "{cur} / {total}";
- the scrubber `Slider className="flex-1"` (same value and seek handler);
- the existing zoom % control becomes `ToggleGroup` or `Select` "Fit / 100%";
- a `Maximize2` fullscreen button **only if one exists today**.

### 8.6 `Timeline` (lanes)
- Root: `relative shrink-0 border-t border-border bg-sidebar` with `h-[168px]`.
- **Lane header column:** `w-24 shrink-0 border-r border-border`. Each lane label is `flex h-7 items-center gap-1.5 px-2 text-[11px] text-muted-foreground` with an icon:
  - Words `Type`;
  - Captions `Captions`;
  - B-roll `Clapperboard`;
  - Music `Music2`;
  - SFX `AudioWaveform`;
  - Voice/Dub `Languages` (only lanes with data today).
- **Ruler:** `h-6 border-b border-border font-mono text-[10px] text-muted-foreground`, with tick marks every 1 s and labels every 5 s, computed from `outputDurationMs` (visual).
- **Lane blocks** use the lane tokens: `absolute top-1 h-5 rounded-md border px-1.5 text-[10px] truncate`.
  - captions `bg-lane-caption/20 border-lane-caption/40 text-lane-caption`;
  - b-roll `bg-lane-broll/20 border-lane-broll/40`;
  - music `bg-lane-music/20 border-lane-music/40`;
  - SFX `bg-lane-sfx/20 border-lane-sfx/40`.
  - Selected: `ring-2 ring-primary`.
  - Cut regions: `bg-[repeating-linear-gradient(135deg,transparent_0_4px,oklch(0.66_0.22_25/0.25)_4px_8px)]`.
- **Playhead:** `absolute inset-y-0 w-px bg-primary`, plus a handle `-top-1 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-primary`. The same position math applies.
- Keep click-to-seek and drag handlers byte-identical.

### 8.7 `ExportDialog`
- `DialogContent className="sm:max-w-lg"`. The header has a `tile-primary size-9` tile with `Download`, the title "Export clip", and the description "720p · captions burned in" (existing text).
- Body sections:
  - **Format:** a read-only summary of `KeyValue` rows (resolution, captions, watermark).
  - **F2 aspect:** `OptionTile` multi-select with `AspectGlyph`s, if present.
  - **Audio track:** `Select` (replaces the native one).
  - **Captions file:** `ToggleRow` with `FileText` ".srt subtitles" (replaces the native checkbox).
  - **Music credits:** a `Collapsible` "Music credits (Pixabay)" with `ScrollArea max-h-28 rounded-lg bg-muted p-3 font-mono text-[11px]` and `Button size="sm" variant="ghost"` with `Copy` "Copy credits" (toast "Copied").
- `DialogFooter`: `Button variant="ghost"` "Close"; `DropdownMenu` "More" with `MoreHorizontal` → Download thumbnail `ImageDown`, Copy title `Copy`; and `PrimaryButton` with `Download` "Export MP4". The same handlers apply. While exporting, show `Loader2` and then success state `CheckCircle2` "Export queued" with a link to Exports.

---

## 9. `/app/clips/brand` Brand kit (`brand-editor.tsx`; restyle, same state/save)
- `PageHeader icon={Palette} iconTone="brandkit" title="Brand kit" description="Logo, colors, fonts and caption style applied to every export."`
- **F4 tabs** (only if multiple templates are supported; otherwise render just the Kit content): `Tabs` "Brand kit" `Palette` / "Templates" `LayoutTemplate`, synced to `?tab=templates` (read via `useSearchParams`; writing uses `router.replace`).
- Layout: `grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]`.
  - **Left:** `Section`s in `Panel`s:
    1. **Logo** `ImageIcon`: a dropzone tile (`aspect-square size-28 rounded-xl border-2 border-dashed`, hover `border-primary/50`) showing the current logo `object-contain`, with `Upload` "Replace" and `Trash2` "Remove". Hide the native `<input type=file>` (`sr-only`) and trigger it from the button. The same `onChange` applies.
    2. **Colors** `Droplet`: swatch buttons `size-10 rounded-xl ring-1 ring-border` (selected `ring-2 ring-primary ring-offset-2 ring-offset-card`), with a hidden `input type=color` per swatch plus a hex `Input className="h-8 w-28 font-mono text-xs uppercase"`.
    3. **Font** `Type`: a shadcn `Select` whose items render in their own font (`style={{fontFamily}}`), replacing the native select.
    4. **Captions** `Captions`: the same preset tiles as §8.4.
    5. **Watermark/position** `Move`: a 3×3 position grid `grid grid-cols-3 gap-1 size-24` of `rounded-md border` cells (selected `bg-primary`) and opacity/size `Slider`s (replacing the native ranges).
    6. **F4 Intro/Outro** `Clapperboard`: two `ToggleRow`s plus a file picker per row, only if supported.
  - **Right:** `lg:sticky lg:top-20` with **live preview**: a phone frame `mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[28px] border-[6px] border-neutral-800 bg-[linear-gradient(160deg,#2a2b3d,#0e0f16)] shadow-lg`. It shows the logo at the watermark position and opacity, and a sample caption in the selected font, colors and preset (reuse `caption-anim.css`). This replaces the black "BRAND" box and uses the same state values as props.
- **Save:** a `StickyActionBar` shown when the form is dirty (compare with the initial value already in state; if no dirty flag exists, always show it). It reads `text-sm text-muted-foreground` "Unsaved changes", followed by `Button variant="ghost"` "Discard" (only if a reset exists) and `PrimaryButton` with `Save` "Save brand kit" (same save, toast §6.13).
- **F4 Templates tab:** `grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4` of `BrandTemplateCard`s:
  - each card is `rounded-xl border bg-card overflow-hidden hover:border-primary/40`, with a preview `aspect-video` showing the template colors and logo, a name, a "Default" `StatusBadge tone="brand"` with `Star`, and a `DropdownMenu` (Set default `Star`, Duplicate `Copy`, Rename `Pencil`, Delete `Trash2` behind an `AlertDialog`), all existing handlers;
  - a "New template" dashed tile with `Plus`.
  
  If the F4 data model doesn't exist yet, **don't render this tab**.

---

## 10. `/app/clips/exports` Exports (`exports-list.tsx`)
- `PageHeader icon={Download} title="Exports" description="Rendered clips are kept for 7 days."` (use the real retention constant if one exists).
- **Toolbar:**
  - the existing All/Ready/Failed filter becomes a `ToggleGroup` with counts (`<span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">{n}</span>`), plus Rendering if that state exists;
  - a search `Input` filtering the in-memory list by title (client-only);
  - when the F2 aspect field exists, an aspect `Select`;
  - right-aligned **Download selected (n)**: `PrimaryButton` with `PackageOpen`, shown only when rows are selected. It loops over the **existing per-row download handler** with a 300 ms stagger. No zip endpoint is added.
- **Table** (`Table` inside `Panel`, `overflow-hidden`):

| Col | Content / classes |
|---|---|
| ☐ | `Checkbox` (only READY rows selectable), header checkbox = select-all-visible |
| Clip | `flex items-center gap-3`: thumbnail `h-12 w-[27px] rounded-md object-cover bg-muted` (9:16) + title `text-sm font-medium line-clamp-1` + project `text-xs text-muted-foreground` (show the project title if present in the row data; otherwise the shortened id `font-mono`) |
| Aspect | `AspectGlyph` + `text-xs` (F2, if the field exists) |
| Quality | `Badge variant="outline"` "720p" + watermark `Droplet` icon when watermarked |
| Status | `RenderStatusBadge` (replaces the uppercase text) |
| Size | `font-mono text-xs tabular-nums` |
| Created / Expires | relative time; expires < 24 h → `text-warning` + `TimerOff` |
| Actions | `Button size="icon" variant="ghost"` `Download` (Tooltip "Download"), disabled unless READY; FAILED rows show `Tooltip` with the error + `Info` icon |

- Row hover is `hover:bg-muted/40`, and the header is `text-[11px] uppercase tracking-wider`.
- **Mobile (`<md`):** the table becomes cards, `rounded-xl border p-3 flex gap-3`, with the same content.
- Empty state is §6.10, and the skeleton is §6.11.

---

## 11. Accessibility and responsive (acceptance-level requirements)
- **Contrast:** every text/background pair is AA (4.5:1) in both themes. Run `@axe-core/playwright` (dev-dep, `pnpm -C new-app add -D @axe-core/playwright`) in a new `e2e/a11y.spec.ts` over `/app/clips`, `/app/clips/new`, a project, the editor, brand and exports. **Zero serious or critical violations** in dark and light.
- **Icon-only buttons:** each has `aria-label` and a `Tooltip`. Decorative icons get `aria-hidden` (lucide does this by default unless `aria-label` is set).
- **Focus:** every interactive element shows `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`. Do not remove outlines without a replacement.
- **Keyboard:** the editor shortcuts are unchanged. The rail is arrow-navigable. ⌘B toggles the sidebar (shadcn). Dialogs trap focus (Base UI). The skip link is first in the tab order.
- **Live regions:** save state (`aria-live="polite"`), processing step (`aria-live="polite"`), and toasts (sonner already announces).
- **Motion:** honour `prefers-reduced-motion` (§3.4). Hover-play does not autoplay when reduced motion is set; check `matchMedia('(prefers-reduced-motion: reduce)')` inside the existing hover handler **before** `play()`. This is the single allowed guard.
- **Hit targets:** at least 36 px (`size-9`) on touch. Card hover actions are always visible on `(hover:none)`.
- **Breakpoints:**
  - `<md`: the sidebar is a Sheet, the top bar is compact, grids are 1–2 columns, and the editor panel is a bottom sheet;
  - `md–lg`: the sidebar is icon-collapsed by default;
  - `lg+`: the full editor 3-column layout.
- **Test at** 375×812, 768×1024, 1280×800 and 1536×900. There must be no horizontal page scroll at any of these widths.

---

## 12. No-regression contract (the reviewer rejects a PR that breaks any of these)
1. **No changes** to `prisma/**`, `app/api/**`, `lib/server/**`, `worker/**`, `lib/clips/edits*.ts`, `lib/clips/*-client.ts` or any fetch URL, method or body.
   - Exceptions: `lib/clips/format.ts` (moved formatter, identical output) and the read-only `listClipProjects` call in §7.1.
2. Every `onClick`/`onChange`/`onSubmit`/`onKeyDown` handler keeps the same function reference and arguments. Wrapping a handler for a toast is allowed only as `async () => { await same(); toast… }` or `toast.promise(same())`, with the return value and thrown errors propagated.
3. Hooks in `editor-shell.tsx` (`useEditorState`, `useGeneration`, `useDubPreview`, `useAudioMix`), their call order and their arguments are unchanged. The keyboard handler effect is unchanged. The 800 ms title debounce is unchanged.
4. Polling intervals are unchanged (JobStatus 4 s).
5. Tab `value` strings are unchanged. URLs and routes are unchanged; `Templates` uses a query param on the same route.
6. `data-testid` attributes are preserved. Add `data-testid` on new wrappers: `app-sidebar`, `app-topbar`, `editor-rail`, `project-grid`, `clip-card`, `score-ring`.
7. The existing `vitest` and `playwright` suites pass unchanged. Snapshot updates are allowed only for pure markup/class changes, and must be listed in the PR description.
8. Native → shadcn swaps (select, range, checkbox, file input) must emit the **same value types** to the existing handlers. Base UI `Slider` returns `number | number[]`; normalise it at the call site.
9. Features F1–F6 are **only styled if they already exist in the code**. When the code for one doesn't exist, the spec'd UI slot is omitted. Do not add backends here; those belong in the Descript build spec.

---

## 13. Order of work: small commits with browser acceptance checklists
Run the dev server with `pnpm -C new-app dev` (port 3100). After each commit, run `pnpm -C new-app typecheck && pnpm -C new-app lint && pnpm -C new-app test`.

| # | Commit message | Files | Browser acceptance checklist |
|---|---|---|---|
| 1 | `ui(tokens): geist via next/font vars, dark-first OKLCH tokens, next-themes` | `app/layout.tsx`, `app/globals.css`, `lib/ui/tones.ts`, `components/ui/sonner.tsx` | ☐ DevTools `getComputedStyle(document.body).fontFamily` starts with the next/font hashed Geist family ☐ `<html class="dark">` on load ☐ background ≈ #0d0e14 ☐ toggling `.dark` off in DevTools shows the light palette with no unreadable text ☐ tab title "Projects · Transovo Clips" (after commit 5) or "Transovo Clips" ☐ every page still works |
| 2 | `ui(deps): shadcn sidebar/skeleton/scroll-area/toggle-group/slider/breadcrumb/alert-dialog…; lucide 1.61` | `components/ui/*` (new only), `hooks/use-mobile.ts`, `package.json`, `pnpm-lock.yaml` | ☐ `git diff --stat components/ui` shows only new files ☐ app boots, no console errors |
| 3 | `ui(kit): PageHeader icon, PrimaryButton, StatusBadge icons, EmptyState, kit.tsx, ScoreRing, DurationChip` | `components/app/*`, `components/clips/ui/*`, `lib/clips/format.ts` | ☐ Projects empty state shows the gradient tile and icon ☐ Help/Settings headers still render ☐ durations display identically to before |
| 4 | `ui(shell): collapsible grouped sidebar, Record item, top bar + breadcrumbs, theme toggle` | `components/shell/*`, `lib/nav.ts`, `app/app/layout.tsx`, editor root height | ☐ groups Create/Library/Brand/Exports in order ☐ Record, Editor and Voice show "Soon" and are not clickable ☐ ⌘B collapses to icons with tooltips; the state survives reload ☐ mobile 375 px: the hamburger opens a sheet ☐ breadcrumbs correct on all 6 route types ☐ theme toggle switches and persists ☐ Integrations/Settings/Help reachable from the avatar menu ☐ editor fills the viewport with no double scrollbar |
| 5 | `ui(projects): project grid wired to listClipProjects, toolbar, skeleton` **[DATA-WIRE-1]** | `app/app/clips/page.tsx`, `loading.tsx`, `components/clips/project-card.tsx`, `projects-toolbar.tsx` | ☐ existing projects appear (e.g. `proj_87fe33…`) ☐ status badge colours: Processing blue spinner, Ready green, Failed red ☐ the `?status=failed` filter works ☐ search filters ☐ no projects shows the empty state |
| 6 | `ui(new): source picker drag state, option tiles, sticky CTA` | `new-project-workspace.tsx`, dropzone, settings form | ☐ dragging a file highlights the drop area with a glow ☐ uploading shows a progress row and cancel works ☐ "Get clips" creates a project and navigates (same as before) ☐ toasts appear ☐ link tab only if F1 exists ☐ mobile layout has no overflow |
| 7 | `ui(project): processing stepper, failed state, clip cards with score ring + hover-play` | `job-status.tsx`, `project-results.tsx`, `clip-card.tsx`, `project-clips-view.tsx` | ☐ processing project: the active step glows and polls (Network shows the 4 s cadence) ☐ cancel asks for confirmation, then cancels ☐ failed project shows the alert block ☐ ready project: ring colours by score, duration chip, hover plays the preview (`preview_play` event still POSTs) ☐ Edit, Download and Make thumbnail work, with toasts |
| 8 | `ui(editor): icon rail, top bar, layout grid, player controls, timeline lanes` | `editor-shell.tsx`, `editor-top-bar.tsx`, `editor-rail.tsx`, `player-controls.tsx`, `timeline.tsx` | ☐ 9 rail icons with tooltips; clicking switches the panel; Producer chat history survives tab switches ☐ Space/←/→/Delete/⌘Z/⇧⌘Z behave as before ☐ save state shows Saving…→Saved ☐ timeline lanes labelled, playhead moves, click-to-seek works |
| 9 | `ui(editor-panels): script, layout, captions, b-roll, audio, cover, dub, brand` | `editor/*-panel.tsx`, `caption-preset-picker.tsx`, `brand-tab.tsx` | ☐ speaker chips coloured ☐ cut words strike through and the cut changes the preview ☐ caption tiles animate, selection applies to the preview ☐ the animation Select works ☐ sliders change the mix (audible) ☐ stock b-roll insert appears on the lane ☐ dub preview plays ☐ no native `<select>`/`range` left in the editor (`document.querySelectorAll('select,input[type=range]').length===0`) |
| 10 | `ui(producer): chat bubbles, typing, tool-call cards, paid confirm, composer` | `producer/*` | ☐ send shows the user bubble then typing dots then the reply ☐ tool cards show icons and status ☐ the paid card Generate/Skip works ☐ suggestion chips prefill only ☐ Enter sends (if it did before) |
| 11 | `ui(export+brand+exports): export dialog, brand kit + live preview, exports table` | `export-dialog.tsx`, `brand-editor.tsx`, `exports-list.tsx` | ☐ export from the editor queues with a toast and View link ☐ .srt toggle and audio track still respected (inspect the request body, identical to before) ☐ brand: change color/font/logo and the preview updates live; save toasts and persists across reload ☐ exports: badges coloured, filters work, multi-select downloads each file ☐ mobile cards |
| 12 | `ui(a11y): axe checks, focus rings, reduced motion, after screenshots` | `e2e/a11y.spec.ts`, fixes | ☐ axe: 0 serious/critical in both themes ☐ keyboard-only pass through the sidebar, projects, editor rail, dialogs ☐ re-run `/workspace/shot/shot.js` + `shot2.js` into `/workspace/plan/ui_after/` and attach the before/after pairs to the PR |

---

## 14. lucide-react icon map (single source; all exist in lucide-react ≥ 1.16, or 1.61 for `CloudCheck`/`CloudAlert`)
- **Shell:** `Plus`, `Video` (Record), `Clapperboard`, `Scissors`, `AudioLines`, `Palette`, `LayoutTemplate`, `Download`, `Search`, `Bell`, `Sun`, `Moon`, `SunMoon`, `Plug`, `Settings`, `LifeBuoy`, `FlaskConical`, `ChevronRight`, `ChevronLeft`, `PanelLeft`.
- **Status:** `Loader2`, `CheckCircle2`, `XCircle`, `Ban`, `FilePen`, `Clock`, `TimerOff`, `AlertTriangle`, `RotateCcw`, `CircleStop`, `Info`.
- **Upload/project:** `UploadCloud`, `Upload`, `Link2`, `Youtube`, `Globe`, `FolderOpen`, `FileVideo`, `X`, `Film`, `PackageOpen`, `MoreHorizontal`, `ExternalLink`, `ArrowUpDown`, `LayoutGrid`, `Grid3x3`, `List`, `SearchX`, `Coins`, `Wand2`, `Timer`, `RectangleVertical`, `Mic`, `User`, `Users`, `Gamepad2`, `GraduationCap`, `Camera`, `Shapes`.
- **Processing steps:** `UploadCloud`, `FileText`, `ScanLine`, `Sparkles`, `Crop`, `CheckCircle2`, `Check`.
- **Editor rail:** `Sparkles`, `FileText`, `LayoutPanelTop`, `Captions`, `Clapperboard`, `Music2`, `Image` (as `ImageIcon`), `Languages`, `Palette`.
- **Editor misc:** `ArrowLeft`, `Undo2`, `Redo2`, `CloudCheck`, `CloudAlert`, `Play`, `Pause`, `Maximize2`, `PanelRightOpen`, `ArrowUp`, `Type`, `SlidersHorizontal`, `AudioWaveform`, `Trash2`, `ImagePlus`, `ImageDown`, `Copy`, `Maximize`, `Minimize`, `Rows2`, `ScanFace`, `PictureInPicture2`, `ZoomIn`, `SmilePlus`, `GaugeCircle`, `Highlighter`, `AlignVerticalSpaceAround`, `ArrowDownToLine`.
- **Brand/exports:** `Droplet`, `Move`, `Save`, `Star`, `Pencil`, `Upload`.

> If an icon name fails to import (lucide renames occasionally), use the alias that lucide's `icons` index lists. For example, `GaugeCircle` may be `CircleGauge` in 1.x. Check with `node -e "console.log(Object.keys(require('lucide-react')).filter(k=>/Gauge/.test(k)))"`.
