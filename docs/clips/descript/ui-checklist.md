# Descript → Transovo UI: "looks right" checklist for the browser tester

Pairs with `docs/clips/descript/ui-layouts.md`; the § numbers match. Reference images: `/opt/transovo-refs/descript/` on coolify-server. Test at **1440×900** in the dark theme unless a check says otherwise. Then repeat the ★ checks at **1280×800**. Measure with the devtools element inspector.

- A size check passes within **±2 px** for fixed chrome and **±4 px** for flexible regions.
- Every check is yes/no. Report each as `§N.#: PASS/FAIL, measured value, screenshot path`.
- If something isn't built yet, mark it `N/A (not built)`; don't count it as a FAIL.

## §0. Global (check once, on any screen)
1. Normal buttons, inputs, selects and segmented controls are 32 tall. Compact/icon buttons are 28. Modal primary buttons are 36. Full-width popover CTAs are 40.
2. Menu items are 32 tall; list rows are 40.
3. Icons are lucide: 16 in buttons/menus, 18 in the top bar and right rail.
4. Radius: controls 8, section cards 10, panels/cards/modals 12, thumbnails 6.
5. Only one button per screen uses the brand gradient (`PrimaryButton`). Besides that button, the gradient only appears on the logo, AI Producer, score rings and the active app-nav item.
6. Pressing Tab shows a 2 px `ring-ring` focus ring. A mouse click shows no ring.
7. Disabled controls are at 50 % opacity, and hovering one still shows a tooltip that explains why.
8. Tooltips appear after about 500 ms and show the label, then the shortcut in muted mono (e.g. "Split  S").
9. Toasts are 360 wide: bottom-centre above the transport in the editor, bottom-right elsewhere. Undo toasts have the action on the right.
10. Timecodes, %, dB and px values use Geist Mono with tabular figures. Everything else uses Geist Sans.
11. Loading skeletons are the final size of the content, so nothing jumps when data arrives.
12. Below 768 px wide, the editor shows the "Editing needs a larger screen" card with an "Open on desktop" copy-link button.
13. All copy is sentence case. Nothing says "Underlord" or "Descript"; it reads "AI Producer" and "Transovo".

## §1. Home / Drive / project list

1. ★ Top bar is 48 tall. Left sidebar is 232 wide (x0–232). Content card spans x240–1428, y48–892, radius 12 (x240–1272 at 1280).
2. ★ Search field is centred on the viewport, 720 wide (640 at 1280), 32 tall, with an "Everywhere ▾" scope select inside.
3. Pressing `/` on Home focuses search; ⌘K does not.
4. Sidebar items are 32 tall with a 16 icon and 13 px label. Group overlines are 11 px uppercase muted.
5. Active nav item has `bg-accent` plus a 2 px brand-gradient bar on the left. Hovering another item gives `bg-accent/60`.
6. Transovo nav sections read Create, Library, Brand, Exports.
7. Hero prompt box is 800 wide and 96 tall (720 at 1280), and grows to 200 as text wraps. Get started is disabled until there is text or a file.
8. The first template chip is "Turn a long video into clips". Chips are 32-tall pills that wrap and are centred.
9. ★ Recent projects grid has 4 columns at 1440 and 3 at 1280, with 16 gaps. Cards are 16:9 with a mono duration chip bottom-right.
10. List-view rows are 40 tall with a 32 header. Columns: checkbox 32, thumb 32, Name flex, Duration 96, Owner 140, Created 112, Last viewed 112, menu 40.
11. Hovering a row shows its checkbox and ⋯. Selecting rows swaps the filter row for a "N selected · Move · Duplicate · Delete · ×" bar.
12. Dragging a file over the content card shows a dashed primary border and "Drop to create a project".
13. Empty: a 320-wide centred block with a FolderOpen icon, "No projects yet", New project and Record buttons.
14. Loading: 8 skeleton cards (grid) or 10 skeleton rows (list).
15. Focus order: top bar → sidebar → content header buttons → prompt → chips → cards.
16. At 768–1099 the sidebar becomes a 56 icon rail. Below 768 it hides behind ☰.

## §2. New project & import

