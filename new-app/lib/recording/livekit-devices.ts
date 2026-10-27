'use client'

import {
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalParticipant,
} from 'livekit-client'

export async function listMediaDeviceOptions(kind: 'audioinput' | 'videoinput' | 'audiooutput') {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === kind).map((d) => ({ deviceId: d.deviceId, label: d.label || kind }))
}

export async function switchCameraViaReplaceTrack(participant: LocalParticipant, deviceId: string) {
  const pub = participant.getTrackPublication(Track.Source.Camera)
  const newTrack = await createLocalVideoTrack({ deviceId })
  if (pub?.track) {
    await pub.track.replaceTrack(newTrack.mediaStreamTrack)
    newTrack.stop()
    return pub.track
  }
  await participant.publishTrack(newTrack, { source: Track.Source.Camera })
  return newTrack
}

export async function switchMicrophoneViaReplaceTrack(
  participant: LocalParticipant,
  deviceId: string,
  echoCancellation: boolean,
) {
  const pub = participant.getTrackPublication(Track.Source.Microphone)
  const newTrack = await createLocalAudioTrack({
    deviceId,
    echoCancellation,
    noiseSuppression: false,
    autoGainControl: false,
  })
  if (pub?.track) {
    await pub.track.replaceTrack(newTrack.mediaStreamTrack)
    newTrack.stop()
    return pub.track
  }
  await participant.publishTrack(newTrack, { source: Track.Source.Microphone })
  return newTrack
}
