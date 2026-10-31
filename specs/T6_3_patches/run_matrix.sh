#!/usr/bin/env bash
# T6.3 acceptance (a): real worker export path over all templates / titles / CPs on both real videos.
# Run from worker/ with the patched tree. Needs: A11.mp4 (c5_quiet_gaming 0-11s), B11.mp4 (c1_irl_encounter 42-53s),
# A_db.json / B_db.json (edits+aiMeta of the E2E clips). Outputs mp4 + frames at 1/5/10s + contact sheets.
set -u
A=${A:-/tmp/r8/A11.mp4}; B=${B:-/tmp/r8/B11.mp4}; AJ=${AJ:-$(dirname "$0")/fixtures/A_db.json}; BJ=${BJ:-$(dirname "$0")/fixtures/B_db.json}
OUT=${OUT:-/tmp/t63m}; H=${H:-$(dirname "$0")/harness_render.py}
mkdir -p "$OUT"
TEMPLATES="G1 G2 G3 G4 G5 G6 I1 I2 I3 I4 I5 I6 C1 C2 C3 C4 C5 C6 C7 C8 C9"
{
  for t in $TEMPLATES; do echo "$A $AJ $t white_on_black cp3 $OUT/A"; echo "$B $BJ $t white_on_black cp11 $OUT/B"; done
  for s in white_on_black white_on_dark_blur black_on_light_blur white_box_black; do echo "$A $AJ G1 $s cp2 $OUT/A_title"; echo "$B $BJ I3 $s cp10 $OUT/B_title"; done
  for c in cp1 cp2 cp3 cp4 cp5 cp6 cp7 cp8 cp9 cp10 cp11; do echo "$B $BJ I3 white_on_black $c $OUT/B_cp_$c"; done
} | xargs -P "${P:-6}" -L1 sh -c 'python3 '"$H"' "$0" "$1" "$2" "$3" "$4" "$5" > "$5.$2.$3.$4.log" 2>&1; echo done $2 $3 $4'
for f in "$OUT"/*/*.mp4 "$OUT"/*.mp4; do
  [ -f "$f" ] || continue
  for t in 1 5 10; do ffmpeg -v error -y -ss $t -i "$f" -frames:v 1 -vf scale=216:384 "${f%.mp4}_$t.png"; done
done
echo MATRIX_DONE