1. Empty editor shows the "Name your creation" placeholder (22 px, muted). Pressing Enter moves focus to the dropzone.
2. ★ Empty-state column is 736 wide (680 at 1280), centred, 64 from the card top.
3. ★ Dropzone is full column width, 304 tall (264 at 1280), radius 12, with a 1.5 px dashed border.
4. Action buttons form a 2×2 grid, each 44 tall with 8 gaps and radius 10.
5. Transovo: a full-width "✨ Make clips from a long video" gradient button sits first, above the grid.
6. Transovo: there is no Create with AI speaker or Import from Zoom. The grid reads Import from media library, Record, Import from YouTube link, Import from Google Drive.
7. Record opens a menu 296 wide with 56-tall items and 84×46 thumbnails. "Invite others to record ▸" opens a 290-wide submenu with 3 items.
8. Dragging over the dropzone gives a primary border and "Drop to add". An invalid file turns the border red and shows "That file type isn't supported".
9. Transcribing dialog is 448 wide and centred, with a 48 header and 40-tall file rows. It has a speaker-count select, a Speaker name combobox, a language select, a checkbox and a full-width Done.
10. Typing a new name in Speaker name offers "Add "<name>" as speaker".
11. Activity card is 288 wide, docked bottom-right above the transport, with 40-tall rows: spinner, filename, mono %, and a 2 px progress bar.
12. An import error shows the row in red with "Failed · Retry" plus a toast with Retry.
13. Below 1100 the action buttons stack into one column.

## §3. Editor shell

1. ★ Top bar is 48 tall. Export is the only gradient button in the editor.
2. ★ With the panel open, the main card is x8–1024 (1016 wide), y48–892, radius 12. At 1280 it is x8–864.
3. ★ With the panel closed, the main card is 1344 wide (1184 at 1280).
4. ★ Side panel is a separate card at x1032–1352, 320 wide, drag-resizable 280–480 from its left edge.
5. ★ Right rail is 80 wide at x1360–1440 with no card behind it. Items are 72×60, radius 10, icon 18 over a 10 px label, 12 gaps.
6. Rail order is Project, AI tools, Properties, Elements, Captions, Brand, Media, then AI Producer pinned 12 from the bottom.
7. Clicking the active rail item closes the panel. The open/close animation is 200 ms with no overlap at ≥1280.
8. ★ Script pane is 45 % of the card (457 wide with the panel open at 1440, min 360). Canvas pane keeps at least 320.
9. Script text column is max 720 wide with 32 side padding. The Write toggle sits top-right of the pane, and Write mode puts a primary ring around the pane.
10. Collapsed timeline is a 44-tall transport plus a 4 px scrub line. Record and Play are centred in the card.
11. ★ Expanded timeline defaults to 280 tall (240 at 1280) and resizes from 160 to 60 % of the card. Double-clicking the handle toggles it.
12. Timeline rows: ruler 28, scene strip 36, layer lanes 36, caption rows 24, word bar 24, script track 112 (96 at 1280).
13. Playhead is a 1 px primary line through every row, with a head on the ruler.
14. View menu is 232 wide: Script ▸, Scene editor ▸, Timeline ▸, Panels ▸, Appearance ▸, with mono shortcuts right-aligned.
15. Loading shows 8 skeleton script lines, a 16:9 muted canvas block, and the transport with its controls disabled.
16. F6 cycles focus: top bar → script → canvas → transport → timeline → side panel → rail.
17. At 1100–1279 the side panel floats over the main card with shadow-lg. At 768–1099 the layout is stacked and the rail is 64 wide, icon-only.
18. Transovo: in a clip composition the breadcrumb shows Scissors, the clip name and a score ring, and House becomes "← Back to project".

## §4. Script: selection toolbar, context menu, hover states

1. Selecting words shows a 32-tall toolbar 8 above the first selected line, kept 8 inside the pane. It flips below when the selection is near the top.
2. Toolbar order: AI Producer, Change layout, Clip (Transovo), Add layer, Correct, Regenerate, Ignore ▾, B, I, Highlight ▾, Add scene, Comment, ⋯.
3. While words are selected, the script header shows the word count and duration in 12 px mono ("3w │ 0.72s").
4. Right-click opens a 240-wide menu with 32-tall items. The first item is "Change speaker… @" and the last is "View media ⇧⌘O".
5. Selected words use `bg-primary/25`. Hovering a word gives `bg-accent/50`. The playing word is primary with a 2 px caret before it.
6. Filler words have a dotted info-colour underline. Gaps show as "·····" dots.
7. Ignored text is muted and struck through. Hovering it shows a 28-tall Restore/Delete pill 4 px above.
8. Hovering a cut point shows the "✦ Regenerate ▾" split button, 32 tall.
9. Edit label popover is 260 wide with a 40 header.
10. Speaker labels are 13/600 in their `speaker-N` colour. Clicking one opens a 240-wide popover.
11. The Highlight menu shows 12 swatches in a 6×2 grid plus "Clear highlight".
12. With a script pane under 520 wide, Add scene, highlight, Italic and Bold move into ⋯ in that order.
13. With keyboard selection, Tab enters the toolbar and Esc returns to the text. Shift+F10 opens the context menu.

