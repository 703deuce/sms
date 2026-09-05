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
  onRemoteParticipantJoined?: (participantId: string, state: State) => void;
  onRemoteParticipantLeft?: (participantId: string, state: State) => void;
  onMessage?: (participantId: string, message: Message) => void;
  onNetworkMetrics?: (metrics: NetworkMetrics) => void;
  onKicked?: () => void;
};

export type DeviceLists = {
  audioinput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
};

const CAMERA_STREAM_KEY = "camera";
const SCREEN_STREAM_KEY = "screen";

export class TransovoVideoClient {
  private room: Room | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private unsubscribers: Array<() => void> = [];

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
    this.options.onStateChange?.("connecting");
    this.room = await initialize({
      roomId: this.options.roomId,
      clientToken: this.options.clientToken,
      context: this.options.context,
      enableMessages: true,
    });

    this.bindRoomEvents(this.room);
    await this.room.connect();
    return this.room;
  }

  getRoom(): Room | null {
    return this.room;
  }

  getState(): State | null {
    return this.room?.getState() ?? null;
  }

  private bindRoomEvents(room: Room) {
    const on = <E extends keyof Events>(event: E, cb: Events[E]) => {
      this.unsubscribers.push(room.on(event, cb));
    };

    on("state_changed", (state) => {
      if (state.status === "connected") this.options.onStateChange?.("connected");
      else if (state.status === "connecting") this.options.onStateChange?.("connecting");
      else if (state.status === "disconnected") this.options.onStateChange?.("disconnected");
    });

    on("connected", () => this.options.onStateChange?.("connected"));
    on("disconnected", () => this.options.onStateChange?.("disconnected"));
    on("participant_joined", (id, state) => this.options.onRemoteParticipantJoined?.(id, state));
    on("participant_left", (id, state) => this.options.onRemoteParticipantLeft?.(id, state));
    on("participant_leaving", (_id, reason) => {
      if (reason === "kicked") this.options.onKicked?.();
    });
    on("message_received", (participantId, message) => {
      this.options.onMessage?.(participantId, message);
    });
    on("network_metrics_report", (metrics) => this.options.onNetworkMetrics?.(metrics));
  }

  async publishCameraMicrophone(enabled: { audio: boolean; video: boolean }) {
    if (!this.room) throw new Error("Not connected");
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
  }

  async stopScreenShare() {
    if (!this.room) return;
    await this.room.removeStream(SCREEN_STREAM_KEY);
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
  }

  async sendChatMessage(text: string) {
    if (!this.room) return;
    await this.room.sendMessage({ type: "text", payload: text });
  }

  async refreshToken(clientToken: string) {
    if (!this.room) return;
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
    this.room = null;
    this.localStream = null;
    this.screenStream = null;
    this.options.onStateChange?.("disconnected");
  }

  static async createPreviewStream(video: boolean, audio: boolean): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({ video, audio });
  }
}

export { CAMERA_STREAM_KEY, SCREEN_STREAM_KEY };
