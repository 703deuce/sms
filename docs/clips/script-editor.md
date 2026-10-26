# Transovo Script Editor: Implementation Spec (v1.0)

**Status:** Spec only. No code has been written. Prepared 2026-10-26 (ET).
**Order of work (owner's direction):** finish the regular Clipper first, then build this editor. Streamer VOD comes after. AI Studio and Screenwriting are on hold, so the AI chat assistant (Underlord-style) is **out of scope** here.
**Reference product:** Descript (2025–2026 UI). Comparables: Riverside editor, Adobe Premiere Text-Based Editing, Kapwing Trim-with-Transcript.
**Screenshots:** `/workspace/specs/descript-refs/` (17 images, sources in `SOURCES.txt`, overview in `contact_sheet.png`).
**Citations:** `[D:path]` means `https://help.descript.com/path`. Every Descript page also has a markdown version at `…/path.md`.

---

## 0. Read this first: rules that prevent another "buttons and empty space" launch

The screenwriting browser test (`/workspace/specs/sw-browser-test-1.md`) found these failures: tasks marked DONE with nothing on screen, buttons that did nothing, coarse undo, exports that didn't match the editor, and a "local save mode" banner left in. This editor is built under these rules:

1. **Done means the Section D tests pass in a production browser.** A row is DONE only if someone ran its steps on transovo.ai and saw the expected result. Unit tests alone don't count.
2. **No dead controls.** Every visible button, menu item and shortcut works. A control that isn't ready is left out entirely. Don't ship it disabled with "coming soon". The one exception is a control that is disabled for a real reason; it needs a tooltip saying why (e.g. "Side-by-side needs a wider window", matching Descript's View menu [D:descript-tour/view-menu]).
3. **No empty regions.** Every panel has four designed states: loading (skeleton), empty (an explanation plus a primary action), error (message plus **Retry**), and ready. A blank rectangle is a bug.
4. **One edit model.** The preview player, timeline, captions, export and transcript export all read the same EDL (§B1). Their outputs must match frame for frame and word for word.
5. **One undo stack per composition.** Each user gesture is exactly one undo step (§B2.8).
6. **No banners about internal milestones.**
7. **It must look like the reference.** Compare against `contact_sheet.png` and the 20-item visual checklist (§D2) before calling a milestone done.

---

# Section A: Layout

## A1. Regions overview (desktop ≥ 1280 px wide; default "Side-by-side")

Modeled on the Descript editor (refs `01_descript_main_editor_labeled.png`, `14_descript_underlord_panel_resize_handles.png`; [D:descript-tour/the-editor-interface], [D:descript-tour/customize-the-editor]).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [1] TOP BAR  ⌂  ◀ Back to project | ↶ ↷ | ✓ Saved     Project ▸ Composition ▾   [?] [Export ▾]│  48px
├──────────────────────────────────────────────┬───────────────────────────────┬───────┬──────┤
│ [2] SCRIPT EDITOR                       ⋮    │ [3] PREVIEW / SCENE CANVAS    │ [5]   │ [6]  │
│  ┌ toolbar: [Correct C] [Find ⌘F] [Filler 15]│   ┌──────────────────────┐    │ SIDE  │ ICON │
│  │                          Aa  ⋯           │   │                      │    │ PANEL │ RAIL │
│  Composition title (h1)                     │   │   video frame (9:16, │    │ 320px │ 56px │
│  ● Rick   0:00                              │   │   16:9, 1:1 …)       │    │       │ ▣ Pr │
│  So today we're gonna ~~um~~ talk about the │   │   captions overlay   │    │ (Pro- │ ✦ AI │
│  new ▌clipper and why it [matters]. …       │   └──────────────────────┘    │ perti-│ CC   │
│  ● Guest  0:14                              │   [9:16 ▾] [Reframe: Auto ▾]  │ es,   │ ♪ Md │
│  Yeah, I think …  ⁝ (edit boundary)         │   [Captions ●]                │ Capt- │ ⇪    │
│  (word under playhead = highlighted)        │                               │ ions, │      │
│                                     ↕ scroll│                               │ …)    │      │
├────────────── ↔ drag handle ────────────────┴──────── ↔ drag handle ───────┴───────┴──────┤
│ ═══════════════════════ ▲ drag handle "Resize timeline (⌃⌥T)" ═══════════════════════════════ │
│ [4] TRANSPORT  ⏮ ⏭  ⚑markers  0:20.5 / 43:12.0   ▶  1x ▾  ✂ Split        − 116% +  ⤢Fit [A▾]│  44px
│ ─ TIMELINE ───────────────────────────────────────────────────────────────────────────────── │
│ ruler  |0:00      |0:05      |0:10  ⚑    |0:15      |0:20                                     │
│ CC     [captions layer bar ─────────────────────────────────────────]                        │
│ words  [So][today][we're][gonna][um][talk][•1.0s][about] …        ← wordbar                   │
│ script [▦thumb▦thumb▦thumb][≈≈≈≈waveform≈≈≈≈≈≈≈≈┊≈≈≈≈≈≈≈]   ┊ = cut / edit boundary           │
│                         ▲ playhead (blue line, synced with the script cursor)                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Region | Default size | Contents |
|---|---|---|---|
| 1 | Top bar | 48 px tall, full width | Left: Transovo logo/home, **Back to project** (returns to the clips project), undo/redo, **save status** (§C2). Center: breadcrumb `Project name ▸ Composition name ▾`. The dropdown switches between the "Full video" composition and clip compositions, and offers "Rename" and "Duplicate composition". Right: Help (shortcuts sheet) and the dark primary **Export** button. Descript puts Export at the top right ([D:export-and-share/export-and-publishing-overview], ref 15). |
| 2 | Script editor | flex; min 360 px; default 46% of the width left over after the side panel | A document-style transcript. A sticky mini-toolbar at the top holds **Correct** (toggle), **Find**, and a **Filler words** count pill. Below it: the composition title, paragraphs grouped by speaker with a colored speaker label and the paragraph's start time, and the words. Max line length 72ch, 17px/1.65 font, centered column. |
| 3 | Preview canvas | flex; min 320 px | The video rendered from the EDL at the selected aspect ratio, letterboxed on a neutral background, with the live captions overlay. A **pill bar** under the canvas holds the aspect ratio, the Reframe mode (Auto speaker-follow / Center / Manual), and a Captions on/off toggle. Like Descript's `Layout | Background | layers` pill (ref 07). |
| 4 | Transport + timeline | collapsed: 44 px (transport only); expanded default: 280 px; min 160; max 60% of the height | Transport row, then the time ruler, caption lane, wordbar and script track (§B4). Collapsing and expanding follows Descript ([D:timeline/timeline-overview]). |
| 5 | Side panel | 320 px (resizable 280–480), closable | Shows the panel picked in the rail: **Properties** (default), **Captions**, **Edit tools** (filler words, shorten gaps), **Media** (later), **Versions**. |
| 6 | Icon rail | 56 px, always visible | Vertical icon buttons with tooltips and the active one highlighted. Clicking the active icon closes the panel. Descript has the same rail ([D:descript-tour/the-editor-interface], ref 01/13). |

## A2. Toggling, resizing and placement

- **Drag handles** sit between script and canvas, between canvas and side panel, and above the timeline. The handle area is 8 px wide but draws as a 1 px line, which highlights in the accent color on hover and while dragging. The cursor changes to `col-resize` / `row-resize`. Double-clicking a handle resets that split to its default. ([D:descript-tour/customize-the-editor]: "Resize the Script editor, scene editor, Timeline, and sidebar by clicking and dragging the border between panels".)
- **Timeline**: clicking the handle toggles collapsed/expanded. Dragging resizes. Shortcut `Ctrl+Alt+T` (Descript uses ⌃⌥T for reveal [D:timeline/timeline-overview]; `Shift+⌘S` for toggle [D:descript-tour/keyboard-shortcuts]). We bind both.
- **View menu** (in the composition ▾ or ⋯ menu): Scene placement is **Side-by-side** (default), **Stacked** (canvas above the script), or **Full video** (canvas fills the space, script hidden; `Cmd/Ctrl+.`). Side-by-side is disabled under 1100 px, with a tooltip. These match Descript's three placements [D:descript-tour/customize-the-editor].
- Script font size: `Cmd/Ctrl+Shift+=` / `-` [D:descript-tour/keyboard-shortcuts].
- Panel sizes, placement, the open side panel and timeline height are saved **per user** in localStorage and restored when the editor reopens.
- **Responsive:**
  - 1100–1280 px: the side panel overlays the canvas (drawer) instead of pushing it.
  - < 1100 px: Stacked placement is forced.
  - < 768 px: show "The script editor needs a larger screen" with a **Back to project** button. No broken layout.

## A3. Region detail

**Script editor (2)**
- Speaker label: a colored dot or name chip (each speaker's color is stable) plus a muted timestamp. Clicking the name opens the rename popover (§B2.9). Descript shows green speaker names (ref 01, 05).
- Paragraph break rules: a new paragraph starts on a speaker change, or on a pause > 2.0 s from the same speaker. Users can also press Enter, which adds a paragraph break with no effect on the media.
- Word states and their styles:

| State | Style |
|---|---|
| normal | default text |
| playhead/current word | accent background `rgba(accent, .22)`, radius 3 px |
| selected | system selection blue |
| hover | faint underline |
| filler word | **dotted light-blue underline** (Descript: "underlined in light blue" [D:script-editing/filler-words]; ref 08) |
| ignored | gray text with strike-through and a dotted outline around the run; hovering shows a popover **Restore ↶ / Delete ⌫** (ref 09; [D:script-editing/delete-vs-ignore]) |
| corrected (text differs from ASR) | no permanent mark; a dotted gray underline while re-aligning ([D:script-editing/correct-your-transcript]). Riverside uses a dotted purple underline for corrected words; we show ours only in Correct mode |
| low-confidence ASR word (< 0.5) | faint orange dotted underline, only in Correct mode |
| search hit | yellow background; the current hit is orange |
| edit boundary (cut point) | a thin split vertical glyph `¦` drawn between words ([D:script-editing/edit-boundaries], [D:script-editing/restore-removed-media]) |
| gap chip | an inline pill `•1.2s` for an inserted gap clip |

- A **selection toolbar** floats above a non-empty selection, like Descript's ([D:descript-tour/selection-toolbar]): `Delete · Ignore · Replace with gap · Correct (C) · Copy · ⋯`. In Kapwing it is a single "Delete" chip (ref 17).
- Right-click menu: Cut, Copy, Paste, Delete, Ignore, Restore removed media, Correct, Edit word gap ▸, Add speaker (@), Copy timestamp.

**Preview canvas (3)**
- Renders the composition's current output frame: the source frame at the mapped source time, cropped by the reframe track, with the caption overlay drawn by the same caption renderer used for export (WebGL/Canvas2D port of the existing caption styles).
- Clicking the canvas toggles play/pause. Hovering shows a minimal scrub bar. Holding Space plays.

**Transport (4a)**: `⏮ previous cut/paragraph` · `⏭ next` · markers dropdown · timecode `current / total` (output time, tenths of a second, e.g. `0:20.5 / 0:43.5` as in ref 03) · **▶/⏸** · speed `0.5–3x ▾` (editor only, like Descript [D:descript-tour/playback-and-navigation]) · **✂ Split** · right side: zoom `− NN% +`, **Fit** (whole composition), tool picker (Select A / Blade B / Hand H).

**Side panel (5)** contents are in §B5. The Properties panel follows Descript's selection-driven rule [D:descript-tour/properties-panel]:
- nothing selected → composition properties
- caption layer selected → caption style
- script clip selected → clip audio, volume, speed

---

# Section B: Editing behavior

## B1. Data model (the foundation; build it first)

```
SourceMedia   { id, projectId, durationMs, fps, proxyUrl(HLS 720p), audioPeaksUrl, thumbsSpriteUrl, transcriptId }
Word          { id (stable, immutable), sourceId, t0Ms, t1Ms, text (ASR), conf, speakerId, isFiller, fillerKind }
Speaker       { id, name, color }
Composition   { id, projectId, kind: 'full'|'clip', clipId?, aspect, reframe, captionStyleId, captionPos,
                revision, title, createdAt }
Token         { tokenId, kind: 'word'|'gap'|'paraBreak'|'speakerChange'|'sceneBreak'(later),
                wordId?, gapMs?, ignored: bool, textOverride?: string, speakerOverride?: speakerId }
Document      = ordered Token list (stored as a piece table / balanced tree of runs, not one giant array)
EDL (derived) = ordered Segments { srcId, srcInMs, srcOutMs, outInMs, outOutMs } | GapSegment { durMs }
```

Rules:
1. **Source media is never modified.** Every edit is non-destructive. Deleted media stays recoverable, matching Descript, which "hides cut media instead of erasing it" [D:script-editing/restore-removed-media].
2. **Delete** removes tokens from the Document. Each pair of adjacent kept tokens whose source times aren't contiguous creates an **edit boundary**. The boundary remembers the removed source range so **Restore removed media** can put it back.
3. **Ignore** keeps the tokens but sets `ignored=true`. They render struck-through, they're skipped during playback and export, and they're kept in transcript export only if the user opts in ([D:script-editing/delete-vs-ignore] export behavior).
4. **Correct** sets `textOverride`. Media and timing don't change. The override is used for display, captions, SRT/VTT and transcript export. "Correct all" applies it to every token with the same normalized ASR text (case-insensitive, punctuation stripped).
5. **EDL derivation** (pure function, unit-tested, shared by preview, timeline, export and captions):
   - Walk the kept, non-ignored tokens. Merge consecutive word tokens that are source-contiguous (word *n+1* directly follows word *n* in source order, from the same source) into one Segment, covering from the first word's cut-in to the last word's cut-out, including the natural pauses between them.
   - **Cut points** at an edit boundary between kept word A (ends `a1`) and kept word B (starts `b0`):
     - Out-point = `a1 + min(PAD, (nextSrcWordStart − a1)/2)`, where nextSrcWordStart is the start of the removed word that followed A in the source.
     - In-point = `b0 − min(PAD, (b0 − prevSrcWordEnd)/2)`.
     - `PAD = 80 ms` by default. This keeps breaths and plosives from being clipped and never cuts into a neighboring word.
   - A 10 ms audio crossfade at every cut prevents clicks (Descript adds automatic micro-fades at edits [D:timeline/automatic-microfades]).
   - A gap token gives a GapSegment. Its picture is a freeze frame of the previous frame and its audio is silent.
6. Output time ↔ source time mapping uses prefix sums over the segments with binary search: O(log n).
7. Reframe keyframes and speaker-follow data live in **source time** (they come from the Clipper's analysis) and are mapped through the EDL. Editing never requires re-running reframe.
8. Captions are generated from kept, non-ignored word tokens in **output time**, using `textOverride ?? text`.

Persistence: Document changes are stored as an **op log** (`insertTokens`, `removeTokens`, `setIgnored`, `setText`, `setSpeaker`, `insertGap`, `setGap`, `setBoundaryPad`, `setCompositionProp`). Every op has a client UUIDv7 `opId` and a `baseRevision`. The server keeps a snapshot every 200 ops. If the team reuses Yjs from screenwriting, the same op semantics and the same single-UndoManager rule apply.

## B2. Core text-based editing

| # | Behavior | Exact spec | Ref |
|---|---|---|---|
| B2.1 | Word-level sync | Every displayed word maps to `[t0,t1]` in source time and, through the EDL, to output time. Alignment comes from the existing Transovo transcript (word timestamps required; if a transcript lacks word timing, run forced alignment before opening the editor). | [D:script-editing/the-wordbar] |
| B2.2 | Click to seek | A single click on a word places the text cursor **and** moves the playhead to that word's output start. The preview shows that frame within 250 ms. `Alt/Option+Click` starts playback from the word (Descript: Option+Click plays). | [D:descript-tour/keyboard-shortcuts] |
| B2.3 | Current-word highlight | During playback the word under the playhead is highlighted (style in §A3). The script auto-scrolls so it stays in the middle third of the viewport. If the user scrolls manually, auto-scroll pauses and a "↓ Follow playhead" chip appears; `Esc` or the chip resumes it (Descript: Esc = autoscroll). The text cursor moves independently during playback so the user can edit while it plays. When stopped, cursor and playhead move together. | [D:descript-tour/playback-and-navigation] |
| B2.4 | Delete cuts media | Select words and press `Delete/Backspace`: the tokens are removed, the media cut, the EDL rebuilt and the timeline rippled. Playback skips the cut. Shows an edit boundary `¦`. With no selection, Backspace deletes the previous word. Deletion can't remove a speaker label alone: if a whole paragraph is deleted, its label goes with it. | [D:script-editing/delete-vs-ignore] |
| B2.5 | Ignore vs delete | `Cmd/Ctrl+Backspace` ignores: gray strike-through, kept visible, skipped in playback. Hovering ignored text shows **Restore** / **Delete**. Ignored text is excluded from video, audio, captions and SRT/VTT, and is optional in the transcript export. | [D:script-editing/delete-vs-ignore]; Riverside: deleted words show gray strike-through and a click restores them |
| B2.6 | Restore removed media | Right-click an edit boundary, or select across boundaries, then choose **Restore removed media** (`Cmd/Ctrl+Shift+Backspace`). Every removed source range inside the selection is restored in source order, as one undo step. | [D:script-editing/restore-removed-media] |
| B2.7 | Copy / cut / paste / move | `Cmd/Ctrl+C` copies tokens (with their media refs) to an internal clipboard, and also writes plain text to the system clipboard. `Cmd/Ctrl+X` cuts. `Cmd/Ctrl+V` at the cursor inserts those tokens, so the media moves with the words. **Drag-and-drop** of a selection moves it, with a drop caret shown. Pasting plain text from outside Transovo inserts nothing into the media; it shows a toast: "Pasted text has no media. Use Correct (C) to change words." Pasting across compositions in the same project works. | Premiere TBE: cut/copy/paste in text is reflected in the timeline with ripple; Riverside: copy/paste rearranges media |
| B2.8 | Undo / redo | `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z` (also `Ctrl+Y` on Windows). **One stack per composition** covers text, timeline, captions-style and property edits. Each gesture is one step: one delete, one paste, one drag, one "Remove all fillers" (a batch op), one correction, one slider *release* (not every intermediate value). Typing in Correct mode groups by word (a space or 1 s pause closes the group). Undo restores selection and scroll position. The stack survives reloads (stored with the op log, last 200 steps). The undo/redo buttons in the top bar are disabled when there is nothing to undo or redo. | Screenwriting test #1 item 5 |
| B2.9 | Correct a word without changing media | Select a word and press `C` (or toolbar **Correct**). It becomes an inline input; Enter commits. Choose **Correct** (this instance) or **Correct all** (shows "Correct all (7)"). **Correct mode** toggle (`Alt/Option+C`): the script behaves like a normal text field for text only. Media is never changed, and typing never cuts. A banner pinned in the script toolbar says "Correct mode: text changes won't affect media" with an Exit button. `Hold Z + click` toggles capitalization; `Hold X + click` cycles punctuation (. ? , none). Splitting one ASR word into two divides its time proportionally by character count. Merging joins their spans. | [D:script-editing/correct-your-transcript]; Riverside: C to correct, "Correct all" |
| B2.10 | Speaker labels | Clicking a label opens an input with a dropdown: **Rename "Speaker 1" to "Elvira"** (renames everywhere in the project) vs **Create speaker "Elvira"** (applies only to this paragraph), plus the list of existing speakers (reassign). `@` at the cursor, or with a selection, opens the same menu to re-label the selection (inserting a speakerChange token). The ⋯ menu offers Change color, Merge into…, Remove (reassigns to the speaker above). | [D:script-editing/speaker-labels]; ref 10 |
| B2.11 | Find / replace | `Cmd/Ctrl+F` opens a find bar at the top of the script with a match count `3/27`, Enter / Shift+Enter (or `Cmd+G` / `Shift+Cmd+G`) to move between matches, and options **Match case** and **Whole word**. **Replace** only does text correction (it's Correct-all scoped to matches). A **Delete all matches** button cuts their media, as one undo step. | [D:descript-tour/keyboard-shortcuts]; Riverside: Ctrl/Cmd+F, Enter / Shift+Enter |
| B2.12 | Selection semantics | Selection always snaps to whole words (no partial-word media cuts in the script; sub-word trimming is done on the timeline). Shift+click extends the selection. Double-click selects a word, triple-click a paragraph. `Cmd/Ctrl+A` selects all. Shift+arrows extend by word. |  |
| B2.13 | Typing new words (not Correct mode) | Typing letters outside Correct mode **does not** create media. It opens the Correct popover pre-filled with the typed character and the hint "To change words, use Correct. Generating new speech isn't available." (AI voice regenerate is out of scope.) This prevents silent text/media drift. | Descript Overdub/Regenerate is out of scope |
| B2.14 | Edit word gap | Right-click between two words and choose **Edit word gap ▸** with presets 0.1 s / 0.25 s / 0.5 s / 1 s / Set manually… The gap is shortened by trimming source silence, or lengthened with a GapSegment. The edited section plays back automatically. | [D:script-editing/word-gaps] |
| B2.15 | EDL invariants | After every op: the EDL is ordered with no overlapping output ranges, total duration = Σ segments, every kept word appears exactly once, and ignored words don't appear. An assertion runs in dev and staging; in production, failures are logged to telemetry. |  |

## B3. Filler words and silences

Descript reference: ref 08; [D:script-editing/filler-words], [D:script-editing/shorten-word-gaps].

- **Detection** (server-side, when the transcript is ready; English at launch):
  - A lexicon match on `um, uh, er, ah, hmm, mm, uh-huh(when standalone), like*, you know*, I mean*, sort of*, kind of*`. Starred items are counted only when they are prosodically isolated (a gap ≥ 120 ms on either side, or ASR marked them disfluent).
  - **Repeated words** ("the the") are flagged as `fillerKind='repeat'`.
  - **Silences**: a gap between consecutive words > a threshold (default 0.75 s).
- **Highlight:** fillers get a dotted light-blue underline. Silence > 1 s shows as an inline `•••1.5s` chip in the script, like the gap chips on Descript's wordbar (ref 04).
- **Count pill** in the script toolbar: `Filler words 15`. Clicking it opens the Edit tools panel, Filler words tab.
- **Remove filler words** opens a review bar pinned at the top of the script, plus a results list in the side panel:
  - Bar: `All filler words ▾ (um, uh, like, repeats…)` · `3/15` · ↑ ↓ · action dropdown **Delete | Delete and replace with gap | Ignore | Remove from transcript only** · toggle **Avoid harsh cuts** · **Remove** · **Remove all** · ✕. Same options as Descript [D:script-editing/filler-words].
  - The list shows each hit with context (±4 words) and a timestamp. Clicking a hit selects it in the script and plays from 1 s before to 1 s after (the "Preview results" option).
  - **One by one:** **Remove** applies to the current hit, then auto-advances (the "Auto-advance" option, default on).
  - **Remove all** applies to every hit of the selected type, as **one** undo step. A toast says "Removed 15 filler words (−9.8 s). Undo".
  - Avoid harsh cuts skips hits whose neighbors are closer than 40 ms on either side, so the cut can't clip a word. Skipped hits are listed with "Skipped: too close to speech".
  - Scope: the whole composition, or "Selection only" when text is selected. This improves on Descript, which needs a duplicate-composition workaround to limit scope [D:script-editing/filler-words].
- **Shorten word gaps** tab: a mode dropdown **more than / between** with duration fields (default "more than 1.0 s"), and **Shorten to** (default 0.3 s). Then **Shorten** / **Shorten all** with the same review bar, ↑↓ and list. A toast shows total time saved. Follows [D:script-editing/shorten-word-gaps].
  - Implementation: shortening trims source silence symmetrically around the gap center, so the EDL creates a cut inside the silence with the 10 ms crossfade.
- Every action is reversible (undo) and the removed media is restorable (§B2.6).

## B4. Timeline

Descript reference: refs 03, 04; [D:timeline/timeline-overview], [D:timeline/timeline-tools], [D:script-editing/the-wordbar], [D:timeline/split-button].

**Lanes at launch**, top to bottom:
1. **Ruler**: output timecode, with tick density adapting to zoom, and marker flags.
2. **Captions lane**: one bar per caption layer. Clicking it selects the layer, which opens its style in Properties.
3. **Wordbar**: word chips at their output positions and gap chips (`•1.0s`). Words merge into "…" groups when zoomed out until they fit, as in Descript.
4. **Script track**: the main media clip(s). Each EDL segment is one clip, with:
   - a filmstrip of **thumbnails** along the top half (from the sprite sheet, one per ~2 s at 100% zoom)
   - the audio **waveform** along the bottom half (multi-resolution peaks)
   - a 2 px vertical line with a **cut marker** at each edit boundary

**Later lanes:** B-roll/overlay lanes, music lane, and a scenes strip (numbered thumbnails as in ref 04).

**Behaviors:**
- **Playhead**: a blue vertical line across all lanes, the same color as the script highlight. Click the ruler to seek. Drag the playhead to scrub with audio (scrub audio plays at 1x in 40 ms grains).
- **Sync with script, both ways**:
  - Selecting a range on the timeline selects the matching words in the script, and vice versa (Riverside: selecting on the timeline highlights the transcript).
  - Hovering a word in the script draws a ghost highlight on its wordbar chip.
  - Scrolling one never moves the other, except when following the playhead.
- **Zoom**:
  - `Cmd/Ctrl+=` / `-`, `Cmd/Ctrl+scroll`, pinch.
  - Range: whole composition fits ↔ 1 frame = 12 px.
  - **Fit** = whole composition. `Alt/Option+Cmd+3` zooms to the playhead.
  - Zoom keeps the point under the cursor fixed.
- **Scroll**: Shift+scroll horizontally, or `H` hand tool drag.
- **Split** (`S` or ✂ button): adds an edit boundary at the playhead without removing media (it splits the script clip into two segments). Useful for trimming.
- **Trim**: drag a script clip edge (Select tool `A`) to extend or shorten it.
  - Shortening removes the trimmed words from the script, shown immediately as an edit boundary.
  - Extending restores removed source media at that edge.
  - The trim snaps to word boundaries unless `Alt` is held (frame-accurate).
- **Ripple**: the script track is **always ripple**. Removing time closes the gap, because a text-first editor's order is the script order. Caption timing follows automatically because it's derived.
- **Word boundary fix**: hold `Cmd/Ctrl` and drag a word chip's edge on the wordbar to re-align it, without changing the text (Descript procedure [D:script-editing/the-wordbar]).
- **Wordbar drag**:
  - Dragging a word chip **left** shortens the gap before it (trims silence).
  - Dragging it **right** inserts a gap: a freeze frame for video, silence for audio [D:script-editing/the-wordbar].
- **Delete on the timeline**: a selected range or clip plus `Delete` = the same op as deleting those words in the script. `Shift+Delete` replaces with a gap clip of the same duration [D:descript-tour/keyboard-shortcuts].
- **Frame step**: ←/→ moves one frame when the timeline has focus; hold to scrub [D:descript-tour/playback-and-navigation].
- **Rendering**: Canvas/WebGL, virtualized (only visible time ±1 screen). Pointer handling at 60 fps.

## B5. Scenes, layouts, captions, media, music, AI tools: launch scope

Transovo already has clip **captions** (Bold Pop and other styles), **reframing** (9:16, speaker follow) and a **render** pipeline. This editor **reuses** them; it does not rebuild them.

| Feature | Descript behavior (ref) | Transovo scope | Launch? |
|---|---|---|---|
| Aspect ratio + reframe | Scene layouts; canvas sizes ([D:templates-and-presets/layouts-apply]) | The canvas pill offers 9:16 / 1:1 / 4:5 / 16:9 and Reframe **Auto (speaker follow)** / **Center** / **Manual** (drag the crop box on the canvas, which creates a keyframe at the playhead). Reframe data comes from the Clipper and is mapped through the EDL. | **Launch-required** |
| Captions | Captions panel with presets (search, filter Default/Basic/Bold/Fun/Trend, sort), apply to Current/All scenes; styling of active word / future words; per-speaker caption layers ([D:visuals/captions], ref 11) | **Captions** side panel: a grid of Transovo's existing caption style cards (Bold Pop, …) rendered as live mini-previews with the composition's real words. The selected style has an accent ring. Properties: font, size, case, colors, **active-word highlight** color/scale, stroke/shadow, words per line / max 2 lines, **position** (drag on canvas, plus Top / Middle / Bottom snap and safe-area guides for 9:16). Captions come from kept, corrected words and update within 300 ms of any edit. | **Launch-required** |
| Captions on/off, burn-in | Captions are layers, subtitles are separate files ([D:export-and-share/subtitles]) | A toggle on the canvas pill; export always uses the current toggle. | **Launch-required** |
| Studio Sound (voice enhance) | A toggle in Audio effects with an intensity setting ([D:effects-animations-transitions/studio-sound], ref 12) | Properties ▸ Audio: **Enhance voice** toggle plus a 0–100% intensity. Server-side job; preview uses the processed proxy audio when it's ready ("Enhancing… 40%"). Only ship it if an enhancement model is already available; otherwise leave it out entirely (rule 0.2). | Later (v1.1, high priority) |
| Audio volume / normalize | Audio % slider; Normalize at export ([D:export-and-share/video-gif]) | Properties ▸ Audio: volume slider (0–200%); export loudness normalize −14 LUFS default. | **Launch-required** (volume + export normalize) |
| Scenes ("/" separator) | `/` inserts a scene boundary; scenes have their own layout and layers; thumbnails mark scene starts in the script ([D:getting-started/scenes], ref 05) | The data model reserves the `sceneBreak` token. v1.1: `/` inserts a scene, which gets its own aspect/reframe/caption visibility and a thumbnail at its start in the script. At launch, `/` types a normal character only in Correct mode and does nothing otherwise. | Later (v1.1) |
| Layouts | A layout picker per scene (ref 07) | Comes with Scenes. | Later (v1.1) |
| B-roll / media insert | Add layer: image/video/stock; layers extend across scenes ([D:visuals/scenes-layers]) | v1.2: Media panel (upload / project clips / stock). Drop on a word to create an overlay anchored to that word (it moves with the text). Overlay lanes go on the timeline. | Later (v1.2) |
| Music | Audio layer, "Lower audio of other layers" (ducking) (ref 02/12) | v1.2: a music lane with a library, fade in/out, auto-duck under speech. | Later (v1.2) |
| Markers / chapters | `#` marker; Add chapters AI tool | v1.1: `#` inserts a marker; the transport markers dropdown; export chapters metadata. | Later (v1.1) |
| Eye Contact | A video effect that redirects gaze; single face, needs a network connection ([D:effects-animations-transitions/eye-contact]) | — | Later (v2) |
| Remove retakes / Edit for clarity / AI chat (Underlord) | AI Tools panel and chat co-editor ([D:descript-tour/ai-tools-overview], ref 13/14; [D:getting-started/underlord-beta-your-ai-co-editor-in-descript]) | Out of scope while AI Studio is on hold. | Later (v2) |
| Regenerate / Overdub (AI voice) | Regenerate to heal cuts ([D:script-editing/edit-boundaries]) | Not offered (B2.13). | Later (v2) |
| Comments / multi-user collaboration | Comments panel, version conflicts ([D:working-in-projects/version-history]) | A single editor per composition with a lock (§C5). | Later |

---

# Section C: Platform

## C1. Keyboard shortcuts (launch set)

Mac uses ⌘ and ⌥; Windows/Linux use Ctrl and Alt. Shortcuts follow Descript where possible ([D:descript-tour/keyboard-shortcuts]). The **?** help button and `Cmd/Ctrl+/` open a searchable shortcuts sheet. The sheet lists exactly the bindings below and nothing that isn't implemented.

| Action | Mac | Windows | Scope / note |
|---|---|---|---|
| Play / pause | Space | Space | Any focus except an active text input |
| Play from cursor | Shift+Space | Shift+Space | |
| Play from clicked word | ⌥+Click | Alt+Click | Script |
| Go to start / end | Home / End | Home / End | |
| Frame step back / fwd | ← / → | ← / → | Timeline focused |
| Word back / fwd (cursor) | ← / → | ← / → | Script focused |
| Extend selection by word | Shift+← / → | Shift+← / → | Script |
| Playback speed −/reset/+ | Shift+J / K / L | Shift+J / K / L | |
| Resume follow-playhead | Esc | Esc | |
| Delete (cut media) | Delete | Backspace / Delete | |
| Ignore | ⌘+Delete | Ctrl+Backspace | |
| Restore removed media | ⇧⌘+Delete | Ctrl+Shift+Backspace | Selection or boundary |
| Replace with gap | ⇧+Delete | Shift+Backspace | |
| Cut / Copy / Paste | ⌘X / ⌘C / ⌘V | Ctrl+X / C / V | |
| Undo / Redo | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Shift+Z, Ctrl+Y | |
| Select all | ⌘A | Ctrl+A | |
| Correct selection | C | C | Script, selection |
| Toggle Correct mode | ⌥C | Alt+C | |
| Toggle capitalization / punctuation | hold Z / X + click | hold Z / X + click | Script |
| Speaker label | @ | @ | Script |
| Find / next / previous | ⌘F / ⌘G / ⇧⌘G (also Enter / Shift+Enter in the find box) | Ctrl+F / Ctrl+G / Ctrl+Shift+G | |
| Split at playhead | S | S | |
| Select / Blade / Hand tool | A / B / H | A / B / H | Timeline |
| Timeline zoom in / out | ⌘= / ⌘− (⌘+scroll) | Ctrl+= / Ctrl+− | |
| Zoom to playhead / fit | ⌥⌘3 / ⇧Z | Ctrl+Alt+3 / Shift+Z | |
| Toggle timeline | ⌃⌥T and ⇧⌘S | Ctrl+Alt+T and Ctrl+Shift+S | |
| Full video view | ⌘. | Ctrl+. | |
| Script text size +/− | ⇧⌘= / ⇧⌘− | Ctrl+Shift+= / − | |
| Export | ⇧⌘E | Ctrl+Shift+E | Opens the export popover |
| Shortcuts sheet | ⌘/ | Ctrl+/ | |

Single-letter shortcuts are disabled while focus is in a text input or in Correct mode. Browser defaults are prevented for bound keys (Cmd+S saves silently and shows "All changes are saved automatically"; Cmd+F never opens the browser's find).

## C2. Autosave, versions, recovery

Descript has no Save button and syncs edits to the cloud as they're made, with a status indicator ([D:working-in-projects/save]). It also has version history with preview and restore ([D:working-in-projects/version-history]) and a recovery article ([D:working-in-projects/recover-project-edits]).

- **There is no Save button.** Every op is written to IndexedDB **synchronously before** it's applied to the UI state, then batched to the server every 500 ms (or immediately on blur or visibility-hidden).
- **Save status** in the top bar:

| Status | Shown when |
|---|---|
| `✓ Saved` | the server has acked up to the latest revision |
| `Saving…` (spinner) | ops are in flight |
| `Offline: changes saved on this device` | navigator offline, or 3 failed sends; keeps retrying with backoff 1→2→4→…→30 s |
| `Couldn't save: retrying` (amber) | 5xx errors |

  Hovering the status shows "Last saved 4:12:09 PM ET". Statuses never stay stuck: every non-✓ state ends at ✓ once connectivity returns, or turns into a red **"Not saved: Reload to recover"** state with a "Download backup (.json)" button after 10 min of failures.
- `beforeunload` warns only if un-acked ops exist.
- **Versions** panel (rail icon):
  - Automatic checkpoints every 10 min of active editing, plus before every bulk action (Remove all fillers, Shorten all gaps, Restore all) and before every export.
  - Manual "Save version" with a name.
  - Each row: name/auto label, **timestamp in the user's zone**, duration, word count, "−N words vs current".
  - Click to **preview** read-only: a banner "Viewing version from Oct 26, 4:10 PM ET: Restore | Back to latest".
  - **Restore** creates a new revision. It never discards history, and it's undoable.
- **Recovery:** on open, if IndexedDB holds ops newer than the server revision (e.g. a crash), they're replayed and synced automatically, with the toast "Recovered 12 unsaved edits".

## C3. Export

Descript's export popover has tabs Video / Audio / Transcript / Subtitles with a preview, destination and resolution (refs 15, 16; [D:export-and-share/video-gif], [D:export-and-share/subtitles], [D:export-and-share/transcript]).

The Transovo **Export ▾** popover (anchored top right, 380 px):

| Tab | Options | Output |
|---|---|---|
| **Video** | Thumbnail preview with duration and estimated size; Scope: **This composition** / Current selection; Resolution: 720p / **1080p** / 4K (plan-gated); Quality: Recommended / High; Captions: Burned in (current style) / Off; **Include subtitle track** (embedded, soft); Loudness normalize −14 LUFS | MP4 (H.264 + AAC) via the **existing Transovo render pipeline** using the EDL plus reframe plus caption style |
| **Audio** | Format: MP3 / WAV; Normalize; Scope | MP3 192 kbps / WAV 48 kHz |
| **Subtitles** | Format: **SRT / VTT**; Show speakers; Max characters per line (default **42**); Max lines per card (default **2**) | A file built from kept, corrected words in output time. Generated on the client instantly, with no job needed. |
| **Transcript** | Format: TXT / Markdown / DOCX (later); Include speaker labels; Timecodes every N s / at paragraphs; Include ignored text (off) | A file |

- Video and audio exports create a **render job** (§C5). The popover shows progress inline ("Rendering 42%… you can keep editing"), and an **Exports** entry appears in Transovo's existing Exports page. When it finishes: Download, Copy link, and a notification.
- An export is pinned to the composition **revision** at the moment the user clicks. Editing afterwards does not change an in-flight export.
- Parity requirement: an exported MP4 played next to the editor preview shows the same cuts, the same caption words and timing, and the same crop (±1 frame).

## C4. Performance (1–3 h transcripts)

Sizing: 3 h ≈ 27,000 words, ~2,000 paragraphs and ~5,000 EDL segments after heavy editing.

| Metric | Budget (p75, 2021 MacBook Air / mid-range Windows, Chrome) |
|---|---|
| Open editor → script interactive (3 h, cached) | ≤ 3.0 s; skeleton shown ≤ 300 ms |
| Click word → frame shown | ≤ 250 ms (proxy) |
| Playhead highlight drift vs audio | ≤ 1 word; updated per animation frame |
| Delete / ignore / paste of up to 5,000 words → painted | ≤ 100 ms |
| Undo / redo | ≤ 100 ms |
| Remove all fillers (1,500 hits) | ≤ 500 ms, plus a toast |
| Timeline zoom/scroll | 60 fps; no frame > 32 ms |
| Playback across a cut | no audible click; visual stall ≤ 1 frame |
| Tab memory (3 h) | ≤ 700 MB |

Required techniques:
- **Virtualized script**: render visible paragraphs ±2 screens; keep the full document in a piece table / B-tree of token runs.
- Highlight the playhead word by toggling a class on one DOM node per frame, **not** by React re-renders. Look up the word by time with binary search.
- **Proxy media**: HLS 720p H.264 for preview. Audio peaks precomputed server-side at 4 resolutions (JSON/binary). A thumbnail sprite sheet every 2 s (a 3 h source gives ~5,400 tiles in 160×90 sprite pages).
- **Gapless EDL playback**: two `<video>` elements in A/B ping-pong. The next segment is pre-seeked and swapped at the segment boundary using `requestVideoFrameCallback`. Audio goes through WebAudio gain nodes for the 10 ms crossfade. (A fallback MSE design is acceptable if it meets the budget.)
- EDL rebuild is incremental: only segments touching the edited range are recomputed.
- Captions in preview are rendered from a windowed slice (±10 s around the playhead).
- A Web Worker handles search, filler detection over large docs, and SRT generation.

## C5. Reliability by design

On 2026-10-26 the public Transovo projects list showed rows stuck at "Finding clips · transcript ready" for 24–25 h, plus several "Failed" rows. This editor must not create states like that.

1. **Every job has a state machine**: `queued → running → succeeded | failed | canceled`.
   - A running job holds a **lease** with a heartbeat every 10 s. If a lease expires (60 s without a heartbeat), the job is re-queued automatically (max 3 attempts, exponential backoff), then marked `failed` with a reason.
   - The UI never shows a non-terminal state older than its timeout without offering **Retry** and **Cancel**.
2. **Idempotent render jobs**: `idempotencyKey = sha256(compositionId + revision + exportSettings)`.
   - Clicking Export twice, retrying, or refreshing returns the same job or the same output.
   - Outputs are content-addressed and written to a temp key, then atomically renamed, so there are no partial files. Workers check whether the output already exists before rendering.
3. **Resumable**:
   - Long renders are chunked (e.g. 60 s segments rendered independently, then concatenated), so a retry re-renders only the failed chunks.
   - Uploads are resumable (tus or multipart).
   - The editor resumes from IndexedDB after a crash (§C2).
4. **Ops are idempotent**: the server dedupes by `opId`. A resend after a timeout is harmless. Ops with a stale `baseRevision` from the same session are rebased (they're independent token ops); otherwise the client refetches and replays.
5. **Single editor lock**:
   - Opening the same composition in a second tab or device shows "Open in another tab: **Edit here**" (takeover), using BroadcastChannel plus a server lease. The losing tab becomes read-only with a clear banner.
   - This prevents silent overwrites. (Multi-user collaboration comes later.)
6. **Editor opens as soon as a transcript with word timings exists**, even while proxy, peaks or thumbnails are still generating. Lanes then show "Preparing waveform…" skeletons with progress, and the player falls back to the original file until the proxy is ready.
7. **Every failure surfaces**: an inline error with a **Retry** button and a copyable error ID. No infinite spinners; every spinner has a timeout (e.g. 20 s → "Still working… Retry").
8. **Edits are never lost**:
   - Write-ahead to IndexedDB, server op log, snapshots every 200 ops, automatic versions before bulk ops and exports.
   - Deletion is soft at every level (tokens, compositions → trash for 30 days).
9. **Telemetry**: track the op ack latency, failed-op count, EDL invariant violations, render job durations and lease expiries, and alert on any job in a non-terminal state for more than 30 min.

## C6. How it plugs into Transovo

Existing app nav (seen on transovo.ai 2026-10-26): Create (New project, Streamer, Screenwriting, Record *soon*), Library (Projects, **Editor *soon***, Voice *soon*), Brand (Brand kit, Templates), Exports.

- **Entry points**:
  1. **Project page** (long video plus found clips): a button **Edit transcript** opens the **Full video** composition.
  2. **Clip card** and **clip detail**: **Edit in script editor** opens that **clip's composition**.
  3. The sidebar item **Library ▸ Editor** (replacing "soon") lists recent compositions, only once M1 is in production and passes Section D.
- **Routes**: `/app/projects/:projectId/edit` (full video) and `/app/projects/:projectId/edit/:compositionId`. Deep link `?t=123.4` sets the playhead.
- **Compositions**:
  - The full video composition is created lazily (all words, nothing removed).
  - Each Clipper clip **is** a composition with `kind:'clip'`. Its initial Document is the clip's word range of the source.
  - Opening a clip composition shows the clip's range, plus a **"Show surrounding transcript"** toggle that displays up to 60 s before and after as ignored-style gray context. Clicking **Include** on context words extends the clip.
  - It inherits the clip's current caption style, aspect and reframe track.
- **Isolation**: editing a clip never changes the source, the full video composition or other clips. **Duplicate composition** lets a user branch a clip ("Clip 3, v2").
- **Write-back**: the clip's thumbnail, duration, title and caption text in the clips grid update from the composition within 5 s of saving. Clip export from the grid and Export in the editor use the **same** EDL and render job (the same idempotency key, so no double renders).
- **Back to project** returns to the exact card scroll position.
- **Permissions**: the same as the project. Test mode / billing gates apply to export resolution only.

---

# Section D: Acceptance checklist

## D1. Feature → milestone → browser acceptance test

Milestones:
- **M1** Shell, layout and synced read-only transcript
- **M2** Core text editing
- **M3** Timeline
- **M4** Filler/gaps, captions, reframe, properties
- **M5** Save, versions, export, reliability, performance
- **M6** Transovo integration

Each test is run in Chrome on transovo.ai production with the fixture project **"test_interview_60s"** and a **3 h fixture** (two speakers, fillers present). "✓" means the expected result is observed on screen.

| # | Feature | M | Browser test (steps → expected) |
|---|---|---|---|
| 1 | Layout regions | M1 | Open the full video editor → the top bar, script (left), preview (center), side panel + icon rail (right) and transport (bottom) are all visible, with no empty rectangle anywhere. |
| 2 | Loading states | M1 | Throttle the network to Slow 3G and open → skeletons in the script, preview and timeline within 300 ms, with no blank white panels. |
| 3 | Panel resize | M1 | Drag the script/preview handle 200 px → both panels resize live and the handle highlights. Double-click it → back to the default. |
| 4 | Layout persists | M1 | Resize panels, collapse the timeline, reload → the same sizes and state are restored. |
| 5 | Timeline toggle | M1 | Click the timeline handle → it expands to ~280 px. Press Ctrl+Alt+T → it collapses to the transport row. |
| 6 | Placement views | M1 | View ▸ Stacked → the preview sits above the script. Cmd/Ctrl+. → full video. At a 1000 px window, Side-by-side is disabled with a tooltip. |
| 7 | Small screen | M1 | At 700 px wide → the "needs a larger screen" message with Back to project. Nothing overlaps. |
| 8 | Click-to-seek | M1 | Click the 50th word → the preview frame changes and the timecode equals that word's start (±0.1 s). |
| 9 | Current-word highlight | M1 | Press Space → the highlighted word advances in step with the speech. Mute and watch: the word changes as the lips move. |
| 10 | Auto-scroll and follow | M1 | During playback, scroll up → the "Follow playhead" chip appears. Press Esc → the script jumps back to the playing word. |
| 11 | Speaker labels shown | M1 | Each paragraph starts with a colored speaker name and timestamp. A speaker change starts a new paragraph. |
| 12 | Delete cuts media | M2 | Select 5 words, press Delete → the words disappear, `¦` appears, total duration drops by about their length, and playback across the spot skips them. |
| 13 | Ignore | M2 | Select 3 words, press Cmd/Ctrl+Backspace → gray strike-through. Playback skips them. Hovering shows Restore/Delete. |
| 14 | Restore ignored | M2 | Hover ignored text, click Restore → normal text, and they play again. |
| 15 | Restore removed media | M2 | Right-click `¦` → Restore removed media → the deleted words come back in order, and the duration returns to the original. |
| 16 | Cut/paste move | M2 | Cut sentence 2 and paste it before sentence 1 → the script order changes, the preview plays sentence 2 first, and the timeline clips are reordered. |
| 17 | Drag move | M2 | Drag-select a phrase and drop it after a later word → the same result as cut/paste, with a drop caret visible while dragging. |
| 18 | External paste guard | M2 | Paste text copied from Notes → no media is inserted and a toast explains Correct. |
| 19 | Undo granularity | M2 | Delete, Ignore, Paste, Correct (4 actions) → 4× Cmd/Ctrl+Z restores the exact original. 4× redo reapplies all 4. No step merges two actions. |
| 20 | Undo across reload | M2 | Delete a word, reload, Cmd/Ctrl+Z → the word returns. |
| 21 | Correct one | M2 | Double-click a misspelled name, press C, type a fix, choose Correct → the text changes, the duration is unchanged, and playback audio is unchanged. |
| 22 | Correct all | M2 | Correct "Transova" → "Transovo" with Correct all (shows the count) → every instance changes, and captions show the new spelling. |
| 23 | Correct mode | M2 | Alt+C → banner shown. Type freely in a sentence → the text changes and the duration doesn't. Alt+C exits. |
| 24 | Typing outside Correct | M2 | Type a letter with the cursor in the script → the Correct popover opens with that letter. The media is unchanged. |
| 25 | Rename speaker | M2 | Click "Speaker 1", type "Rick", choose Rename → every Speaker 1 label in the project reads Rick. |
| 26 | Re-label selection | M2 | Select a sentence, press @, choose Guest → the sentence becomes its own paragraph labeled Guest. |
| 27 | Find | M2 | Cmd/Ctrl+F, type "clip" → hits highlighted with "1/N". Enter moves to the next, Shift+Enter to the previous. The browser's find bar never appears. |
| 28 | Edit word gap | M2 | Right-click between two words → Edit word gap → 0.25 s → the gap shortens and the section auto-plays. |
| 29 | Timeline lanes | M3 | Expand the timeline → ruler, captions lane, wordbar with word chips, and a script track with thumbnails and waveform, all aligned to the playhead. |
| 30 | Timeline↔script selection | M3 | Drag-select a range on the script track → the same words are selected in the script. Selecting words in the script → the range is highlighted on the timeline. |
| 31 | Zoom | M3 | Cmd/Ctrl+= ×5 → the word chips ungroup. Fit → the whole composition is visible. Zoom keeps the point under the cursor fixed. |
| 32 | Split | M3 | Put the playhead mid-sentence, press S → a boundary appears on the timeline and `¦` in the script. The duration is unchanged. |
| 33 | Trim edge | M3 | Drag a script clip's right edge left by 2 words → those words disappear from the script. Drag back → they reappear. |
| 34 | Ripple | M3 | Delete a middle clip on the timeline → later clips shift left with no hole, and the captions stay in sync. |
| 35 | Word boundary fix | M3 | Cmd/Ctrl-drag a word chip edge → the boundary moves. The text is unchanged. A deleted word no longer leaves a fragment of sound. |
| 36 | Shift+Delete gap | M3 | Select a timeline range, press Shift+Delete → a gap chip of the same duration appears and the total duration is unchanged. |
| 37 | Filler highlight + count | M4 | Open the 3 h fixture → fillers have a dotted blue underline, and the toolbar pill shows a count > 0. |
| 38 | Remove one filler | M4 | Open Remove filler words, press Remove → the current hit is deleted and the bar auto-advances to the next ("2/14"). |
| 39 | Remove all fillers | M4 | Remove all → all hits are gone, a toast shows the time saved, and one Cmd/Ctrl+Z brings every one back. |
| 40 | Filler action types | M4 | Set Ignore, then Remove → struck-through, not deleted. Set "Remove from transcript only" → the text is gone but the audio still plays. |
| 41 | Shorten gaps | M4 | Shorten word gaps, more than 1.0 s → 0.3 s, Shorten all → the duration drops. Spot-check: pauses sound natural and there are no clicks. |
| 42 | Captions styles | M4 | Captions panel → the existing Transovo styles (Bold Pop, …) show as live cards. Click one → the preview captions change. |
| 43 | Active-word highlight | M4 | Play → in captions, the spoken word is highlighted in the style's color in step with the script highlight. |
| 44 | Caption position | M4 | Drag captions to the top → snap guide shown, the position saves, and it persists after reload. |
| 45 | Captions follow edits | M4 | Delete a word → it vanishes from the captions within 300 ms. Correct a word → the captions show the correction. |
| 46 | Aspect + reframe | M4 | Switch 16:9 → 9:16 with Auto → the crop follows the active speaker across a cut made in the script. |
| 47 | Manual reframe keyframe | M4 | Choose Manual, drag the crop box at 0:10 → a keyframe is created and the crop holds after reload. |
| 48 | Properties by selection | M4 | Click the captions lane → caption properties. Click empty canvas → composition properties. No empty panel. |
| 49 | Save status | M5 | Make an edit → "Saving…" then "✓ Saved" within 2 s. Go offline in DevTools, edit → "Offline: changes saved on this device". Go online → ✓ Saved. |
| 50 | Crash recovery | M5 | Go offline, make 3 edits, close the tab, reopen online → the toast "Recovered 3 unsaved edits", with the edits present. |
| 51 | Versions | M5 | Run Remove all fillers → an auto version appears with an ET timestamp. Preview it → read-only banner. Restore → the script matches that version, and undo works. |
| 52 | Two-tab lock | M5 | Open the same composition in a second tab → the "Open in another tab: Edit here" banner. Take over → the first tab becomes read-only. |
| 53 | Export video | M5 | Export ▸ Video 1080p, burned captions → progress shown, editing still possible, then Download. The MP4 matches the preview's cuts, captions and crop. |
| 54 | Export idempotent | M5 | Click Export twice quickly, or refresh during the render → one job only, and the same download. |
| 55 | Render retry | M5 | (Staging: kill the worker mid-render) → the job resumes automatically and completes. The UI never sticks at the same percentage for more than 60 s without "Retrying…". |
| 56 | Export SRT/VTT | M5 | Subtitles tab: SRT, 42 chars, 2 lines → the file downloads instantly. Cue times match the edited (output) timeline. Ignored and deleted words are absent. Corrections are present. |
| 57 | Export audio | M5 | Audio ▸ MP3 → the file plays with the edits applied, normalized. |
| 58 | Export transcript | M5 | Transcript ▸ TXT with speakers and paragraph timecodes → correct speaker names (after rename) and corrected words. |
| 59 | 3 h performance | M5 | Open the 3 h fixture → interactive in ≤ 3 s. Scroll to the end with no jank. Select all of paragraph 1,000 and delete → painted instantly. Playback keeps working. |
| 60 | Gapless cuts | M5 | Make 10 cuts in 30 s and play through → no black frames, no clicks, and the audio stays continuous. |
| 61 | Entry from project | M6 | Project page ▸ Edit transcript → the full video composition opens. Back to project → returns to the same scroll position. |
| 62 | Entry from clip | M6 | Clip card ▸ Edit in script editor → only the clip's words show, with the clip's caption style and 9:16 reframe. |
| 63 | Clip context extend | M6 | Toggle "Show surrounding transcript", Include 3 words before the start → the clip starts earlier, and the clips grid thumbnail and duration update. |
| 64 | Isolation | M6 | Delete words in a clip composition → the full video composition and other clips are unchanged. |
| 65 | Shortcuts sheet | M6 | Press Cmd/Ctrl+/ → the sheet lists every shortcut from §C1, and each listed one works when tried. |
| 66 | No dead controls | M6 | Click every button and menu item in the editor → each does something visible or shows a reason-tooltip. None is a no-op. |

## D2. "Looks right" visual checklist (compare with `descript-refs/contact_sheet.png`)

1. The script reads like a document: a centered column ≤ 72ch, comfortable 1.6+ line height, no form-field look, no visible textarea border.
2. Speaker names are colored chips with a muted timestamp. Paragraphs have clear vertical rhythm (≥ 12 px between them).
3. The current word highlight is a soft rounded pill, visible but not loud, in the same hue as the timeline playhead.
4. Fillers are dotted light-blue underlines, not boxes or bold text.
5. Ignored text is gray with a strike-through, clearly different from deleted text (which isn't shown).
6. Edit boundaries `¦` are subtle (40% opacity) and get stronger on hover.
7. The selection toolbar floats 8 px above the selection, with a shadow and rounded corners, and never covers the selected words.
8. The preview is letterboxed on a neutral dark-gray stage. The 9:16 frame is centered, with a rounded 8 px corner and a subtle shadow.
9. Captions in the preview are pixel-identical in style to Transovo's existing caption renders (Bold Pop etc.).
10. The canvas pill bar (aspect · reframe · captions) is a single compact rounded pill centered under the frame.
11. The top bar is 48 px, with a centered breadcrumb, a dark solid Export button at the top right, and save status visible at all times.
12. The icon rail is 56 px with consistent 20 px icons, a tooltip on each, and an accent indicator on the active one.
13. Side panels have a title row with a close ✕, 16 px padding, and grouped sections with small uppercase headings (like Descript's Properties, ref 02).
14. Transport: a centered play button, a monospace timecode `0:20.5 / 43:12.0`, and zoom controls right-aligned. One row, 44 px.
15. Timeline lanes have labeled heights (wordbar 24 px, script track ≥ 64 px), with thumbnails above the waveform inside the script clip, and clips with rounded 4 px corners.
16. Word chips on the wordbar are legible at 100% zoom and turn into "…" groups when cramped, never overlapping text.
17. The playhead is one blue line spanning every lane, with a draggable head on the ruler.
18. Drag handles are invisible until hover, then a 2 px accent line with a resize cursor.
19. Filler/gap review bar: one row pinned at the top of the script with a count `3/15`, arrows, action dropdown, and Remove / Remove all (like ref 08).
20. Dark and light themes both pass WCAG AA contrast. No hard-coded white panels in dark mode. Spacing uses the existing Transovo design tokens.

---

# Section E: References

**Screenshots** (`/workspace/specs/descript-refs/`; full URLs in `SOURCES.txt`):

| File | Shows |
|---|---|
| 01 | Labeled main editor |
| 02 | Script layer properties |
| 03 | Expanded timeline |
| 04 | Labeled timeline anatomy |
| 05 | Scenes in script + timeline |
| 06 | Scene properties / layers |
| 07 | Scene editor + layout pill |
| 08 | Filler word removal bar |
| 09 | Ignored text hover |
| 10 | Speaker rename |
| 11 | Captions panel |
| 12 | Studio Sound properties |
| 13 | AI tools panel |
| 14 | Underlord panel + resize handles |
| 15 | Export video |
| 16 | Export subtitles |
| 17 | Kapwing transcript editor (comparable) |

**Descript help** (markdown cached in `/workspace/specs/md/`):
- Interface: [D:descript-tour/the-editor-interface] · [D:descript-tour/customize-the-editor] · [D:descript-tour/view-menu] · [D:descript-tour/keyboard-shortcuts] · [D:descript-tour/playback-and-navigation] · [D:descript-tour/properties-panel] · [D:descript-tour/selection-toolbar] · [D:descript-tour/ai-tools-overview]
- Script editing: [D:script-editing/delete-vs-ignore] · [D:script-editing/restore-removed-media] · [D:script-editing/edit-boundaries] · [D:script-editing/correct-your-transcript] · [D:script-editing/speaker-labels] · [D:script-editing/filler-words] · [D:script-editing/shorten-word-gaps] · [D:script-editing/word-gaps] · [D:script-editing/the-wordbar]
- Timeline and visuals: [D:timeline/timeline-overview] · [D:timeline/timeline-tools] · [D:timeline/split-button] · [D:getting-started/scenes] · [D:visuals/captions] · [D:visuals/scenes-layers] · [D:templates-and-presets/layouts-apply]
- Effects and AI: [D:effects-animations-transitions/studio-sound] · [D:effects-animations-transitions/eye-contact] · [D:getting-started/underlord-beta-your-ai-co-editor-in-descript]
- Export: [D:export-and-share/export-and-publishing-overview] · [D:export-and-share/video-gif] · [D:export-and-share/subtitles] · [D:export-and-share/transcript]
- Projects and troubleshooting: [D:working-in-projects/save] · [D:working-in-projects/version-history] · [D:working-in-projects/recover-project-edits] · [D:app-troubleshooting/performance-playback] · [D:app-troubleshooting/project-stuck]

**Comparables (text):**
- Riverside: https://support.riverside.com/hc/en-us/articles/16673658517277-Riverside-editor-Overview · …/15009098062493-Adjust-and-refine-cuts · …/13327985961885-Correct-the-transcript-and-caption-text
- Adobe Premiere Text-Based Editing (help updated Jan 2026): https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/overview-of-text-based-editing.html
- Kapwing: https://www.kapwing.com/resources/trim-with-transcript/
