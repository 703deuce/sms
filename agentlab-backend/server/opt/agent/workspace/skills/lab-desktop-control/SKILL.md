---
name: lab-desktop-control
description: Desktop clicks, drags, scrolls, zoom, keys by screen pixels
when_to_use: Use before clicking, dragging, scrolling, zooming, or typing on the desktop by screen coordinates (desktop-shot, click, drag, scroll, zoom, key, desktop-type).
---

# Desktop control commands

(Moved word for word from AGENTS.md lines 154-160. These are still your rules; they just load on demand.)

- Look: `desktop-status`; `desktop-shot [-o out.png]`, then the `agent_view` tool on it (vision models, always) or `look out.png "..."` (text-only).
- Act (every action takes `--shot [out.png]` to screenshot right after it, then `agent_view` that file to check the result; coordinates are screen pixels from a desktop-shot; `CMD --help` shows all options):
  - `desktop-open [url]` (new tab in the shared browser), `click X Y` with `--right`, `--middle`, `--double`, `--triple`, `--mods ctrl,shift,alt,super` (ctrl+click, shift+click).
  - `drag X1 Y1 X2 Y2 [--steps 20] [--hold-ms 150] [--mods shift]`: press, move in steps, release (sliders, drag-and-drop, moving windows, selecting text).
  - `scroll up|down|left|right [N] [--at X Y] [--mods shift]`: N wheel notches (about 100-120 px each in Chromium).
  - `zoom in|out|reset [N]` (ctrl+plus/minus/0) or `zoom in N --wheel --at X Y` (ctrl+wheel around a point: maps, image editors).
  - `desktop-type "text" [--enter]` (text is not logged), `key Return` / `key ctrl+l` / `key Right --hold-ms 2000` (hold a key).
