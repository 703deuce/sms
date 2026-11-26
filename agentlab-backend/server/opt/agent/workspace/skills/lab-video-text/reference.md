# Craft standards: safe zones, captions, type and colour legibility (detail and sources)

**Must** = a hard pro or platform standard; breaking one fails review. **Should** = a strong default; break it on
purpose and write one line in `log/job.md` saying why. **Freedom** = where creativity is open: every visual choice
(type family, palette, layout shape, motion grammar, texture) stays open unless a line is marked Must.
Units: pixels for 1080x1920 with the 480x854 value in brackets (x 0.444); frames at 30 fps (1 f = 33.3 ms).
Source labels in [BRACKETS] resolve in `/workspace/skills/lab-video-edit/craft-sources.md`.

## 1.9 Safe zones for 9:16 (where the app UI covers the picture)
Every platform publishes its zones for ads only, but organic posts get the same UI [META-RG][GADS-V].

| Platform (source) | Top | Bottom | Left | Right |
|---|---|---|---|---|
| **TikTok In-Feed** (official template, measured by us from TikTok's PNG) [TT-SZ] | 240 (107) | 660 (293) | 120 (53) | 120 (53) above y≈790; **300 (133)** from y≈790 down |
| **Instagram/Facebook Reels** (Meta Ads Guide: 14% / 35% / 6%) [META-RG] | 269 (120) | 672 (299) | 65 (29) | 65 (29); the button rail cuts deeper bottom-right from y≈1150 (secondary measure: 227 px) [CADENUS] |
| **YouTube Shorts** (Google vertical-ad diagram; secondary readings of it) [GADS-V][SOCIALYNC] | 288 (128) | 672 (299) | 48 (21) | 192 (85) |

- **Disagreement.** A measure of the organic Shorts UI gives 309 top / 380 bottom / 49 sides [KREATLI], against 288 / 672 / 48–192 from Google's ad diagram. We use the strictest values.
- Reels ads that carry a disclaimer should leave the bottom **40%** clear [META-SZ].
- TikTok: the safe area depends on ad-caption length and add-ons, so longer captions push the bottom UI higher [TT-SPEC][TT-SPEC-SEC].

**Universal safe box (Must for all text, logos, captions, and the eyes and mouth of the active speaker):**
- **x 120–888 (53–395), y 288–1248 (128–555)**.
- Below **y 780 (347)**, the right edge moves in to **x 780 (347)** for TikTok's button column.
- That leaves 768 px (341) of width up top and 660 px (293) in the lower half.
- Faces of non-active people and B-roll may extend past it. Text may not.
- **BBC's 9:16 subtitle region** (central 75% vertically, region bottom ≤ 87.5% = y 1680) is designed for an **online player without app UI** [BBC]. On social feeds the platform zones above are stricter and win.

## 1.10 Captions and on-screen subtitles
**Quality (FCC and DCMP).** Captions must be:
- **accurate:** they match the spoken words;
- **synchronous:** timed with the speech and readable at speed;
- **complete:** start to end;
- **properly placed:** they don't block important visuals, overlap each other or run off the frame [FCC][DCMP].
- Errorless is the goal, and the meaning and intent are preserved [DCMP].
- Netflix: don't paraphrase, and transcribe slang and dialect accurately [NFX-EN].

**Size (BBC, 9:16):**
- Line height **3.9–4.5% of video height = 75–86 px (33–38)**. Font size is about **3.5% of height ≈ 67 px (30)** [BBC].
- Short-form creators often go bigger for 1–3-word captions [SUBMAGIC]. That's fine; the BBC size is the floor.
- The skill's ≥40 px cap height for labels still applies to non-caption text.

**Lines and length:**
- BBC: up to **3 lines** for 9:16, and one complete sentence per subtitle where possible. About **25 characters** fit across 90% of a 9:16 frame [BBC].
- Netflix: 2 lines max for landscape, 42 characters per line; keep to one line unless it doesn't fit; prefer a bottom-heavy pyramid when breaking [NFX-G][NFX-EN].
- Inside our universal safe width (768 px), plan on roughly **18–22 characters per line** at the BBC size. This is derived; measure the real string width.

**Where to break lines.** Break after punctuation, or before a conjunction or preposition. Never separate:
- article from noun, or adjective from noun;
- a first name from a last name;
- a subject pronoun from its verb;
- a verb from its auxiliary or negation [NFX-G].

**Reading rate:**
- BBC: 160–180 wpm, about **0.3 s per word** (≈ 9 f per word) [BBC].
- Netflix: ≤ **20 characters per second** for adults [NFX-EN].
- Disagreement: TikTok's ad guide recommends "5–10 words per second" of on-screen text [TT-CBP]. That is far faster than either broadcaster. For verbatim speech captions, follow the speech; for added text overlays, use the broadcaster rates as the readable ceiling.

**Timing (Netflix, converted to 30 fps)** [NFX-G][NFX-T]:
- Minimum event **5/6 s = 25 f**; maximum **7 s = 210 f**.
- In-time on the first audio frame (±1–2 f).
- When no caption follows, hold the out-time about **15 f** past the end of speech.
- Gaps between captions are either **2 f** or ≥ **15 f**, never 3–14 f. Close the short ones by "chaining."
- Snap to a shot change when the speech starts or ends within 15 f of it, keeping 2 f clear of the cut.
- Cross a cut only when the speech itself crosses it.

**Word-by-word ("karaoke") styles.** Keep each *phrase group* on screen for ≥ 25 f and move the highlight per word. Never flash single words for less than 25 f as separate events. This applies the Netflix minimum to that style.

**Emphasis:**
- BBC allows caps for a stressed word, used sparingly [BBC].
- *Should:* emphasise at most 1–2 words per caption.

**Position:**
- Captions must not cover a speaker's mouth or on-screen text [BBC][NFX-G].
- On 9:16 they sit "a little higher up" than on landscape, still in the lower part, because faces live in the top half [BBC]. On social that means their lowest line ends at or above **y 1248 (555)**.

**Contrast.** White text on black is the broadcast default [BBC]. Over moving video, use an outline, shadow or box so contrast stays ≥ **4.5:1** for normal text and **≥ 3:1** for large text (WCAG AA) [WCAG][SUBMAGIC].

## 1.11 Typography and colour for legibility
- **Must:** every text element must stay readable against everything behind it. Contrast is **≥ 4.5:1**, or **≥ 3:1** for large text, against the local background, measured on the actual frame [WCAG].
- Thin, unusual or display fonts may need more contrast than the threshold [WCAG].
- Meta: use "a modern, clean font in a large enough type size and a contrasting hue." Don't obstruct the visuals, and don't communicate too many messages at once [META-SZ].
- Captions: sans-serif is the broadcast and streaming default because simple shapes survive small sizes, compression and outlines. A serif can work for short, large lines [SUBMAGIC][NFX-EN].
- **Font count.** No authoritative numeric rule was found. Keep to the film's declared type roles (display, label, body).
- **Brand consistency.** Google's ABCD: use brand colours and logo as supers. Integrating the logo into the story lifts ad recall [ABCD].
