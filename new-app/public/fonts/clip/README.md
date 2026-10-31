# Clip render fonts (editor preview == export)

These files are byte-identical to the fonts the clips worker burns with
(`worker/prototype/v3/fonts/*` → `/app/v3/fonts`, `worker/v3/fonts/t6/*`, and the
bookworm `fonts-dejavu-core` 2.37-6 DejaVu Sans Bold used by the hook). EP2 loads them
into libass-wasm (JASSUB) so the preview rasterises the same faces. Do not replace one
side without the other — `worker/tests/test_worker_fonts.py` checks the hashes.

| File | Family (libass name ID 1) | License |
|---|---|---|
| Anton-Regular.ttf | Anton | SIL OFL 1.1 |
| Montserrat-Black.ttf | Montserrat Black | SIL OFL 1.1 |
| Poppins-ExtraBold.ttf | Poppins ExtraBold | SIL OFL 1.1 |
| ArchivoBlack.ttf | Archivo Black | SIL OFL 1.1 |
| Bangers.ttf | Bangers | SIL OFL 1.1 |
| BebasNeue.ttf | Bebas Neue | SIL OFL 1.1 |
| Inter.ttf | Inter | SIL OFL 1.1 |
| Lato.ttf | Lato Black | SIL OFL 1.1 |
| LuckiestGuy.ttf | Luckiest Guy | Apache 2.0 |
| Oswald.ttf | Oswald | SIL OFL 1.1 |
| DejaVuSans-Bold.ttf | DejaVu Sans (Bold) | Bitstream Vera / DejaVu license (free) |
