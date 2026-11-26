# dolly: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 2. Dolly (pvhuwung/dolly @ `a78a821`), Remotion

- **Where:** `/opt/engines/repos/dolly`. **Manual:** `/opt/engines/repos/dolly/SKILL.md`.
  - References in `/opt/engines/repos/dolly/references/`: `camera.md` (3D kit, moves), `your-footage.md`, `record-elsewhere.md`, `agendas.md` (non-launch videos), `gotchas.md`, `recipes.md`.
  - `record-mac.md` is Mac-only, so skip it here.
  - Component catalog: `/opt/engines/repos/dolly/starter/src/library/CATALOG.md`.
- **Setup:** `/opt/engines/repos/dolly/new.sh $J/scenes/S02` (copies the starter, runs npm install, generates SFX, downloads headless Chrome; Google Chrome 156 is also at `/usr/bin/chromium`).
- **Build:** scenes in `src/scenes/`, composition `src/Video.tsx` (or a new one), brand/style in `src/brand.ts` + `src/look.tsx`. **Replace the Termary takes and logo in `public/`; they are not ours to ship.**
- **Review/render:**
  ```bash
  npx remotion still Sheet out/sheet.png                      # 1 frame/s sheet, read it
  npm run render | render:vertical | render:square | render:portrait   # final render only, after approval
  npm run check -- out/<final>.mp4                               # stutter / dead air / hook / loudness on the final render
  npx remotion render <Comp> out/S02.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le   # alpha overlay
  ```
- **Strengths:** product/SaaS demos from real recordings in 3D windows/phones; branded motion graphics; all four formats with platform-safe layouts; a built-in quality checker.
