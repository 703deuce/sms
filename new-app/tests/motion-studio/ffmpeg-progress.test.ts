import {describe,it,expect} from 'vitest'
import {parseFfmpegProgressDurationMs} from '../../lib/motion-studio/ffmpeg-progress'

describe('ffmpeg decoded audio duration',()=>{
 it('parses last out_time_us microsecond reading',()=>{
  const output='out_time_us=1024000\nprogress=continue\nout_time_us=36720000\nprogress=end\n'
  expect(parseFfmpegProgressDurationMs(output)).toBe(36720)
 })
 it('handles CRLF output and rejects missing or corrupt progress',()=>{
  expect(parseFfmpegProgressDurationMs('out_time_us=30000100\r\nprogress=end\r\n')).toBe(30000)
  expect(parseFfmpegProgressDurationMs('out_time_us=broken\n')).toBe(0)
 })
})
