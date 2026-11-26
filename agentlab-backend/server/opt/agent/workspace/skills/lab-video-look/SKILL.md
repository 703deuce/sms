---
name: lab-video-look
description: Finish stage of a film from scratch (with the edit): colour pipeline and one look (palette, normalize/balance/match, grade, grain, vignette, halation), Rec.709 delivery.
when_to_use: Opened at the finish stage (video-stage finish); the palette is chosen at creative direction.
page_line: Finish stage: colour pipeline and one look (normalize, balance, match, grade, texture), BT.709 delivery.
attach_roles: stage
---

# Colour and look (finish stage, with the edit)

Colorists work in a fixed order: **normalize -> balance -> match -> look -> texture**. Fix each shot first, then
apply one look to all, so footage from five sources reads as one film. Filters and sources: `reference.md`.

## 0. Intent
Reality or emotion? Explainers and testimony need honest colour; promos and music pieces can push. One-line look
statement in `log/job.md`, different from recent ledger entries. Colour may follow the story (cool to warm at the
turn). Saturation is energy: saturate the subject, calm the background; over-saturation is the commonest tell.

## 1. Palette (decide at the scene plan)
- One base (deep neutral: charcoal, navy, warm black, or paper), one accent for heroes/hits (red, amber, cyan),
  one support tone. Accent appears only on what matters (the number, the verdict, the route).
- Derive the palette from the subject (court = cold slate + red; history = sepia paper + ink; tech = dark UI +
  cyan; nature = earth + green). Keep the same palette in both engines (pass hex values to Remotion).

## 2. Normalize and balance (per clip/photo, before any look)
- Set black and white points (no crushed or clipped highlights), contrast to taste, neutralise casts so whites
  and greys read neutral. Phone/news footage often needs +exposure and less saturation.
- **Skin tones first**: keep them natural and consistent across shots (hue on the vectorscope skin line); never
  let the look push skin green/grey/orange. Check every shot with a person after grading.

## 3. Match
Pick one hero shot; match every other shot's exposure, white balance and saturation to it before the look. Two
adjacent shots should not jump in brightness or tint.

## 4. Look (one, applied to everything)
- Restrained: lift blacks slightly (matte), cool or tint shadows toward the base, warm the midtones/skin, keep
  highlights clean. Apply the look at 60-80% strength, not 100%.
- Grade engine graphics and footage together (same curve) so they sit in one world; or grade footage to the
  graphics palette before it enters the frame.

## 5. Texture (last, at delivery size)
- Fine grain sized for 480p (strength 4-8, temporal), barely visible vignette (edges -10..-20%), optional soft
  halation/bloom on highlights for film looks. If you notice the vignette, it is too strong.
- Never grain twice (Cinematic already adds paper/grain in some looks; check a still).

## Graphics inside the grade
Sample the graphic palette from the graded footage; match graphic whites and blacks to the footage's (no pure
#FFFFFF over a filmic grade); give graphics the footage's grain and softness; dither large flat areas against banding.

## Craft standards (Must; Rec.709 targets and sources in `reference.md`)
- Order: exposure and white balance first, then protect skin (near the vectorscope skin-tone line), then the look.
- No crushed blacks or clipped whites on faces; 8-bit RGB and luma inside 5-246.
- Deliver SDR tagged BT.709 (primaries, transfer, matrix), limited range.

## Check
Export 3 stills (dark, bright, face) and look at them side by side: same black level, same tint, skin natural,
text contrast >= 4.5:1, nothing banding. Render order: grade per segment, then texture once on the final concat.