## §5. Filler-word & gap review bar

1. ★ Bar floats 16 from the script pane's left and 8 from its top. It is 488 wide, radius 12, popover background, shadow-lg.
2. Row 1 is 40 tall: mode ▾, query, mono count "0/15" (48 wide), ˄, ˅, options, speaker dot, ×.
3. Row 2 is 44 tall: trash icon, action select (128 wide), Avoid harsh cuts switch, Remove, Remove all (semibold).
4. Hovering Avoid harsh cuts shows "Keeps filler words if cutting them would sound unnatural".
5. The current match has `bg-primary/35` with a primary ring. Other matches have `bg-primary/15`.
6. With 0 matches the count reads "0/0" muted, Remove and Remove all are disabled, and "No filler words found" appears under the bar.
7. Gaps variant row 2 reads Timer, "Shorten to [1] seconds" (48-wide field), Shorten, Shorten all.
8. Remove all shows the toast "Removed N filler words · Undo" (6 s) with no modal.
9. While the transcript is still processing, a spinner replaces the count and the actions are disabled.
10. The options popover is 240 wide with 32-tall checkbox rows.
11. Focus order: mode → query → prev → next → options → speaker → close → action → switch → Remove → Remove all. Enter = next, ⇧Enter = previous.
12. The Search results panel has 56-tall rows, and the current row has a primary ring.

## §6. Captions panel

1. ★ Panel is 320 wide (280 at 1280) with a 48 header, a 32 search field, and a 32-tall Apply-to segmented control.
2. Preset tiles fill the panel width minus 24. They are 64 tall (56 at a 280 panel), radius 10, and render the real style.
3. Transovo shows exactly 10 presets in this order: Bold Pop, Clean White, Boxed, Karaoke, Minimal, Neon, Bounce, Typewriter, Slide Up, Highlighter.
4. Each tile's label (12 px muted) is the preset name, not a font name.
5. Hovering a tile gives a `ring-primary/40` ring and plays its animation once.
6. The applied tile has a 2 px primary ring and a 16 px check badge top-right.
7. Filter popover is 256 wide with 28-tall chips: All, Bold, Clean, Animated, Brand.
8. With a brand kit, a "Brand captions" tile is pinned at the top with an "Edit in Brand" link.
9. In a clip composition, Apply-to has a third segment, "All clips".
10. The Animation select lists None, Pop, Bounce, Slide up, Typewriter, Karaoke fill, Glow.
11. With no transcript yet, the panel shows the Captions icon, "Captions appear once transcription finishes" and a spinner.
12. An empty search shows "No styles match "…"" with Reset.
13. Arrow keys move between tiles and Enter applies one.

## §7. Properties panel

1. Video layer header is 48 tall: ←, layer name (14/600), mute, solo S, ⋯.
2. The Current scene | All scenes segmented control (32 tall) sticks under the header while the body scrolls.
3. Sections are separate cards: radius 10, `bg-surface-raised`, 12 padding, 8 gaps, 44-tall headers.
4. Video layer section order: Duration, Audio, Opacity, Size and position, Border, Audio effects, Color adjustments, Effects, Transitions, Animation.
5. Empty sections (Border, Effects, …) show only their header with a +.
6. Numeric fields are 32 tall, muted background, with an 11 px prefix. Dragging the prefix scrubs the value (ew-resize cursor).
7. ★ X/Y and W/H fields sit two per row with a link toggle. They still fit at a 280 panel (fields 92 wide).
8. A section with a non-default value shows a 6 px primary dot after its title.
9. Sliders have a 4 px track, primary fill, and a 14 white thumb. Switches are 20×36.
10. Transitions popover is 296 wide: a 3-column grid of 72×56 tiles, a Duration field (88 wide), and a full-width "Apply to all".
11. Color adjustments shows 4 preset thumbs (64×40) above 7 sliders and the eyedropper.
12. A locked layer shows a 36-tall amber "Layer is locked · Unlock" banner, and every control is at 50 %.
13. Scene level shows a Layers list: 32-tall rows, top layer first, plus a "+ Add layer" row.
14. Transovo: the audio effects + menu lists only Studio Sound, Auto-level and Lower audio of other layers. EQ, Compressor, Noise gate and Reverb are absent.
15. Transovo: a clip's Duration section shows in/out timecodes with a "Trim in transcript" link.

## §8. Scenes & storyboard (sizes chosen, no current ref)

