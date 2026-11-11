#!/usr/bin/env bash
# Experimental low-resolution carrier proof. No external service or user media.
# Run: bash new-app/scripts/prove-real-video-template-carrier.sh
# Demonstrates 1 still + 1 video, a neutral silent carrier, uninterrupted output
# text and 2s audio. NOT proof of worker/preview adapter parity or transitions.
set -euo pipefail
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
ffmpeg -hide_banner -loglevel error -y -f lavfi -i color=c=black:s=160x90:r=30:d=2 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -t 2 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT/carrier.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i color=c=red:s=160x90 -frames:v 1 "$OUT/photo.png"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i color=c=blue:s=160x90:r=30:d=1 -frames:v 30 -c:v libx264 -pix_fmt yuv420p "$OUT/video.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 -c:a aac "$OUT/music.m4a"
ffmpeg -hide_banner -loglevel error -y -i "$OUT/carrier.mp4" -loop 1 -framerate 30 -t 2 -i "$OUT/photo.png" -i "$OUT/video.mp4" -i "$OUT/music.m4a" \
  -filter_complex "[1:v]trim=duration=1,setpts=PTS-STARTPTS[v1];[2:v]setpts=PTS-STARTPTS+1/TB[v2];[0:v][v1]overlay=enable='between(t,0,0.999)':eof_action=pass[tmp];[tmp][v2]overlay=enable='between(t,1,1.999)':eof_action=pass,drawtext=text='TEXT THROUGH BOTH SLOTS':fontcolor=white:fontsize=10:x=5:y=5[v];[3:a]atrim=duration=2,asetpts=PTS-STARTPTS[a]" \
  -map "[v]" -map "[a]" -frames:v 60 -r 30 -c:v libx264 -pix_fmt yuv420p -c:a aac "$OUT/proof.mp4"
FRAMES="$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of default=noprint_wrappers=1:nokey=1 "$OUT/proof.mp4")"
DURATION="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT/proof.mp4")"
STREAMS="$(ffprobe -v error -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "$OUT/proof.mp4" | sort | tr '\n' ' ')"
test "$FRAMES" = "60"
test "$DURATION" = "2.000000"
[[ "$STREAMS" == *audio* && "$STREAMS" == *video* ]]
echo "PASS neutral carrier + photo + video + full-length text/audio: frames=$FRAMES duration=$DURATION streams=$STREAMS"
echo "LIMITATION: standalone FFmpeg technique only; no worker, preview or saved-edit integration asserted"
