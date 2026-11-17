# Motion Studio: video types, custom creative direction, brand kits — Grokbot handoff

Branch: `feat/motion-studio-video-types-brand-kits-20261117` (NOT merged to master).

## Behavior
- Creation UI: `/app/motion-studio/new` (legacy `?type=documentary` remains navigable).
- Video type dropdown has 21 values (see `new-app/lib/motion-studio/creative-options.ts`): anything, documentary, social_video, explainer, educational, faq, testimonial, video_ad, animated_ad, product_demo, animated_typography, animated_design, logo_animation, cinemagraph, display_loop, ui_animation, gif, video_editing, audiogram, text_overlay, template_customization.
- Creative styles: automatic, minimalist, modern, cinematic, bold, luxury, playful, editorial, retro, futuristic, custom.
- Independent source workflows remain: idea, script, footage. Duration remains 30/60/120/180/300 sec.
- Optional project branding: brand name, primary/secondary/accent HEX colors, typography preference, personality/tone, brand guidelines, uploaded image logo, logo placement (ai_decides/intro/outro/watermark/none), consistency (guided/strict/creative).
- Optional visual reference image/video uploads, optional free-text creative notes, optional 16:9/9:16/1:1.
- Workspace Brand Kits: GET/POST `/api/motion-studio/brand-kits`, DELETE `/api/motion-studio/brand-kits/:id`. POST with existing ID updates. Database migration `20261117090000_motion_studio_brand_kits` required; authorization is still testing-only and MUST be hardened before opening paid access.
- The selected kit is snapshotted into `MotionStudioProject.settings.creative.brand` at project creation; later edits to the kit must not rewrite earlier jobs.
- Logo and reference media use existing `clipUpload` and `studioAsset` infrastructure, not external URLs.

## Grokbot assignment contract
`POST GROKBOT_WEBHOOK_URL` from `new-app/lib/server/motion-studio/agent-bridge.ts` continues to carry existing `prompt`, `title`, `durationSeconds`, `aspectRatio`, `resolution`, `style`, `jobId`, `jobUrl`, and callback fields. It **adds**:
```json
{
  "videoType": "animated_ad",
  "categoryGuidance": "Use original animated storytelling to highlight benefits and finish with a clear call to action.",
  "creative": {
    "videoType": "animated_ad",
    "style": "modern",
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
  }
}
```
Read `GET jobUrl` with the existing bearer token to fetch signed `inputs` URLs of uploaded media. These assets include logos/references; correlate the upload ID with `creative.brand.logoUploadId` or `creative.referenceUploadIds` only if the producer receives IDs via future asset metadata enhancement. The `inputs` entries now expose `uploadId`, `filename`, `mime`, and `url` for exact matching.

**Precedence**: validated mandatory facts and safety > user's explicit instructions > strict brand constraints > category guidance > optional style suggestion. Never overwrite `prompt`, and do not treat brand or category as a scene template. Original concepts, compositions, animation, footage selection and storytelling remain the responsibility of the creative agents. `brandMode=none` means ignore brand fields; `guided` means stylistic consistency, `strict` means follow the approved identity, `creative` means broader art direction unless user states mandatory requirements.

**Rendering/export caveats**: `gif`, alpha-background outputs, and seamless looping require separate validated renderer/export capabilities. Initial selection is production guidance, not a promise of native GIF or alpha export. Existing render path is MP4. Do not invent product features or customer testimonials. Never promise 5-second exports while UI enforces 30-second minimum.

## Production readiness
- Run `prisma migrate deploy` (and Prisma generate if needed), scoped `vitest`, `tsc`, and a real end-to-end create/dispatch.
- Inspect media upload MIME validation for SVG support and protect SVG handling from unsafe active content.
- Real login/tenant authorization is NOT enabled for Motion Studio: `auth.ts` resolves pinned testing workspace. This must be fixed before public launch.
- Existing agent testing quotas (3 initial jobs/day and 3 active jobs/user) remain unchanged; they are not a SaaS quota system.
- Ensure 9:16 and 1:1 render, preview, timeline, and export have parity beyond the creation form.
- Ensure actual Grokbot producer consumes the new assignment fields; this branch adds sending, NOT changes to the external Grokbot prompt/agent code.
