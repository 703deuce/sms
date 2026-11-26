# manim: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 7. Manim (Community)

- **Repo:** https://github.com/ManimCommunity/manim @ `e8afc63` · **Install:** `/opt/engines/js/env` (Python 3.12 env with cairo, pango, pycairo and manimpango from conda-forge via `manim/bin/micromamba`; manim itself pip-installed from `src/` at the pin, v0.22.1). The box's Debian apt mirror was unreachable, so system dev libraries were not used.
- **Best at:** maths and logic explainers: plotted graphs that grow, number lines, geometric transforms, equations morphing, step-by-step diagrams, probability and stat visuals.
- **Signature:** the 3Blue1Brown look: dark field, precise strokes, objects transforming into each other.
- **Headless render (native CLI, no browser):**
  ```bash
  M=manim
  $M render -qh --fps 30 -r 1080,1920 scene.py StatsRise -o S08.mp4             # opaque
  $M render -qh --fps 30 -r 1080,1920 --transparent --format mov scene.py StatsRise   # alpha .mov layer
  MS_FREEZE_T=1.2 $M render -s -qh -r 1080,1920 scene.py StatsRise            # REVIEW (mandatory): one full-size PNG at t=1.2 s, no video
  ```
  `-r` is width,height on the installed v0.22.1 (`1080,1920` = 9:16; verified against `manim render --help`). `-s` saves the last frame as PNG; `-n <i>` starts from animation number i. **Mandatory freeze-at-time switch:** every Manim scene drives all motion from one `ValueTracker` clock, and when env var `MS_FREEZE_T` is set it sets the clock to that time and ends the scene, so `-s` saves the exact mid-move frame. Review the same frames as browser engines (first, busiest, last, along every move) at full output size. The video render lines are the final render only, after approval. Output goes in `media/videos/...`; move it to `scenes/<id>/out/`.
- **Minimal recipe:**
  ```python
  from manim import *
  class StatsRise(Scene):
      def construct(self):
          ax = Axes(x_range=[0,4,1], y_range=[0,50,10], x_length=8, y_length=5)
          g = ax.plot_line_graph([0,1,2,3,4], [0,14,27,40,46], line_color=YELLOW)
          self.play(Create(ax), run_time=0.6); self.play(Create(g), run_time=1.8); self.wait(0.6)
  ```
- **As a layer:** `--transparent --format mov` gives an alpha graph over footage or a background.
