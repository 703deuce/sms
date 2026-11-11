#!/usr/bin/env bash
# Offline, 160x90 proof: 30 ordered 30fps slots; photo first, video second,
# repeated assets, continuous global text/audio. No paid/external service.
set -euo pipefail
python3 - <<'PY'
import subprocess
import tempfile
from pathlib import Path

def run(args):
    completed = subprocess.run(args, capture_output=True, text=True, check=False)
    if completed.returncode:
        raise RuntimeError((completed.stderr or '')[-2000:])
    return completed.stdout.strip()

with tempfile.TemporaryDirectory(prefix='transovo-template-proof-') as tmp:
    d = Path(tmp)
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
         'color=c=black:s=160x90:r=30:d=30','-f','lavfi','-i',
         'anullsrc=channel_layout=stereo:sample_rate=48000',
         '-t','30','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',str(d/'clock.mp4')])
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
         'color=c=red:s=160x90','-frames:v','1',str(d/'photo.png')])
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
         'color=c=blue:s=160x90:r=30:d=1','-frames:v','30','-c:v','libx264',
         '-pix_fmt','yuv420p',str(d/'video.mp4')])
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
         'sine=frequency=440:sample_rate=48000:duration=30','-c:a','aac',str(d/'music.m4a')])
    graph = [
        '[1:v]split=15' + ''.join(f'[p{i}]' for i in range(15)),
        '[2:v]split=15' + ''.join(f'[q{i}]' for i in range(15)),
    ]
    for i in range(30):
        src = f'p{i//2}' if i % 2 == 0 else f'q{i//2}'
        graph.append(f'[{src}]trim=duration=1,setpts=PTS-STARTPTS+{i}/TB[s{i}]')
    previous = '0:v'
    for i in range(30):
        next_label = f'v{i}'
        graph.append(
            f"[{previous}][s{i}]overlay=eof_action=pass:"
            f"enable='between(t,{i},{i}.999)'[{next_label}]"
        )
        previous = next_label
    graph.append(f"[{previous}]drawtext=text='GLOBAL TEXT ALL 30 SLOTS':"
                 "fontsize=10:fontcolor=white:x=3:y=3[v]")
    graph.append('[3:a]atrim=duration=30,asetpts=PTS-STARTPTS[a]')
    run(['ffmpeg','-hide_banner','-loglevel','error','-y',
         '-i',str(d/'clock.mp4'),'-loop','1','-framerate','30','-t','31',
         '-i',str(d/'photo.png'),'-stream_loop','-1','-i',str(d/'video.mp4'),
         '-i',str(d/'music.m4a'),'-filter_complex',';'.join(graph),
         '-map','[v]','-map','[a]','-frames:v','900','-r','30',
         '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
         '-c:a','aac',str(d/'proof.mp4')])
    frames = run(['ffprobe','-v','error','-select_streams','v:0','-count_frames',
                  '-show_entries','stream=nb_read_frames',
                  '-of','default=noprint_wrappers=1:nokey=1',str(d/'proof.mp4')])
    duration = run(['ffprobe','-v','error','-show_entries','format=duration',
                    '-of','default=noprint_wrappers=1:nokey=1',str(d/'proof.mp4')])
    streams = run(['ffprobe','-v','error','-show_entries','stream=codec_type',
                   '-of','default=noprint_wrappers=1:nokey=1',str(d/'proof.mp4')])
    assert frames == '900', frames
    assert duration == '30.000000', duration
    assert 'video' in streams and 'audio' in streams, streams
    print('PASS 30 photo/video slots, repeated assets, continuous text/music; '
          '900 frames, 30.000000s, video+audio')
    print('LIMITATION offline graph only: not an exported ClipEditsV2 render or preview')
PY
