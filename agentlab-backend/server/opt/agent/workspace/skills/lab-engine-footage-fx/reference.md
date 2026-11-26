# footage-fx: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 13. SAM 2 subject cutouts (with rembg and MediaPipe as CPU fallbacks)

- **Repo:** https://github.com/facebookresearch/sam2 @ `2b90b9f` · **Install:** `/opt/engines/sam2/` (`venv/` with CPU PyTorch, `src/` editable at the pin, `checkpoints/sam2.1_hiera_tiny.pt`)
- **Best at:** click-or-box-prompted segmentation and **tracking one subject through a clip**: isolate a player, a rapper or a car, then put text behind them, pop them out of a frame, recolour the background, or put a spotlight on them.
- **Signature:** pro "subject pop" and text-behind-subject shots, the single biggest step towards broadcast or premium social polish.
- **CPU reality:** the tiny model on CPU is slow (seconds per frame). Use it for short shots (up to about 3–4 s, downscaled to 720p for masking), and check the matte on 10 frames first (source-media preparation, not a scene render).
- **Recipe:**
  ```bash
  V=/opt/engines/sam2/venv/bin/python
  ffmpeg -i shot.mp4 -vf scale=-2:720 -q:v 2 frames/%05d.jpg           # SAM 2 reads a JPEG folder
  $V sam_track.py frames/ masks/ --point 540,700                       # script below
  ffmpeg -i shot.mp4 -framerate 30 -i masks/%05d.png -filter_complex "[1]scale=iw*1080/iw:-1,format=gray[m];[0][m]alphamerge" \
         -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le subject.mov
  ```
  ```python
  # sam_track.py
  import sys, os, numpy as np, torch; from PIL import Image; from sam2.build_sam import build_sam2_video_predictor
  src, out = sys.argv[1], sys.argv[2]; x, y = map(int, sys.argv[4].split(',')); os.makedirs(out, exist_ok=True)
  p = build_sam2_video_predictor('configs/sam2.1/sam2.1_hiera_t.yaml', '/opt/engines/sam2/checkpoints/sam2.1_hiera_tiny.pt', device='cpu')
  with torch.inference_mode():
      st = p.init_state(video_path=src); p.add_new_points_or_box(st, frame_idx=0, obj_id=1, points=np.array([[x, y]], np.float32), labels=np.array([1], np.int32))
      for i, ids, logits in p.propagate_in_video(st):
          Image.fromarray(((logits[0, 0] > 0).cpu().numpy() * 255).astype(np.uint8)).save(f'{out}/{i+1:05d}.png')
  ```
  Feather mask edges slightly (`gblur=sigma=1.5` on the matte) and look at an edge at 200%.