1. A scene break in the script is a 1 px dashed full-width line with a 16 margin.
2. Each scene's first word has a 28×20 thumbnail.
3. Timeline scene strip is 36 tall. Each block is sized to its duration, radius 6, with a number, a 48×28 thumb and a title.
4. The transport view toggle (Timeline / Storyboard) switches the bottom area to the storyboard grid.
5. ★ Storyboard cards are 160×90 for 16:9 (144×81 at 1280) or 72×128 for 9:16, radius 8, with 16 gaps and 16 padding.
6. Each card label shows the number (11/600) and title, with the duration in mono below.
7. The current scene card has a 2 px primary ring that follows the playhead.
8. Dragging a card lifts it (shadow-lg, rotate 1°) and shows a 2 px primary insertion bar. Dropping reorders the script and shows "Moved scene N · Undo".
9. Hovering a card shows a 24 ⋯ menu (Duplicate, Change layout, Apply transition, Add comment, Delete) and a play icon.
10. The last card is a dashed "Add scene" card.
11. Empty storyboard: "No scenes yet — type / in the script to add one".
12. Transovo: in Full video, a 28-tall "Scenes | Clips" toggle shows clip cards with 24 score rings.

## §9. Layouts picker & packs

1. Picker opens centred above the canvas Layout pill with an 8 gap. It is 288 wide, at most 480 tall, radius 12.
2. Header is 44 tall: pack name (13/600), search, filter, ⋯.
3. Tiles are in 2 columns at 128×72, radius 8, with a 28-tall label. Gaps are 12 across and 8 down.
4. The current layout has a 2 px primary ring and a check.
5. Hovering a tile shows a 24 round Remix button top-right with the tooltip "Remix layout".
6. "Go to current layout" (32 tall) appears when the current tile is scrolled out of view.
7. Footer is 44 tall with "Change layout pack".
8. Applying a layout that drops layers shows "Removed 2 layers that don't fit this layout · Undo".
9. Pack gallery cards are 120 tall: a 136×76 mosaic, name, layout count and Default badge.
10. Transovo packs include Clip – Speaker (the 9:16 default), Clip – Split screen, Clip – Captions focus, Podcast 2-up, Multicam, Title card, Outro.
11. The generated Brand pack is first under Your packs, with a 2 px gradient bar.
12. The aspect menu (200 wide) shows platform names: 9:16 (TikTok, Reels, Shorts), 1:1 (Feed), 16:9 (YouTube).

## §10. Canvas layers, align & snap

1. Elements panel order: Text (3 tiles, 64 tall), Basic shapes, Dynamic text, Waveform, Playback progress, Annotations, Placeholder.
2. ★ Shape tiles are 48×48 in a 5-column grid (4 columns at a 280 panel).
3. Hovering a layer gives it a 1 px `primary/60` outline.
4. A selected layer has a 1.5 px primary outline, eight 8×8 white handles, and a 10 round rotate handle 20 above.
5. Selected outlines are coloured by type: video primary, text lane-caption, shape lane-sfx, image lane-broll.
6. Dragging shows 1 px `lane-brand` snap guides with 10 px distance labels. Snapping engages within 8 px.
7. A locked layer has a dashed muted outline, no handles, and a lock badge.
8. Multi-select shows one group bounding box with handles.
9. Right-click opens a 240-wide menu with Select layer ▸, Layer order ▸ and Align layers ▸ submenus and shortcuts.
10. The floating toolbar sits 8 above the layer, 32 tall. Its contents differ for text and shapes.
11. Fill picker is 248 wide: Solid | Gradient tabs, a 224×160 SV square, hue and alpha sliders, eyedropper, hex field, swatches, Brand colours row.
12. Placeholder layers are dashed and muted with an icon and "Drop media".
13. Arrow keys nudge 1 px and ⇧+arrow 10 px. Esc deselects.
14. Transovo: View ▸ Scene editor ▸ Show safe zones shows 9:16 zones (top 12 %, bottom 20 %, right 12 %).

## §11. Media panel & stock

1. Header is 48 tall with an icon and "Media", and no close button.
2. The My media | Stock segmented control is 32 tall. The active segment is solid primary.
3. Search (32 tall) is followed by two 32×32 toggles: Visuals and Audio.
4. Each category is a card (radius 10, raised surface) with a 13/600 title and a "Show all" link.
5. ★ Tiles are 2 columns, about 128×72 (about 112×63 at a 280 panel), radius 6, with 8 gaps.
6. Hovering a tile gives a ring. After 300 ms the video previews muted, and a 24 + button appears bottom-right.
7. Transovo: the first section is B-roll suggestions with a "Suggested" badge. There are no GIPHY sections.
8. File ⋯ menu is 220 wide and ends with Delete in red.
9. Empty My media shows an Upload icon, "Drop files here or Upload" and an Upload button.
10. Loading shows 2×2 skeleton tiles per section.
11. A stock outage shows "Stock media is unavailable right now" with Retry inside the section.
12. Show all opens a full grid with ← back and Orientation/Duration filters.

