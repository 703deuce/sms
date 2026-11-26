# Color and look: reference (ffmpeg, works on any MP4)

## Per-clip normalize + balance (start values, then look at a still)
```bash
# exposure/contrast/saturation; colorbalance shifts shadows/mids/highs (-1..1)
ffmpeg -i in.mp4 -vf "eq=contrast=1.06:brightness=0.02:saturation=0.9,\
colorbalance=rs=-0.03:bs=0.04:rm=0.02:bm=-0.02" -c:a copy norm.mp4
```
Auto starting point for very off footage: `normalize=blackpt=black:whitept=white:smoothing=20` (then reduce).

## Look recipes (apply the same to every segment)
```bash
# cool shadows, warm mids, slight matte, 70% strength via blend
LOOK="curves=all='0/0.04 0.5/0.5 1/0.97':r='0/0 0.5/0.52 1/1':b='0/0.06 0.5/0.48 1/0.97',eq=saturation=0.92"
ffmpeg -i seg.mp4 -filter_complex "[0:v]split[a][b];[b]$LOOK[g];[a][g]blend=all_mode=normal:all_opacity=0.7" graded.mp4
# 3D LUT if you have one (.cube): lut3d=file=look.cube,  then blend at 0.6-0.8 the same way
```
Palettes: `court/crime` base #14161b, accent #d63a2f, paper #e9e2d0. `history` #2b2118 / #c8a46a / #efe6d2.
`tech` #0c1118 / #36c2ff / #e6edf3. `nature` #1d2219 / #8fbf5a / #ece7da.

## Texture on the final (once)
```bash
ffmpeg -i cut.mp4 -vf "noise=alls=6:allf=t,vignette=angle=PI/5:mode=forward" \
  -c:v libx264 -crf 26 -preset medium -maxrate 2.5M -bufsize 5M -pix_fmt yuv420p -c:a copy final.mp4
```
Halation-lite (bloom on highlights): split, `curves` to keep only highs, `gblur=sigma=12`, tint warm, blend
`screen` at 0.15-0.25. Skip it on dark UI looks.

## Order (node tree used by colorists)
1 input/normalize -> 2 exposure/contrast -> 3 white balance -> 4 saturation -> 5 secondary (skin isolate if
needed) -> 6 shot match to hero -> 7 look (group/timeline level) -> 8 vignette -> 9 grain/halation at output.

## Sources (fetched Nov 26, 2026)
- Blackmagic DaVinci Resolve 20 Colorist Guide (primaries, node order, shot matching): https://documents.blackmagicdesign.com/UserManuals/DaVinci-Resolve-20-Colorist-Guide.pdf
- Color grading basics (normalize -> balance -> grade): https://www.apovedam.com/en/free-video-editing-course/color-grading-basics.html
- Shot matching to a hero shot: https://colorgrade.video/color-grading-tutorial/shot-matching
- Creative looks (restrained teal/orange, grain at delivery resolution, look at 60-80%): https://colorgrade.video/color-grading-tutorial/creative-looks
- HSM University CINE-310 (skin tones on the vectorscope, look development): https://hsmuniversity.org/us/course/cine-310-color-science-and-grading/lesson-4-balancing-and-matching-shots
- 13-node colorist tree (correction before look, texture last): https://jpmboira.com


---

# Craft standards: colour and grade basics (detail and sources)

**Must** = a hard pro or platform standard; breaking one fails review. **Should** = a strong default; break it on
purpose and write one line in `log/job.md` saying why. **Freedom** = where creativity is open: every visual choice
(type family, palette, layout shape, motion grammar, texture) stays open unless a line is marked Must.
Units: pixels for 1080x1920 with the 480x854 value in brackets (x 0.444); frames at 30 fps (1 f = 33.3 ms).
Source labels in [BRACKETS] resolve in `/workspace/skills/lab-video-edit/craft-sources.md`.

## 1.13 Colour and grade basics
- **Order of work:** correct exposure and white balance first, then protect skin, then apply the creative look [HSM-CINE].
- **Skin.** On the vectorscope, skin of every ethnicity falls near the **skin-tone line (I-line)** between red and yellow. Skin varies mostly in brightness and saturation, not hue [HSM-CINE].
- **Rec.709 starting targets** (not rules) [HSM-CINE]:
  - Light skin 60–70%, medium 45–60%, darker 30–45%.
  - Diffuse white 85–95%, middle grey 40–45%.
  - Deep shadows with detail 5–15%.
- **Don't crush blacks or clip whites.** A flat line along the bottom or top of the waveform means detail is lost. Expose each person's skin for detail [HSM-CINE].
- **Legal range (8-bit).** Nominal 16–235. EBU R103 lets RGB and luma use the "preferred" 5–246 range; outside that is a gamut error [EBU-R103].
- **Must for delivery:** tag SDR as **BT.709** primaries, transfer and matrix, in **limited** range. YouTube assumes BT.709 when tags are missing and converts full range to limited [YT-ENC].
