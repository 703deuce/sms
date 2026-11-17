# Motion Studio brand kit + video type contract (producer summary)

Branch: `feat/motion-studio-video-types-brand-kits-20261117` at `4abbd597c` (not merged to master). Source of truth on the branch: `docs/contracts/motion-studio-video-types-brand-kits-20261117.md` plus `new-app/lib/server/motion-studio/agent-bridge.ts` and `new-app/lib/motion-studio/creative-options.ts`.

Do not print job tokens, webhook keys, or signed URLs.

## What the webhook adds

Existing assignment fields are unchanged: `prompt`, `title`, `durationSeconds`, `aspectRatio`, `resolution`, `style`, `jobId`, `jobUrl`, callbacks, and (when live) `jobToken`. The dispatcher **adds**:

```json
{
  "videoType": "animated_ad",
  "categoryGuidance": "Use original animated storytelling to highlight benefits and finish with a clear call to action.",
  "creative": {
    "videoType": "animated_ad",
    "style": "modern",
    "customStyle": "optional free-text lane when style is custom",
    "instructions": "Make the ending feel warm and optimistic.",
    "brandMode": "saved",
    "brandKitId": "msbk_<uuid>",
    "brand": {
      "name": "Example Brand",
      "primaryColor": "#172554",
      "secondaryColor": "#FFFFFF",
      "accentColor": "#F59E0B",
      "fontPreference": "geometric sans",
      "tone": "confident but friendly",
      "guidelines": "No flashing transitions.",
      "logoUploadId": "upl_...",
      "logoPlacement": "outro",
      "consistency": "guided"
    },
    "referenceUploadIds": ["upl_..."]
  },
  "width": 720,
  "height": 1280,
  "fps": 30,
  "resolution": "720p"
}
```

`prompt` is never rewritten. Creative guidance is separate.

## Field reference

| Field | Meaning |
|---|---|
| `videoType` | Catalog id for what the customer wants to produce. 22 values in code: `anything` (Anything / Custom), `documentary`, `social_video`, `explainer`, `educational`, `faq`, `testimonial`, `video_ad`, `animated_ad`, `product_demo`, `animated_typography`, `animated_design`, `logo_animation`, `cinemagraph`, `display_loop`, `ui_animation`, `nft_design`, `gif`, `video_editing`, `audiogram`, `text_overlay`, `template_customization`. The committed contract doc says “21 values” and omits `nft_design`. |
| `categoryGuidance` | Short production-requirements sentence for that type, from `directorCategoryGuidance()`. Shapes research and structure. **Not a scene template.** |
| `creative.style` | Optional visual direction: `automatic`, `minimalist`, `modern`, `cinematic`, `bold`, `luxury`, `playful`, `editorial`, `retro`, `futuristic`, `custom`. Fold into Visual DNA. |
| `creative.customStyle` | Free-text lane when `style` is `custom`. Not shown in the contract doc’s example, but it is on the wire. |
| `creative.instructions` | Extra customer direction. Sits on top of the original `prompt`; do not overwrite the prompt. |
| `creative.brandMode` | `none` (ignore brand fields), `project` (one-off snapshot), `saved` (snapshot from a workspace kit). |
| `creative.brandKitId` | Saved kit id (`msbk_…`) when `brandMode` is `saved`. The kit is snapshotted at project creation; later kit edits must not rewrite this job. |
| `creative.brand.name` | Brand name. |
| `creative.brand.primaryColor` / `secondaryColor` / `accentColor` | 6-digit HEX (sanitized to uppercase). Invalid colors are dropped. This is the “brand colors” object; there is no nested `colors` key. |
| `creative.brand.fontPreference` | Typography preference (not named `typography` on the wire). |
| `creative.brand.tone` | Personality / tone (not named `personality` on the wire). |
| `creative.brand.guidelines` | Written brand guidelines (max 3000 chars). |
| `creative.brand.logoUploadId` | Logo file, via existing `clipUpload` (PNG / JPEG / WebP only; SVG is rejected). |
| `creative.brand.logoPlacement` | `intro` / `outro` / `watermark` / `ai_decides` / `none`. Honor it. |
| `creative.brand.consistency` | `guided` (brand leads, director has freedom), `strict` (exact colors, fonts, logo usage), `creative` (loose inspiration unless something is mandatory). Default if missing: `guided`. |
| `creative.referenceUploadIds` | Up to 12 inspiration image/video upload IDs. Analyze for direction; do not copy compositions. |
| `durationSeconds` | 30 / 60 / 120 / 180 / 300 from the form (UI minimum is 30). Fallback is `lengthMin * 60`. |
| `aspectRatio` | Taken from `settings.format` before the underscore: `16:9`, `9:16`, or `1:1`. |
| `resolution`, `width`, `height`, `fps` | Output size. Resolution is `480p` / `720p` / `1080p` (or `2160p` if present). Width is computed from aspect × height, evened to a multiple of 2. Default if unset: 480p. `fps` is 30. |
| Top-level `style` | If `creative.style` is `automatic`, this falls back to the older `settings.visualDirection` or `cinematic`. If `custom`, this becomes `customStyle` or `"custom"`. Otherwise it copies `creative.style`. |

Precedence written into the app contract: mandatory facts and safety > user’s explicit instructions > strict brand constraints > category guidance > optional style. Never use category or brand as a scene template.

## GET `{jobUrl}`

Authenticated with the existing job bearer token (never print it). The assignment body now returns each input as:

`{ uploadId, filename, mime, url }`

plus `title`, `prompt`, `settings`, `workflow`, and the public job fields. `settings.creative` is the frozen brief. Correlate `uploadId` with `creative.brand.logoUploadId` and `creative.referenceUploadIds`. Signed `url` values expire in **30 minutes** (1800s). Download immediately; never log the URLs.

## Brand Kits API (app side, not the producer)

- `GET/POST /api/motion-studio/brand-kits` — list or create; POST with an existing `msbk_…` id updates that kit.
- `DELETE /api/motion-studio/brand-kits/:id` — delete. There is no dedicated PATCH route.
- Migration: `20261117090000_motion_studio_brand_kits` (additive `MotionStudioBrandKit` table only).

## Known caveats (do not treat as producer features)

- Motion Studio still uses temporary **no-login testing authorization** (`requireMotionStudioCaller` in `auth.ts` resolves a pinned workspace and internal operator, and does not consult a session). Must be hardened before public paid access. Testing quotas remain 3 initial jobs/day and 3 active jobs/user.
- Native **GIF** export, alpha backgrounds, seamless loops, very short logo animations, and guaranteed 9:16 / 1:1 render/preview/timeline parity are **not** validated. Current render path is MP4. Do not promise those formats.
- Dispatch currently hardcodes `mediaPolicy: "auto_plus_uploads"` and `webResearch: true`, even though a stale UI comment still mentions `uploads_only`.
- Logo MIME allow-list is PNG/JPEG/WebP only (SVG is not accepted).