## §12. Music & SFX (sizes chosen, no browse ref)

1. Turning on ♫ in the Stock tab shows 28-tall Music | Sound effects tabs.
2. Filter chips (Mood, Genre, Duration) are 28-tall pills with 6 gaps.
3. Music rows are 56 tall: 32 round play button, title 13/500, artist 12 muted, mono duration, +, ⋯.
4. A playing or hovered row shows a 16-tall mini waveform with primary progress.
5. Only one preview plays at a time, and editor playback stops it.
6. SFX rows are 48 tall. A 2-column grid of 40-tall category chips comes first.
7. Transovo: the default sort is "Fits this clip", and each row has a licence line (11 px muted).
8. An audio layer's properties show Audio (0–200 %), Fades in/out (88-wide fields), Loop | Once, and Ducking (switch plus −3…−30 dB, default −12).
9. In the timeline, music blocks use `lane-music` and SFX use `lane-sfx`, with 8×8 fade handles.
10. Adding a track shows the toast "Added "<title>" · Undo".

## §13. Studio Sound, audio effects, VU meter

1. The Studio Sound settings popover is 272 wide with a 44 header (title, help, ×).
2. The Intensity slider field is 36 tall, defaults to 80 %, and shows the value in mono on the right.
3. Remove is a full-width outline button, 36 tall.
4. Studio Sound row: label, a 28 settings button, and a switch. While processing, the switch is replaced by a spinner and "42%".
5. VU meter in the transport: a "VU" label and two stacked 96×3 bars, green to −12 dB, amber to −6, red above −3.
6. The VU tooltip shows the dB value (e.g. "−14.2 dB"). The range is −30…0 dB.
7. A 1 px volume line with 6 round keyframe dots crosses audio blocks.
8. Effects with no audio on the layer are disabled with the tooltip "No audio on this layer".
9. A processing error shows "Couldn't process · Retry" in red on the row.
10. Esc closes the popover and returns focus to the settings button.
11. Transovo: EQ, Compressor and Reverb are not reachable anywhere at launch.

## §14. Markers & chapters

1. In the script, a marker is its own 14/600 heading line with 16 above and 4 below.
2. On the ruler, a marker is an 8×10 primary flag. Hovering shows its label and a 1 px line through the tracks.
3. The transport marker button is a 28 ghost button with the tooltip "Markers (M)".
4. The list popover opens upward. It is 272 wide, radius 12, with 32-tall rows and mono times on the right.
5. The list starts with "Beginning of composition / Home" and ends with "End of composition / End".
6. The row containing the playhead has `bg-accent`. The list scrolls past 360 tall.
7. With no markers, only Beginning and End show, plus "Add markers with / in the script".
8. Dragging a flag gives it a glow shadow and a timecode tooltip, and it snaps to words.
9. In the list, ↑/↓ move, Enter seeks, and Esc returns focus to the button.
10. Transovo: clip ranges show on the Full-video ruler in `lane-ai`, and the list has a Clips group.

## §15. AI Tools panel & AI Producer

1. AI Tools header is 48 tall. Search is 36 tall and gets focus (with a ring) when the panel opens.
2. Categories are cards (radius 10) with a 40-tall title, and 40-tall action rows with a 16 icon.
3. Transovo category names: Clean up, Look good, Write, Clips, Publish.
4. Actions outside launch scope are hidden, not disabled.
5. Beta badges are 18 tall, 10 px text, muted, 8 after the label.
6. Search filters actions live, and categories with no matches hide.
7. An action's detail view has a 48 back header, description, options, a scope segmented control, a full-width 36 primary, and a credits line.
8. While running, the primary shows "Working… 40%" with a fill bar inside and a Cancel link below.
9. Multi-step actions show stepper dots and a 56-tall Back/Next footer.
10. AI Producer is pinned at the bottom of the rail with a gradient tile and the label "AI Producer".
11. AI Producer empty state shows the Transovo mark and 4 suggestions, starting with "✨ Make clips from this video".
12. The composer has radius 12, is 88–240 tall, and has a 32 round send button that is disabled when empty.
13. User messages are right-aligned `bg-primary/15` bubbles. AI Producer replies are plain text with 32-tall step rows.
14. At 1100–1279 the panel is an overlay drawer.

## §16. Comments

