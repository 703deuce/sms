# Color and style: correct, match, look, graphics in the grade, finishing

On BYOF jobs, the customer's footage and stated intent play the role of the DP. We finish their picture; we don't replace it with ours. Colorist Walter Volpatto: when material arrives well shot, "my job is to not mess it up!" ([postPerspective](https://postperspective.com/fotokem-colorist-walter-volpatto-discusses-process-stonewall/)).

## 1. Decide the intent first

- **Reality or emotion?** An explainer, tutorial or testimonial needs honest color. A promo, music piece or trailer can push further. Decide before touching anything.

- **Write a one-line look statement** in `log/job.md`, from the customer's direction and the actual footage (for example, "warm, low-contrast, late-afternoon classroom"). It's part of the film's design system (`design-and-motion.md` §2), and it must differ from recent films in the style ledger.

## 2. Correct before any look (fixed order)

1. **Correct each shot:** exposure, white balance and contrast range, so each one is neutral and true.

2. **Match** the shots in a scene so they feel filmed in the same moment. Match by eye on skin, and confirm numerically (FFmpeg `signalstats` or a waveform/vectorscope still).

3. **Then the look,** as one film-wide treatment on top of the balanced shots, often at partial strength. Exposure and contrast are set per shot, not inside the look (Cullen Kelly, [summary](https://daejeonchronicles.com/2024/09/08/exposure-contrast-not-allowed-in-look-development/)).

4. **Secondaries,** sparingly: skin, a distracting coloured object, a sky.

- *Judge:* compare stills from both sides of every cut. Does the color jump when the story doesn't?

- *Trap:* a LUT on everything at 100%, then trying to fix the shots it broke.

- Correcting customer footage is source-media prep (an FFmpeg grade into the plate, or a browser filter on the footage layer), never a review render. Mixed sources (phone, screen recording, camera) need matching most.

## 3. Protect what must stay readable

- **Skin:** viewers forgive an odd sky, but not sick-looking skin. The vectorscope skin line is a diagnostic, not a target ([SideScopes](https://sidescopes.com/learn/skin-tones/)). If a look pushes skin green or orange, pull the look back instead of stacking fixes.

- **Contrast is mood.** Lifted blacks feel soft, nostalgic or dreamy. Crushed blacks feel hard and commercial. Never crush or clip detail the viewer needs, like the whiteboard writing, a screen, or a product label.

- **Saturation is energy.** Over-saturation is the most common novice tell. Saturate the subject and calm the background.

- **Texture tells you what the image is.** Grain, softness and halation make footage read as film, archive or a phone clip. Matching texture glues mixed sources together.

- **Color can follow the story.** Even 60 s can move from cool to warm at its turn. A good grade is felt more than seen ("not something you can see but rather feel", Volpatto on *Stonewall*).

## 4. Graphics live inside the grade

- Sample the graphic palette from the graded footage: take the dominant hues, then one accent that contrasts with skin and background, used sparingly for what matters.

- Match the white and black points. If the footage's blacks are lifted and its whites are warm, the graphics' "white" and "black" should be too, or run through the same look. Pure #FFFFFF and web primaries over a filmic grade look pasted on.

- Add the footage's grain and softness to graphics. Add dither or grain to large flat graphic areas to prevent banding.

- Check readability in grayscale (value first, then hue).

## 5. Lighting, read in the edit

- Choose takes and moments by light. Keep light continuity within a scene.

- A gentle custom vignette or slight darkening around the subject guides the eye, the way eye trace does at a cut ([parker.mov](https://www.parker.mov/tools/editologica/eye-trace)).

- Finishing touches (shake, grain, a vignette) belong to a film-wide idea, not one-off tricks.

## 6. Finishing QC (the last 5%)

- **Picture:** no flash frames or one-frame gaps at cuts, no black frames at the head, no accidental frozen frames, no banding, no color jumps at cuts. Check every graphic at full size for typos, kerning and overflow. Check the frame rate matches the source (no judder from mixed rates).

- **Delivery tags:** Rec.709 primaries, transfer and matrix tagged, so phones don't shift colors.

- **Device:** watch the delivered output once the way the viewer will (a phone-size view for vertical).

## 7. Novice vs pro

| Novice | Pro |
|---|---|
| Creative LUT on everything at 100% | Balance and match first; look on top, often partial |
| Teal-and-orange regardless of the story | A palette chosen for this film's mood and subject |
| Over-saturated, crunchy, over-sharpened | Restraint, protected highlights, natural skin |
| Color jumps at the cut | Matched scenes; color changes only with the story |
| Crushed blacks hiding the board or screen | Contrast chosen around what must stay readable |
| Clean vector graphics over a grainy grade | Graphics graded and textured into the same world |
