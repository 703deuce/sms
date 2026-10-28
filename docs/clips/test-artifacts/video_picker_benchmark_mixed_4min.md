# Video picker replay — mixed_4min (`proj_3edeaf9309b74bbfa8ce5313b0e346c3`)

One download, `skip_edge_reassess=True`, no render. Worker image at run time: `9f03a93e5`.

| Variant | res / fps / order | tokens in/out | est $ | sections (summary) | moments (start–end / peak / cat) | Apex 80–170s | Meow ~170–226s |
|---------|-------------------|---------------|-------|-------------------|----------------------------------|--------------|----------------|
| **a baseline** | LOW, 0.5, video→text | 19153 / 965 | 0.00230 | talk 0–80, gaming 80–250*, talk 250+ | 39–66 talk; 220–226 gaming | ✗ | ✗ |
| **b MEDIUM** | MED, 0.5, video→text | 41041 / 823 | 0.00443 | talk 0–120, gaming 120–250, talk 250+ | **121–211 gaming**; 0–78 talk | ✓ | ✗ |
| **c fps 1.0** | — | — | — | — | *429 high demand* | — | — |
| **d transcript_first** | LOW, 0.5, **text→video** | 19153 / 992 | **0.00231** | talk 0–81, gaming+talk 81–170, talk 170–226 | 38–66 talk; **170–225 meow**; 219–226 apex fight | ✓ | ✓ |
| **d video_first** | — | — | — | — | *429 high demand* | — | — |
| **e pro** | gemini-2.5-pro | — | — | — | model retired for new users | — | — |

\*Baseline sections extended past 226s file length (model drift); moments still clustered &lt;92s on original failed prod run.

**Default chosen:** `VIDEO_PICKER_USER_PART_ORDER=transcript_first` (LOW res, fps 0.5 unchanged — cheapest config that matches Opus-style **gameplay + meow** coverage).

**Note:** Production run @ `49f9bda5e` used video-first + edge reassess noise; core issue was transcript-after-video bias + collapsed pass2, not only Gemini.
