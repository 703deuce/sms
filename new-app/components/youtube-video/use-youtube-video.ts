'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  createYoutubeVideoController,
  type CreateYoutubeVideoControllerOptions,
  type YoutubeVideoController,
  type YoutubeVideoSessionState,
} from '../../lib/youtube-video/controller'

export function useYoutubeVideo(opts: CreateYoutubeVideoControllerOptions = {}): {
  state: YoutubeVideoSessionState
  controller: YoutubeVideoController
} {
  const [controller] = useState(() => createYoutubeVideoController(opts))
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  useEffect(() => {
    return () => {
      controller.destroy()
    }
  }, [controller])
  return { state, controller }
}
