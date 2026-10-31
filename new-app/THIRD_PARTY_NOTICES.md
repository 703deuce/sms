# Third-party notices (new-app)

| Component | Where | Licence | Notes |
|---|---|---|---|
| JASSUB 2.5.23 (libass 0.17.5, FriBidi 1.0.16, HarfBuzz, FreeType, Brotli, zlib) | `public/jassub/2.5.23/` | MIT; **FriBidi LGPL-2.1-or-later**; libass ISC; FreeType FTL; others MIT/Zlib/BSL | The editor preview's subtitle renderer. The WASM files are the **unmodified** npm artefacts, served as separate replaceable files; full notices in `public/jassub/2.5.23/NOTICES.txt` (served at `/jassub/2.5.23/NOTICES.txt`) with the LGPL text alongside. Do not patch the WASM; to upgrade, replace the whole directory (new version path). |
| abslink 1.3.1 | bundled in `public/jassub/2.5.23/*.js` | Apache-2.0 | |
| Clip render fonts | `public/fonts/clip/` | SIL OFL 1.1 / Apache-2.0 / DejaVu | Byte-identical to the worker's fonts; see the README there. |
