"use client";

import {
  getDevices,
  initialize,
  type Events,
  type Message,
  type NetworkMetrics,
  type Room,
  type State,
} from "@telnyx/video";
import {
  summarizeVideoRoomState,
  traceVideoPipeline,
  traceVideoPipelineError,
} from "@/lib/transovo-video/video-pipeline-trace";

export type TransovoConnectionState =
  | "preparing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export type TransovoVideoClientOptions = {
  roomId: string;
  clientToken: string;
  context?: string;
  onStateChange?: (state: TransovoConnectionState) => void;
  onRoomStateChange?: (state: State) => void;
  onRemoteParticipantJoined?: (participantId: string, state: State) => void;
  onRemoteParticipantLeft?: (participantId: string, state: State) => void;
  onMessage?: (participantId: string, message: Message) => void;
  onNetworkMetrics?: (metrics: NetworkMetrics) => void;
  onKicked?: () => void;
  onAudioActivity?: (participantId: string) => void;
};

export type DeviceLists = {
  audioinput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
};

export const CAMERA_STREAM_KEY = "camera";
export const SCREEN_STREAM_KEY = "screen";

export class TransovoVideoClient {
  private room: Room | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private unsubscribers: Array<() => void> = [];
  private subscriptionKeys = new Set<string>();

  constructor(private readonly options: TransovoVideoClientOptions) {}

  async listDevices(): Promise<DeviceLists> {
    const raw = await getDevices();
    const normalize = (list: unknown): MediaDeviceInfo[] =>
      Array.isArray(list) ? (list as MediaDeviceInfo[]) : [];
    return {
      audioinput: normalize(raw?.audioinput),
      videoinput: normalize(raw?.videoinput),
      audiooutput: normalize(raw?.audiooutput),
    };
  }

  async connect(): Promise<Room> {
    traceVideoPipeline({
      layer: "video-client",
      step: "initialize",
      outcome: "ok",
      roomId: this.options.roomId,
      hasContext: Boolean(this.options.context),
    });
    this.options.onStateChange?.("connecting");
    this.room = await initialize({
      roomId: this.options.roomId,
      clientToken: this.options.clientToken,
      context: this.options.context,
      enableMessages: true,
    });

    this.bindRoomEvents(this.room);
    traceVideoPipeline({
      layer: "video-client",
      step: "connect_start",
      outcome: "ok",
      roomId: this.options.roomId,
    });
    await this.room.connect();
    traceVideoPipeline({
      layer: "video-client",
      step: "connect_complete",
      outcome: "connected",
      roomId: this.options.roomId,
      state: summarizeVideoRoomState(this.room.getState()),
    });
    return this.room;
  }

  getRoom(): Room | null {
    return this.room;
  }

  getState(): State | null {
    return this.room?.getState() ?? null;
  }

  private emitRoomState(state: State) {
    this.options.onRoomStateChange?.(state);
  }

  private mapConnectionStatus(status: State["status"]): TransovoConnectionState {
    if (status === "connected") return "connected";
    if (status === "connecting") return "connecting";
    if (status === "disconnected") return "disconnected";
    return "preparing";
  }

  private subscriptionCacheKey(participantId: string, key: string) {
    return `${participantId}:${key}`;
  }

  /** Telnyx docs: local participant must addSubscription for each remote published stream. */
  private async ensureRemoteSubscriptions(state: State) {
    const room = this.room;
    if (!room) return;
    const localId = state.localParticipantId;
    for (const participant of state.participants.values()) {
      if (participant.id === localId || participant.origin !== "remote") continue;
      for (const streamKey of Object.keys(participant.streams)) {
        const cacheKey = this.subscriptionCacheKey(participant.id, streamKey);
        if (this.subscriptionKeys.has(cacheKey)) continue;
        const existing = state.subscriptions.get(participant.id)?.get(streamKey);
        if (existing) {
          this.subscriptionKeys.add(cacheKey);
          continue;
        }
        try {
          traceVideoPipeline({
            layer: "video-client",
            step: "add_subscription",
            outcome: "ok",
            roomId: this.options.roomId,
            participantId: participant.id,
            streamKey,
          });
          await room.addSubscription(participant.id, streamKey, { audio: true, video: true });
          this.subscriptionKeys.add(cacheKey);
          traceVideoPipeline({
            layer: "video-client",
            step: "add_subscription_complete",
            outcome: "subscribed",
            roomId: this.options.roomId,
            participantId: participant.id,
            streamKey,
          });
        } catch (err) {
          traceVideoPipelineError("video-client", "add_subscription", err, {
            roomId: this.options.roomId,
            participantId: participant.id,
            streamKey,
          });
        }
      }
    }
  }