- **Installed check:** `/opt/engines/sam2/venv/bin/python -c 'import sam2'`; checkpoint `/opt/engines/sam2/checkpoints/sam2.1_hiera_tiny.pt`.
- **Fallback 1: rembg** (https://github.com/danielgatis/rembg @ `991927b`). Install: system Python (pip wheel; `import rembg` / `rembg` CLI); models download on first use. Per-frame salient-object cutout, much faster, no prompt.
  `rembg p -m u2net_human_seg frames/ cut/` writes RGBA PNGs, then `ffmpeg -framerate 30 -i cut/%05d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le subject.mov`. Edges can flicker between frames, so check the motion strip.
- **Fallback 2: MediaPipe** (https://github.com/google-ai-edge/mediapipe @ `40a1ecc`, pip wheel). Install: system Python (`import mediapipe`); download the free models `selfie_segmenter.tflite` / `selfie_multiclass_256x256.tflite` from Google's MediaPipe model page on first use. Real-time CPU person segmentation (and hair, skin and clothes classes). Best for people in interviews or press clips. Use the Tasks API `ImageSegmenter` in `VIDEO` mode, write masks, then `alphamerge` as above.
- **As a layer:** the cutout is the `subject` layer, above the type layer and below the FX layer.


## 14. OpenCV tracking and optical flow

- **Repo:** https://github.com/opencv/opencv-python @ `56b7342` (wheel `opencv-contrib-python-headless`; core https://github.com/opencv/opencv @ `5d0660a`) · **Install:** system Python (`import cv2`, contrib build, 4.x).
- **Output:** `track.json` (`[{f, x, y, w, h}]`). Remotion, GSAP or Skia layers read it to pin graphics to the subject.
- **Recipe:**
  ```python
  import cv2, json; cap = cv2.VideoCapture('shot.mp4'); ok, f = cap.read(); trk = cv2.TrackerCSRT_create(); trk.init(f, (x, y, w, h)); out = []
  i = 0
  while ok: ok2, b = trk.update(f); out.append({'f': i, 'x': b[0], 'y': b[1], 'w': b[2], 'h': b[3], 'ok': ok2}); ok, f = cap.read(); i += 1
  json.dump(out, open('track.json', 'w'))
  ```
  Smooth the track (moving average) before driving graphics. Check frames where `ok` is false.


## 15. Natron (node compositor)

- **Repo:** https://github.com/NatronGitHub/Natron @ `db3908d` (default branch RB-2.6; installed binary = release v2.5.0 portable) · **Install:** `/opt/engines/natron/Natron-2.5.0-Linux-x86_64-no-installer/`. The binary is `NatronRenderer` in that folder (libGLU installed from apt).
- **Best at:** Nuke-style node comps: keying, roto, planar tracking, grain matching, multi-layer merges.
- **Review (mandatory): a single frame only**, e.g. `/opt/engines/natron/Natron-2.5.0-Linux-x86_64-no-installer/NatronRenderer -w Write1 45-45 comp.ntp` with Write1 writing a PNG; same frame selection as browser engines, at full output size. **Final render only, after approval:** `… NatronRenderer -w Write1 1-90 comp.ntp` or `… NatronRenderer comp.py` (a Python script that builds the graph). **Installed; headless not yet proven here.** If Natron is not installed, won't run headless, or gives a worse result than the alternative, do that compositing with FFmpeg filtergraphs (16) and OpenCV (14) on the source footage and bring the result into the browser scene as a layer, reviewed there by browser still. They cover almost everything a 30–120 s film needs.


## 16. FFmpeg filtergraph effects

- **Repo:** https://github.com/FFmpeg/FFmpeg @ `e47940a` (pin noted; the box runs system `ffmpeg 7.1.5` at `/usr/bin/ffmpeg`, so there is nothing to install)
  - **Split screen / grid:** `[0][1]hstack`, `vstack`, `xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0`
  - **Speed ramp:** `setpts='if(lt(T,1),PTS,if(lt(T,1.6),PTS*3,PTS))'` (slow-mo window). Add `minterpolate=fps=60:mi_mode=mci` before it for smooth slow motion (slow on CPU; short shots only).
  - **Grade:** `lut3d=look.cube`, `curves=preset=strong_contrast`, `eq=saturation=1.2:contrast=1.08`, `colorbalance=rs=.05:bs=-.05`, `colorchannelmixer` for bleach-bypass or duotone
  - **Film texture:** `noise=alls=6:allf=t` (light grain, per frame), `vignette=PI/5`, `gblur` halation via `split,gblur,blend=all_mode=screen:all_opacity=0.25`
  - **Glitch / analogue:** `rgbashift=rh=6:bv=-6`, `chromashift`, `tblend=all_mode=difference`, `lagfun`, scanlines via `geq`
  - **Transitions:** `xfade=transition=<fade|wipeleft|slideup|circleopen|pixelize|radial|zoomin|hblur|…>:duration=0.33:offset=<s>`, and `blend` with a light-leak plate (`all_mode=screen`)
  - **Push-ins:** `zoompan=z='min(zoom+0.0015,1.2)':d=1:s=1080x1920:fps=30` on photos (render at 2× and scale down to avoid jitter)
  - **Compositing:** `overlay`, `alphamerge`, `colorkey`/`chromakey`, `maskedmerge`
- **As a layer:** this is the universal compositor and finisher for every other engine (0b above).