1. The top-bar 💬 button shows `bg-accent` while the 320-wide Comments panel is open.
2. Thread cards: radius 10, border, 12 padding, 8 gaps, with the timestamp on top.
3. Card header: 20 avatar, 13/600 name, 12 muted time. ⋯ appears on hover.
4. A quoted anchor is 12 italic muted with a 2 px `primary/40` left border.
5. Reply field is 36 tall. Resolve is a 28 ghost button that appears on hover.
6. The sort menu is 220 wide: Sort by timestamp ✓, Sort by oldest, Sort by newest, Show resolved comments, Copy all comments.
7. Commented text in the script has `lane-brand/15` with a 2 px underline, plus a 16 avatar badge in the gutter.
8. The thread at the playhead or selection gets a 1 px primary ring.
9. Empty: MessageSquare icon, "No comments yet" and "Select text and press ⌘⌥M to comment".
10. A failed post shows "Not sent · Retry" in red 12 px.
11. Transovo: in a clip composition, a 28-tall "This clip | Full video" toggle sits under the header.

## §17. Share & publish

1. The Project access modal is 448 wide, radius 12, 20 padding, with a 52 header.
2. The email field is 40 tall with a role select inside, followed by a 40-tall "Invite to project".
3. Member rows are 48 tall: 28 avatar, name, tag, and a 36 role select. The owner row shows "Owner" as plain text.
4. The footer is 56 tall: link icon, access select, Copy link. Copying shows "✓ Copied" for 2 s.
5. An invalid email shows "Enter a valid email" under the field in red 12 px.
6. Once published, the Export popover shows a 36-tall read-only mono link with Copy and footer icon buttons.
7. Unpublish asks for confirmation ("Unpublish? The link will stop working").
8. Share page header is 56 tall with views, comments, download, link, settings, Edit and avatar.
9. ★ Share page player is 16:9, max 1080 wide, radius 12, with a 72 round play button. The transcript panel is 360 wide and collapsible.
10. The link and embed popover is 420 wide with "Start at" and a 4-line mono iframe box.
11. Unavailable video: a centred 400 card, "This video isn't available".
12. Below 1100 the transcript sits under the player.
13. Transovo: the share page uses the brand kit logo, with a "Made with Transovo" footer.

## §18. Export popover

1. The popover hangs 8 below the Export button, right-aligned to it. It is 420 wide, radius 12, with a 52 header.
2. Tabs are a 32 segmented control (Video, Audio, GIF, Timeline, Transcript, Subtitles). The active tab is `bg-background` with shadow-xs.
3. Preview is 16:9 and 388 wide, with duration and size chips bottom-right (22 tall).
4. Rows are 40 tall: 13 px label on the left, an outline select up to 220 wide on the right.
5. Video defaults: Local export, Current composition, Max (1080p), Recommended.
6. Advanced collapses (40 header) and holds Format MP4|GIF, Audio ⚙, Metadata, hardware acceleration, subtitle track.
7. The footer has a full-width 40-tall Export button.
8. With Web link chosen, the footer shows Publish (or Update) plus 36 icon buttons.
9. While exporting, the footer becomes a progress bar ("Exporting 34% · 1:12 left") with Cancel, and the top-bar Export shows a progress ring.
10. Export is disabled during processing with the tooltip "Wait for processing to finish".
11. The Transcript tab replaces the preview with a composition pill (36 tall).
12. Below 800 tall, the preview shrinks to 160 and the body scrolls under a sticky footer.
13. Transovo: Destination offers TikTok, YouTube Shorts and Instagram Reels, and Export options offers "All clips (N)" with 40-tall per-clip progress rows.
14. Transovo: 9:16 clips default to 1080×1920 with burn-in captions on.

## §19. Version history

1. Opens as a 320-wide side panel from App menu ▸ Version history, with a 48 header (options and ×).
2. Rows are 64 tall: 24 avatar joined by a 1 px vertical connector, date (13/500), relative time (12 muted).
3. The previewed row is `bg-primary/10` with a 28-tall Restore ghost button.
4. While previewing, a 36-tall amber banner across the top of the main card reads "Viewing an old version… return to latest version".
5. Editing is blocked while previewing (not-allowed cursor).
6. Restore opens a 400-wide confirmation, then a toast with Undo.
7. The options menu is 200 wide with "Show all revisions".
8. Loading shows 6 skeleton rows. Empty reads "No earlier versions yet".
9. ↑/↓ preview rows and Enter restores.
10. Transovo: AI Producer runs appear as named versions with a Sparkles icon in `lane-ai`.

## §20. Settings modal