  private bindRoomEvents(room: Room) {
    const on = <E extends keyof Events>(event: E, cb: Events[E]) => {
      this.unsubscribers.push(room.on(event, cb));
    };

    on("state_changed", (state) => {
      this.options.onStateChange?.(this.mapConnectionStatus(state.status));
      this.emitRoomState(state);
      void this.ensureRemoteSubscriptions(state);
      traceVideoPipeline({
        layer: "video-client",
        step: "state_changed",
        outcome: this.mapConnectionStatus(state.status),
        roomId: this.options.roomId,
        state: summarizeVideoRoomState(state),
      });
    });

    on("connected", (state) => {
      this.options.onStateChange?.("connected");
      this.emitRoomState(state);
      void this.ensureRemoteSubscriptions(state);
    });

    on("disconnected", (_reason, state) => {
      this.options.onStateChange?.("disconnected");
      this.emitRoomState(state);
      traceVideoPipeline({
        layer: "video-client",
        step: "disconnected",
        outcome: "disconnected",
        roomId: this.options.roomId,
        reason: String(_reason),
        state: summarizeVideoRoomState(state),
      });
    });

    on("participant_joined", (id, state) => {
      this.options.onRemoteParticipantJoined?.(id, state);
      this.emitRoomState(state);
      void this.ensureRemoteSubscriptions(state);
    });

    on("participant_left", (id, state) => {
      this.options.onRemoteParticipantLeft?.(id, state);
      this.emitRoomState(state);
    });

    on("participant_leaving", (_id, reason) => {
      if (reason === "kicked") this.options.onKicked?.();
    });

    on("stream_published", (participantId, key, state) => {
      this.emitRoomState(state);
      void this.ensureRemoteSubscriptions(state);
      traceVideoPipeline({
        layer: "video-client",
        step: "stream_published",
        outcome: "published",
        roomId: this.options.roomId,
        participantId,
        streamKey: key,
      });
    });

    on("stream_unpublished", (_participantId, _key, state) => {
      this.emitRoomState(state);
    });

    on("track_enabled", (_participantId, _key, _kind, state) => {
      this.emitRoomState(state);
    });

    on("track_disabled", (_participantId, _key, _kind, state) => {
      this.emitRoomState(state);
    });

    on("subscription_started", (_participantId, key, state) => {
      this.emitRoomState(state);
      traceVideoPipeline({
        layer: "video-client",
        step: "subscription_started",
        outcome: "subscribed",
        roomId: this.options.roomId,
        streamKey: key,
      });
    });

    on("message_received", (participantId, message) => {
      this.options.onMessage?.(participantId, message);
    });

    on("network_metrics_report", (metrics) => {
      this.options.onNetworkMetrics?.(metrics);
    });

    on("audio_activity", (participantId, _key, state) => {
      this.options.onAudioActivity?.(participantId);
      this.emitRoomState(state);
    });
  }

  async publishCameraMicrophone(enabled: { audio: boolean; video: boolean }) {
    if (!this.room) throw new Error("Not connected");
    traceVideoPipeline({
      layer: "video-client",
      step: "publish_start",
      outcome: "ok",
      roomId: this.options.roomId,
      audio: enabled.audio,
      video: enabled.video,
    });
    if (!this.localStream) {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: enabled.audio,
        video: enabled.video,
      });
    }
    await this.room.addStream(CAMERA_STREAM_KEY, {
      audio: enabled.audio ? this.localStream.getAudioTracks()[0] : undefined,
      video: enabled.video ? this.localStream.getVideoTracks()[0] : undefined,
    });
    const state = this.room.getState();
    this.emitRoomState(state);
    traceVideoPipeline({
      layer: "video-client",
      step: "publish_complete",
      outcome: "published",
      roomId: this.options.roomId,
      state: summarizeVideoRoomState(state),
    });
  }

  async updateCameraMicrophone(enabled: { audio: boolean; video: boolean }) {
    if (!this.room) return;
    const audioTrack = this.localStream?.getAudioTracks()[0];
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (audioTrack) audioTrack.enabled = enabled.audio;
    if (videoTrack) videoTrack.enabled = enabled.video;
    await this.room.updateStream(CAMERA_STREAM_KEY, {
      audio: enabled.audio ? audioTrack : undefined,
      video: enabled.video ? videoTrack : undefined,
    });
    this.emitRoomState(this.room.getState());
  }

  async switchDevices(deviceIds: { audioInputId?: string; videoInputId?: string }) {
    const constraints: MediaStreamConstraints = {
      audio: deviceIds.audioInputId ? { deviceId: { exact: deviceIds.audioInputId } } : true,
      video: deviceIds.videoInputId ? { deviceId: { exact: deviceIds.videoInputId } } : true,
    };
    const next = await navigator.mediaDevices.getUserMedia(constraints);
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
    }
    this.localStream = next;
    if (this.room) {
      await this.room.updateStream(CAMERA_STREAM_KEY, {
        audio: next.getAudioTracks()[0],
        video: next.getVideoTracks()[0],
      });
      this.emitRoomState(this.room.getState());
    }
    return next;
  }

  async startScreenShare() {
    if (!this.room) throw new Error("Not connected");
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = this.screenStream.getVideoTracks()[0];
    track.onended = () => {
      void this.stopScreenShare();
    };
    await this.room.addStream(SCREEN_STREAM_KEY, { video: track });
    this.emitRoomState(this.room.getState());
  }

  async stopScreenShare() {
    if (!this.room) return;
    await this.room.removeStream(SCREEN_STREAM_KEY);
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    this.emitRoomState(this.room.getState());
  }

  async sendChatMessage(text: string) {
    if (!this.room) return;
    await this.room.sendMessage({ type: "text", payload: text });
  }

  async refreshToken(clientToken: string) {
    if (!this.room) return;
    traceVideoPipeline({
      layer: "video-client",
      step: "refresh_token",
      outcome: "ok",
      roomId: this.options.roomId,
    });
    await this.room.updateClientToken(clientToken);
  }

  async disconnect() {
    if (this.room) {
      await this.room.disconnect().catch(() => undefined);
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.subscriptionKeys.clear();
    this.room = null;
    this.localStream = null;
    this.screenStream = null;
    this.options.onStateChange?.("disconnected");
  }

  static async createPreviewStream(video: boolean, audio: boolean): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({ video, audio });
  }
}
