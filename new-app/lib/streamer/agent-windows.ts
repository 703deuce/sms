/** Original-source time ranges to be processed by the separate AI Producer clip
 * agents. Deliberately never splice multi-hour VODs into a giant uploaded MP4. */
export const MAX_AGENT_SOURCE_WINDOW_MS=20*60_000

export function streamerAgentWindows(sourceStartMs:number,sourceDurationMs:number,
  all:boolean,selectedStartMin=0):Array<[number,number]>{
  if(!Number.isInteger(sourceStartMs)||!Number.isInteger(sourceDurationMs)||
    sourceStartMs<0||sourceDurationMs<15_000)throw Error('stream_agent_invalid_source_duration')
  const sourceEnd=sourceStartMs+sourceDurationMs
  if(!Number.isSafeInteger(sourceEnd))throw Error('stream_agent_time_out_of_range')
  const start=all?sourceStartMs:sourceStartMs+Math.max(0,selectedStartMin)*60_000
  if(!Number.isSafeInteger(start)||start>=sourceEnd)
    throw Error('stream_agent_window_start_outside_source')
  const windows:Array<[number,number]>=[]
  for(let at=start;at<sourceEnd;at+=MAX_AGENT_SOURCE_WINDOW_MS){
    const end=Math.min(sourceEnd,at+MAX_AGENT_SOURCE_WINDOW_MS)
    if(end-at>=15_000)windows.push([at,end])
    if(!all)break
  }
  if(!windows.length)throw Error('stream_agent_no_valid_windows')
  return windows
}