1. ★ Modal is 800×720 at x320–1119, y90–808 at 1440×900, radius 12, over a 60 % black scrim. At 1280×800 it is 800 × min(720, 100vh−64).
2. Nav is 236 wide on a raised surface with a right border. Items are 32 tall and group overlines 11 px uppercase.
3. Content is 564 wide with 24 padding and a sticky 56 header (18/600 title).
4. Setting rows are at least 48 tall: 14 label, ⓘ tooltip, control right-aligned 16 from the edge.
5. Grouped settings sit in a radius 10 bordered card with dividers between rows.
6. The active nav item is `bg-accent` and medium weight.
7. Switches save immediately. A failure reverts the switch and shows "Couldn't save setting · Retry".
8. Transovo nav: General · Account (Profile, Notifications, Connected accounts, API tokens) · Workspace (Members, Brand, Plan & credits, Usage, Invoices).
9. Transovo General includes Default caption style [Bold Pop] and Default clip aspect ratio [9:16]. There is no Labs card and no foot pedal.
10. Usage meters are 8-tall bars with primary fill and a text value ("12 / 30 hrs").
11. Esc closes and returns focus to the opener.
12. Below 900 wide the modal becomes a full-screen sheet and the nav becomes a select.

## §21. Recording (editor recorder)

1. Arming Record replaces the transport with a 52-tall recorder bar: ×, camera select (140), mic (150), screen (150), Record split button (165), ⚙, teleprompter.
2. The Record button is `lane-record` red with white text, never the gradient.
3. The Record chevron menu lists: into script, into new scene, into new composition, to project files.
4. The settings popover is 288 wide with grouped cards (General, Microphone audio, Computer audio, Camera) and 36-tall rows. Countdown is on by default.
5. The countdown is a 160 circle over the canvas with 96 px digits, counting 3-2-1. Esc cancels.
6. While recording, a 24-tall "● REC 0:00" mono pill sits at the script insertion point.
7. Replace mode shows the selected words as `lane-record/20` and struck through until the recording ends.
8. The recording toolbar has discard, restart, pause, a red mono stop/timer, layout and ⚙, all 32.
9. The upload card is 320 wide, bottom-left, with "Uploading video recording… N%" and a 4-tall bar.
10. With no device, the select shows "No camera found" and "Check permissions".
11. Blocked permission shows an inline "Microphone access is blocked · How to fix" alert.
12. Record is disabled when no input is chosen (tooltip "Choose a camera, mic or screen").
13. Transovo: in a clip composition, recording is disabled with the tooltip "Record in the full video". The desktop dock (§21.3) is not built (M18).

## §22. Teleprompter

1. The floating panel starts top-centre of the canvas pane. It is 680×360 (min 400×200), radius 12, near-black, and drags and resizes from its corners.
2. It stays dark in both app themes.
3. The placeholder "Paste, type, or import from script" is 28/500 at 50 % white with 32 padding.
4. Script text is 32/1.5. The current line is white and the rest 40 % white, with a 2 px reading line at 33 % height.
5. The controls row is 48 tall: size slider (96), speed slider (96), restart, play, import, mirror, contrast, settings.
6. Size runs 16–72 px (default 32). Speed runs 1–10 (default 4).
7. The controls hide 2 s after the pointer leaves while it is scrolling.
8. Mirror flips the text horizontally. Contrast swaps to black on white.
9. Expand ⤢ goes full-screen over the editor.
10. With focus in the panel, Space toggles play and ↑/↓ change speed.
11. Sharing this tab does not capture the panel (`selfBrowserSurface:'exclude'`).

## §23. Rooms: lobby / pre-join

