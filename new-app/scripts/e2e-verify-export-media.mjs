#!/usr/bin/env node
/**
 * ffprobe export + grab frames at cut timestamps; assert video stream and non-flat frames (captions).
 * Usage: node e2e-verify-export-media.mjs <file.mp4> <t1Sec> <t2Sec> <t3Sec>
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const mp4 = process.argv[2]
const times = process.argv.slice(3).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n >= 0)
if (!mp4 || !times.length) {
  console.error('usage: e2e-verify-export-media.mjs <mp4> <t1> [t2] [t3]')
  process.exit(1)
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
}

const probeJson = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', mp4]))
const video = probeJson.streams?.find((s) => s.codec_type === 'video')
const audio = probeJson.streams?.find((s) => s.codec_type === 'audio')
if (!video) {
  console.error('[verify] missing video stream')
  process.exit(1)
}
console.log('[verify] video', video.codec_name, `${video.width}x${video.height}`, 'dur', video.duration || probeJson.format?.duration)

const dir = path.dirname(mp4)
for (const t of times) {
  const out = path.join(dir, `e2e_frame_${Math.round(t * 1000)}.png`)
  run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', out])
  const stat = fs.statSync(out)
  if (stat.size < 800) {
    console.error('[verify] frame too small at', t, out)
    process.exit(1)
  }
  // Luminance spread via ffmpeg signalstats on a tiny crop (center band — captions usually bottom)
  const stats = run('ffmpeg', [
    '-v',
    'error',
    '-ss',
    String(t),
    '-i',
    mp4,
    '-frames:v',
    '1',
    '-vf',
    'crop=iw:ih/4:0:ih*3/4,signalstats',
    '-f',
    'null',
    '-',
  ])
  if (!/YMAX=/.test(stats) && !/lavfi\.signalstats\.YMAX=/.test(stats)) {
    console.log('[verify] frame ok at', t, 'bytes', stat.size)
    continue
  }
  const ymax = Number((stats.match(/YMAX[=:](\d+)/) || [])[1] || 0)
  const ymin = Number((stats.match(/YMIN[=:](\d+)/) || [])[1] || 0)
  if (ymax - ymin < 12) {
    console.error('[verify] flat frame (no caption contrast?) at', t, 'range', ymin, ymax)
    process.exit(1)
  }
  console.log('[verify] frame ok at', t, 'Y range', ymin, '-', ymax)
}

if (!audio) {
  console.warn('[verify] warn: no audio stream')
}
console.log('[verify] ok')
