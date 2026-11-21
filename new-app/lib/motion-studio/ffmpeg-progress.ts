/** FFmpeg -progress pipe:1 emits microseconds; use the final valid value. */
export function parseFfmpegProgressDurationMs(output:string):number{
 const values=[...output.matchAll(/^out_time_us=(\d+)\r?$/gm)]
  .map(match=>Number(match[1])).filter(n=>Number.isFinite(n)&&n>=0)
 return values.length?Math.round(values[values.length-1]/1000):0
}