1. Full page with no editor chrome and a 56 top bar showing the Transovo logo. Dark by default.
2. ★ Centred content block: a 520 card (480 at 1280), a 48 gap, and a 360 column (340 at 1280).
3. The card has a 16:9 mirrored self-preview (488×274, radius 8) with a VU meter bottom-left.
4. Device rows are 40 tall: camera select plus a 96-wide resolution select, mic, and speakers with a test button.
5. The right column has a 20/600 heading, Yes/No headphone toggles (36×88), name input and role select (36 tall), and a full-width 36 Join (the page's only gradient).
6. Join is disabled until the name and the headphone answer are filled in.
7. Launch roles: host, guest, producer. A guest sees "Request Room".
8. A waiting guest sees "Waiting for the host…" disabled with a spinner.
9. The host sees a 320-wide approval toast-card: "Bob wants to join · Deny / Admit".
10. With the camera off, the preview shows a 64 initials avatar and "Camera is off".
11. Blocked permissions show an alert in the preview with "Try again".
12. The schedule modal is 480 wide with 36-tall date/time pickers, an Advanced section, and .ics / Google Calendar buttons on the event card.
13. Below 1000 wide the column stacks under the card.

## §24. Rooms: in-room

1. Top bar is 48 tall: ← Back to editor, a centred room/episode select, Invite, avatar, help.
2. ★ Stage is 1064 wide at 1440 (904 at 1280), 16 padding, near-black. Tiles are 16:9, radius 12, with 12 gaps.
3. Name tags are 24 tall, bottom-left, `black/60`. The active speaker has a 3 px green ring. Mic-off shows a 20 red badge.
4. The People panel is 296 wide with "Recorded (N)" and "Not Recorded (N)" groups and 56-tall participant cards.
5. The People panel shows the upload % bar and "Internet connection is good" with a green dot.
6. The mini rail is 80 wide with 64×56 items: People, Chat, Settings.
7. Bottom bar is 72 tall: Record is a 48 round red button labelled "Start". Mic, video and share are 44 round `white/10`. Leave is a 40-tall red-tinted pill.
8. While recording, Record becomes a red mono "■ 2:18" stop and a 28-tall "● REC" timer pill shows.
9. Stage banners are 40 tall and dismissible. CPU and network warnings appear here.
10. Producer mode shows a banner with "To: <name> ▾" and Push to talk.
11. Screen share takes the main tile, the other people move to a 96-tall filmstrip, and a "Stop share" pill appears.
12. Live captions show as a 16/500 white strip on `black/60` at the bottom of the stage.
13. Below 1280 the People panel becomes an overlay sheet.

## §25. Rooms: upload, end, recovery

1. After Stop, the upload card appears 16 in from the stage's bottom-right. It is 360 wide, radius 12, popover background, and draggable.
2. Rows are 48 tall: icon, track label, mono %, and a 4-tall primary bar. Finished rows show a green check.
3. Done copy reads "Thanks for recording with Transovo" with Got it or Rejoin the Room.
4. Leaving during upload shows a 400-wide confirmation with Stay in the Room (default focus) and Leave the Room (red).
5. A stalled upload gives the card a red border, "⚠ Upload stalled", and Copy recovery link / Start editing project.
6. The host's "Choose files to edit" modal is 480 wide with 72-tall radio cards: High quality (Partial) and Cloud backup.
7. The recovery page is centred and 560 wide, with per-track Download and Delete local copy, and "Files are kept in this browser for 7 days".
8. The Project panel shows an amber "Uploading Recordings (N)" section while uploads continue.
9. A removed person sees a 400-wide card, "You were removed from the call", with Return home.
10. An import error shows a 400-wide modal with Close.

## §26. Multitrack / multicam sequence

1. Opening a sequence shows "Composition › Sequence 1 [Done]" in the script header.
2. ★ Track header column is 120 wide (104 below 1280): name 12/600, a 20×20 Solo S, a 20 Mute.
3. Solo on is amber with black text. Mute on is `destructive/80`.
4. Lanes default to 56 tall. View ▸ Timeline ▸ Layer size switches between 40, 56 and 80.
5. Waveform lanes are tinted `speaker-N/20`, matching the script speaker colours.
6. Dragging a clip snaps to other clips and the playhead, with an offset tooltip ("+0.42 s").
7. A selected clip has a 2 px primary ring.
8. "+ New track" is a 32-tall ghost row.
9. Sync tracks shows a spinner, then "Synced N tracks by audio".
10. Drift shows an amber warning badge on the track header.
11. Track menu: Rename, Remove track from script, Detach audio, Delete.

## §27. Project panel

1. The Project rail item comes first. The header is 48 tall with a 28-tall outline Upload button.
2. The Compositions title is 12/600 uppercase muted, 32 tall, with New composition and New folder buttons (28).
3. Composition rows are 40 tall: current check, name, aspect chip, mono duration, and ⋯ on hover.
4. Transovo: Full video comes first. Under it, a collapsible "Clips (N)" group is sorted by score, and each row has a 20 gradient score ring and a 9:16 chip.
5. Clicking a clip changes the URL to `/app/projects/:projectId/edit/:compositionId`.
6. The current composition row is `bg-accent` with ✓. F2 renames it inline (28-tall input).
7. The composition ⋯ menu is 240 wide. Transovo adds Re-score, Regenerate hook and Open in new tab.
8. The Files section has add, sort and grid/list buttons, and a 32-tall search.
9. Folder rows are 36 tall with a rotating chevron. File rows are 40 tall with a 32×18 thumb and mono duration.
10. Uploading files show a 2-tall progress bar under the row.
11. With no files, a dashed 120-tall area reads "Drop files to add them to this project".
12. A failed file shows a red warning and "Failed · Retry".
13. Transovo Import menu: Upload, YouTube link, Google Drive. There is no Zoom or Mobile.
14. "＋ ▸ ✨ Make clips" opens the Create clips panel, where Submit is the gradient button.
15. ★ The aspect chip hides when the panel is under 300 wide.
