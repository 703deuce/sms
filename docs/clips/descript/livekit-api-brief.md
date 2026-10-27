# Transovo Remote Recording on LiveKit Cloud: Implementation Brief

**Audience:** the coding agent implementing remote recording in the Transovo Next.js 16 / React 19 app (App Router, Prisma, Supabase Postgres, deployed on Coolify).
**Sources:** official LiveKit docs (docs.livekit.io, fetched as `.md` on 2026-10-26) and source code from `livekit/client-sdk-js`, `livekit/components-js` and `livekit/node-sdks`. The old `livekit/server-sdk-js` repo now lives in that monorepo at `packages/livekit-server-sdk`. All three repos were shallow-cloned on 2026-10-26. Every LiveKit API below has a citation. Anything that isn't a LiveKit API (browser, MDN or Backblaze) is labelled.

> **Rule for the implementer:** don't add LiveKit calls that aren't in this brief without checking the cited page first. The docs site moved recently. Old `/home/...` URLs redirect to `/intro/...`, `/frontends/...` and `/transport/...`. Use the URLs listed here.

## 0. Pinned versions

The versions below come from `npm view` on 2026-10-26 and match the `package.json` files in each repo's `main` branch.

| Package | Version | Where it runs |
|---|---|---|
| `livekit-client` | **2.23.0** | browser |
| `@livekit/components-react` | **2.9.24** | browser. Peer deps: `livekit-client`, `react >=18`, `react-dom >=18`, `tslib` |
| `@livekit/components-styles` | **1.2.0** | browser (CSS) |
| `livekit-server-sdk` | **2.19.2** | Node only. Route handlers must use `runtime = 'nodejs'` |

```bash
npm i livekit-client@2.23.0 @livekit/components-react@2.9.24 @livekit/components-styles@1.2.0 livekit-server-sdk@2.19.2
```

Install command source: https://docs.livekit.io/reference/components/react/installation.md

Pin exact versions with no `^`. `livekit-client` 2.x ships experimental "extensions" internals, such as the RPC extension in `src/room/rpc/extension.ts`. The public `Room` API is the stable surface we depend on.

---

## 1. Account and project setup

1. Create a LiveKit Cloud project in the dashboard at https://cloud.livekit.io. The CLI docs say: "To create a LiveKit Cloud project, use the LiveKit Cloud dashboard" (https://docs.livekit.io/reference/developer-tools/livekit-cli/projects.md).
2. **LIVEKIT_URL** is the project's WebSocket URL, `wss://<project-subdomain>.livekit.cloud`. It's shown as **Project URL** on the Project Settings page, https://cloud.livekit.io/projects/p_/settings/project (https://docs.livekit.io/intro/basics/connect.md#connect-to-a-room).
3. **LIVEKIT_API_KEY / LIVEKIT_API_SECRET** come from the project's API keys in the dashboard. Alternatively, run `lk cloud auth` to link the project, then `lk app env` to print or write them (`-w` writes to `.env.local`). Both commands are documented at https://docs.livekit.io/reference/developer-tools/livekit-cli/projects.md#app-env.
   - Revoking a CLI authorization also revokes the keys it minted, so production keys should be created in the dashboard, not by `lk cloud auth`.
4. **Webhooks:** go to Cloud dashboard → Settings → Webhooks. Add `https://<app>/api/recording/livekit/webhook` and choose the API key that signs the requests. The page has a "Send a test event" button (https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events.md).

### Env contract (Coolify — **already provisioned** on Transovo `new-app`)

**Clips recording** uses **LiveKit Cloud only** — existing Coolify `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (project **`sms-6w01zoya.livekit.cloud`**). Do **not** add `NEXT_PUBLIC_*` LiveKit vars. Do **not** use `LIVEKIT_SELF_HOSTED_*` or `voice.transovo.ai` for recording rooms, tokens, webhooks, or egress. Implemented in `new-app/lib/server/livekit/recording-room-service.ts`.

```dotenv
LIVEKIT_URL=wss://sms-6w01zoya.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Browser clients receive **`url`** from a server token route (`getLiveKitPublicUrl()`), not from a public env var.

- `LiveKitAPI` and `RoomServiceClient` read `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` from env when no arguments are passed. `LIVEKIT_TOKEN` is an alternative. Server clients rewrite a `wss://` host to `https://` themselves (`TwirpRPC.ts`: `host.replace('ws','http')`).
  - Sources: https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/src/LiveKitAPI.ts and https://github.com/livekit/node-sdks/tree/main/packages/livekit-server-sdk
- **Never log secrets.** Check this in code review:
  - `lib/server/livekit/env.ts` validates the vars with zod at boot and exports only a frozen object. Nothing should log or `JSON.stringify` it.
  - Don't log minted JWTs or the webhook `Authorization` header.
  - Error logs should contain `ServerError.code` and `ServerError.message` only. `ServerError` is exported by `livekit-server-sdk` (`src/index.ts`).
  - Don't use `NEXT_PUBLIC_` for the key or the secret.

---

## 2. Server (`livekit-server-sdk` 2.19.2, Node runtime)

### 2.1 Minting tokens: `AccessToken` + `VideoGrant`

Docs: https://docs.livekit.io/frontends/reference/tokens-grants.md (same content at https://docs.livekit.io/frontends/authentication/tokens.md) and https://docs.livekit.io/frontends/build/authentication/custom.md

**`VideoGrant` fields:**
- `roomCreate`, `roomList`, `roomJoin`, `roomAdmin`, `roomRecord`, `ingressAdmin`
- `room`, `canPublish`, `canSubscribe`, `canPublishData`
- `canPublishSources` (camera, microphone, screen_share, screen_share_audio)
- `canUpdateOwnMetadata`, `hidden`, `kind`, `destinationRoom`

**Token facts from the docs:**
- **Don't put PII in `identity` or the room name.** They show up in LiveKit logs and traces, and PII redaction doesn't remove them. Use UUIDs.
- Expiry is checked **only at the initial connect**. While connected, the server refreshes the client's token every 5 min. A refreshed token is valid for 10 min, or the original's remaining lifetime if that's shorter. Reconnects use the refreshed token.
- On Cloud, `RemoveParticipant` and `UpdateParticipant` revoke tokens for 10 min, so short TTLs combined with removal make a kick stick. The Node SDK's default TTL is 6 h. **We use `ttl: '10m'`.**
- The JWT can carry `metadata` and `attributes`. A participant can't change these unless it has `canUpdateOwnMetadata`.

**AccessToken source** (`src/AccessToken.ts`): the constructor options are `{ identity, name, ttl (number seconds | string), metadata, attributes }`, and `toJwt()` is async in v2.

```ts
// lib/server/livekit/tokens.ts
import 'server-only';
import { AccessToken, TrackSource, type VideoGrant } from 'livekit-server-sdk';
import { env } from './env';

export type StudioRole = 'host' | 'guest';

export async function mintJoinToken(opts: {
  roomName: string;          // = RecordingSession.livekitRoom (UUID-based, no PII)
  identity: string;          // = RecordingParticipant.id (UUID)
  displayName: string;       // shown in tiles; goes in `name`, not identity
  role: StudioRole;
  sessionId: string;
}) {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.displayName,
    ttl: '10m',                                   // initial-connect window only; server auto-refreshes
    attributes: { role: opts.role, sessionId: opts.sessionId }, // server-set, client can't edit
  });
  const grant: VideoGrant = {
    roomJoin: true,
    room: opts.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,                          // needed for rec-control packets + RPC
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE,
                        TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
    canUpdateOwnMetadata: false,                   // roles/attributes stay server-controlled
    // NEVER put roomAdmin/roomCreate/roomList in a browser token; host powers go through our API.
  };
  at.addGrant(grant);
  return at.toJwt();                               // async in v2
}
```

**Host vs guest**

Both roles get the same media grants. The differences are handled by **our** API:

- **Host:**
  - Authenticated by a Supabase session and owns the `RecordingSession`.
  - Can call `/api/recording/sessions/:id/{start,stop,kick,end}`. Those routes run server-side with `RoomServiceClient`.
  - Gets `attributes.role = 'host'`. Clients use this attribute to decide who is the clock master and who sends rec-control.
- **Guest:**
  - No account. The invite link carries an opaque, single-use, expiring `inviteToken` (our own, hashed in the DB).
  - `POST /api/recording/join` exchanges it for a `RecordingParticipant` row and a 10-minute LiveKit JWT.
  - If the guest's browser reloads, it calls the same endpoint again with a participant-bound resume cookie. It must keep the **same identity**: a duplicate identity kicks the older connection (https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants.md).
- **TTL:** `10m` for both roles. A page that sits on PreJoin for more than 10 minutes must fetch a new token before `connect()`. Use `TokenSource.custom` or just fetch on submit.

### 2.2 Room creation and naming: `RoomServiceClient` (via `LiveKitAPI`)

Docs: https://docs.livekit.io/intro/basics/rooms-participants-tracks/rooms.md
Source: `src/RoomServiceClient.ts`, where `CreateOptions` = `{ name, emptyTimeout?, departureTimeout?, maxParticipants?, metadata?, egress?, minPlayoutDelay?, maxPlayoutDelay?, ... }`.

```ts
// lib/server/livekit/client.ts
import 'server-only';
import { LiveKitAPI } from 'livekit-server-sdk';
export const lk = new LiveKitAPI();            // reads LIVEKIT_URL / KEY / SECRET from env
// lk.room is a RoomServiceClient
```

```ts
// lib/server/livekit/rooms.ts
export const roomNameFor = (sessionId: string) => `rec_${sessionId}`; // UUID, no PII

export async function ensureRoom(sessionId: string, maxParticipants: number) {
  return lk.room.createRoom({
    name: roomNameFor(sessionId),
    emptyTimeout: 30 * 60,          // seconds to keep the room open BEFORE anyone joins (host may wait in green room)
    departureTimeout: 120,          // seconds to keep it open AFTER the last participant leaves (rejoin grace)
    // semantics per CreateOptions JSDoc in src/RoomServiceClient.ts
    maxParticipants,                // host + invited guests (+1 slack for reconnect races)
    metadata: JSON.stringify({ v: 1, recState: 'idle' }), // see §4.6
  });
}
```

- Rooms are also auto-created on first join (https://docs.livekit.io/intro/basics/connect.md). We still call `createRoom` explicitly when the host opens the studio, so that `maxParticipants` and the timeouts are set.
- Other calls:
  - `lk.room.listRooms([names])` (rooms.md)
  - `lk.room.updateRoomMetadata(room, metadata)` (`RoomServiceClient.ts`, https://docs.livekit.io/transport/data/state/room-metadata.md)

### 2.3 Removing a participant and ending a room

Docs: https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants.md and rooms.md.

```ts
// Kick a guest (host action). On Cloud this also revokes their token (~10 min).
await lk.room.removeParticipant(roomName, identity);            // needs roomAdmin -> server key has it
// options?: { revokeTokenTs?: bigint }  (RemoveParticipantOptions in RoomServiceClient.ts)

// Demote without kicking (e.g. stop a guest's screen share): revoking canPublish unpublishes their tracks
await lk.room.updateParticipant(roomName, identity, {
  permission: { canPublish: false, canSubscribe: true, canPublishData: true },
});

await lk.room.mutePublishedTrack(roomName, identity, trackSid, true);
const people = await lk.room.listParticipants(roomName);       // ParticipantInfo[] (joinedAt, identity, ...)
const p = await lk.room.getParticipant(roomName, identity);

// End the session for everyone: disconnects all participants (Disconnected reason ROOM_DELETED)
await lk.room.deleteRoom(roomName);
```

**End-of-session order:**
1. Host clicks End.
2. Send `rec-control: stop` (§4.6).
3. Wait until every participant reports `finalized` or 20 s pass.
4. Call `deleteRoom`.
5. Mark the session `ENDED`.

`deleteRoom` doesn't affect uploads. Each browser keeps uploading from IndexedDB after the call ends (§6.3).

Errors: catch `ServerError` (exported from `livekit-server-sdk`, `src/TwirpRPC.ts`) and log only `code` and `message`.

---

## 3. Webhooks

Docs: https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events.md
SDK: `WebhookReceiver`, `src/WebhookReceiver.ts` and the README at https://github.com/livekit/node-sdks/tree/main/packages/livekit-server-sdk

**Delivery:**
- Requests are `POST` with `Content-Type: application/webhook+json`.
- The `Authorization` header holds a JWT signed with the API key you chose. The JWT includes a sha256 of the body.
- `receiver.receive(body, authHeader, skipAuth=false, clockTolerance?)` verifies the JWT, then compares the sha256 against the **raw** body string. Don't parse the JSON first.
- Delivery is retried several times, and queued events arrive in order. **Delivery isn't guaranteed**, so there must be a reconciliation job.
- Every event has `id` (UUID), `createdAt` (unix seconds; `bigint` in the SDK's protobuf type, so wrap it in `Number(...)`) and `event`.

```ts
// app/api/recording/livekit/webhook/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { WebhookReceiver } from 'livekit-server-sdk';
import { env } from '@/lib/server/livekit/env';
import { handleLivekitEvent } from '@/lib/server/livekit/webhooks';

const receiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

export async function POST(req: Request) {
  const raw = await req.text();                                  // raw body, required for sha256 check
  const auth = req.headers.get('authorization') ?? undefined;
  let event;
  try {
    event = await receiver.receive(raw, auth);                   // async in v2
  } catch {
    return new Response('invalid signature', { status: 401 });   // do NOT log header/body
  }
  await handleLivekitEvent(event);                               // idempotent on event.id
  return new Response('ok');
}
```

### Events we consume

Payloads are described in webhooks-events.md, and the `room` / `participant` shapes in https://docs.livekit.io/reference/other/roomservice-api.md.

| Event | When it fires (from the docs) | Payload | Transovo action |
|---|---|---|---|
| `room_started` | First participant joins an empty room | `room` | `RecordingSession.livekitRoomSid = room.sid`, `liveStartedAt = createdAt` |
| `room_finished` | Room closes: `deleteRoom`, or the last participant left and the timeout expired (docs say "empty timeout"; in CreateOptions this is `departureTimeout`) | `room` | Close any open participant intervals at `createdAt`, set `liveEndedAt`, and enqueue the "assemble take" job once uploads finish |
| `participant_joined` | Participant becomes **active** (media connected); same as SDK `ParticipantActive` | `room`, `participant` | Open a `RecordingParticipantInterval {joinedAt}`, set `participant.livekitSid`, set `status=LIVE` |
| `participant_left` | Participant left, after cleanup | `room`, `participant` | Close the open interval `{leftAt}` and add the seconds to the bill |
| `participant_connection_aborted` | Signal connected but media failed | `room`, `participant` | Flag a connectivity problem (show the host a "guest can't connect: firewall?" hint, §6.5) |
| `track_published` | Track published. `room`/`participant` carry only sid, name and identity | `room`, `participant`, `track` | Record that the live track exists (diagnostics only; the **authoritative** track list is our own `RecordingTrack` rows from the browser) |

**Rules for session state:**
- Store `event.id` in `LivekitWebhookEvent` with a unique index, and ignore duplicates.
- Process events per room in `createdAt` order.
- A full client reconnection looks like *leave + rejoin* (https://docs.livekit.io/intro/basics/connect.md#network-changes-and-reconnection). So a participant can have **several intervals**. Never treat `participant_left` as "the guest quit for good".

**Billing (participant-minutes):**
- LiveKit Cloud meters WebRTC participant time per second, with a **10 s minimum per WebRTC session**. Data transfer is rounded up to 0.01 GB (https://docs.livekit.io/deploy/admin/billing.md).
- Our internal meter is `Σ_intervals max(10, leftAt − joinedAt)` seconds per participant. Report it as `ceil(sum/60)` minutes on the `RecordingSession`.
- This is an estimate of our LiveKit cost and the basis for plan limits ("N studio minutes/month"). The truth is the LiveKit dashboard and the invoice.
- **Reconciliation cron** (every 15 min): for sessions marked live with no webhook for more than 15 min, call `lk.room.listRooms([name])`. If the room is gone, close the open intervals at `now` and set the session to ended.

---

## 4. Client (`livekit-client` 2.23.0 + `@livekit/components-react` 2.9.24)

### 4.1 Which React wrapper

- `<LiveKitRoom>` is still exported and marked `@public` (`components-js/packages/react/src/components/LiveKitRoom.tsx`).
  - Props: `serverUrl`, `token`, `connect`, `audio`, `video`, `screen`, `options` (RoomOptions; **ignored if you pass `room`**), `room`, `connectOptions`, `onConnected`, `onDisconnected(reason)`, `onError`, `onMediaDeviceFailure`, `onEncryptionError`.
  - It renders `RoomContext.Provider`.
  - Docs: https://docs.livekit.io/reference/components/react/component/livekitroom.md
- The newer `useSession(tokenSource)` + `<SessionProvider>` pattern is what the components-js Next.js examples now use (`examples/nextjs/pages/simple.tsx`). It's tagged **`@beta`** in `hooks/useSession.ts` and is oriented toward agent apps.
  - Docs: https://docs.livekit.io/reference/components/react/hook/usesession.md and https://docs.livekit.io/reference/components/react/component/sessionprovider.md
- **Decision:** create our own `Room` instance and provide it with `<RoomContext.Provider value={room}>` (https://docs.livekit.io/reference/components/react/component/roomcontext.md).
  - We need to own capture and publishing (§4.3), so we don't want LiveKitRoom's `audio`/`video` auto-publish.
  - It also gives full control over `RoomOptions` and the event listeners.
  - Use `<LiveKitRoom room={room} connect={false}>` only if we want its error-callback plumbing.

Prefab components we use (docs at `https://docs.livekit.io/reference/components/react/component/<name>.md`):

| Component | Use | Notes from docs/source |
|---|---|---|
| `PreJoin` | Green room: name, camera and mic preview, device pick | **Must not be nested inside LiveKitRoom.** Props: `onSubmit(LocalUserChoices)`, `defaults`, `persistUserChoices`, `onValidate`, `onError`, `joinLabel`, `videoProcessor`. `LocalUserChoices = {videoEnabled, audioEnabled, videoDeviceId, audioDeviceId, username}` (`components-js/packages/core/src/persistent-storage/user-choices.ts`). It creates its own preview tracks and stops them on unmount, so start our own capture *after* submit using the chosen deviceIds. |
| `VideoConference` | Prototype only (M1) | Drop-in prefab: focus layout, paginated grid, basic chat, screen share. Built from `FocusContextProvider`, `GridLayout`, `ControlBar`, `FocusLayout`. Props: `chatMessageEncoder/Decoder/Formatter`, `SettingsComponent`. |
| `GridLayout` + `ParticipantTile` + `useTracks` | Production studio grid | `useTracks([{source: Track.Source.Camera, withPlaceholder: true}, {source: Track.Source.ScreenShare, withPlaceholder: false}])`, then `<GridLayout tracks={tracks}><ParticipantTile/></GridLayout>`. Tiles use `Track.attach()`, so adaptive stream works. |
| `ControlBar` | Leave and screen share only | Props: `controls: {microphone, camera, chat, screenShare, leave, settings}`, `variation`, `saveUserChoices`, `onDeviceError`. **Its camera/mic buttons include a `MediaDeviceMenu` that calls `room.switchActiveDevice`**, which would swap the live device without touching our recorder. Render `controls={{camera:false, microphone:false, chat:false, settings:false, screenShare:false, leave:true}}` and use our own toggles and device selects (§4.4). |
| `MediaDeviceSelect` / `useMediaDeviceSelect` | Device lists | `useMediaDeviceSelect({kind})` returns `{devices, activeDeviceId, setActiveMediaDevice}`. We use only `devices` and route the change through our capture manager (§4.4). |
| `RoomAudioRenderer` | Plays remote audio | Required when not using `VideoConference`. Seen in `examples/nextjs/pages/simple.tsx`. |

Styles: `import '@livekit/components-styles';` and put `data-lk-theme="default"` on the root element (installation.md).

### 4.2 Room options

Docs:
- https://docs.livekit.io/transport/media/advanced.md (presets, simulcast layers, dynacast, codecs)
- https://docs.livekit.io/transport/media/subscribe.md#adaptive-stream
- client-sdk-js README (https://github.com/livekit/client-sdk-js#readme): `adaptiveStream`, `dynacast`, `videoCaptureDefaults`, `prepareConnection`

Option names are confirmed in `src/options.ts`: `adaptiveStream`, `dynacast`, `videoCaptureDefaults`, `publishDefaults`, `stopLocalTrackOnUnpublish`, `disconnectOnPageLeave`.

```ts
// components/recording/useStudioRoom.ts
import { Room, VideoPresets, AudioPresets, RoomEvent } from 'livekit-client';

export const LIVE_VIDEO = VideoPresets.h720;   // 1280x720, 1.7 Mbps, 30 fps (src/room/track/options.ts)

export function createStudioRoom() {
  return new Room({
    adaptiveStream: { pixelDensity: 'screen', pauseVideoInBackground: true }, // or `true`
    dynacast: true,                     // stop encoding layers no one watches
    stopLocalTrackOnUnpublish: false,   // WE own the MediaStreamTracks (recorder keeps them)
    disconnectOnPageLeave: true,
    videoCaptureDefaults: { resolution: LIVE_VIDEO.resolution }, // only used if SDK captures
    publishDefaults: {
      simulcast: true,                                   // default true
      videoEncoding: LIVE_VIDEO.encoding,                // top layer bitrate/fps cap
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360], // defaults to h180,h360
      screenShareEncoding: { maxBitrate: 2_000_000, maxFramerate: 15 },
      dtx: true, red: true,                              // defaults for mono mic; RED recommended
    },
  });
}
// Pre-warm as soon as the studio page loads: room.prepareConnection(url, token)  (README)
```

**What the SDK does with these** (source: `src/room/participant/publishUtils.ts`, `computeVideoEncodings`):
- The **top simulcast layer uses the captured track's own width and height**.
- `videoEncoding` only caps *bitrate and framerate*. There's no max-resolution option (`VideoEncoding = {maxBitrate, maxFramerate?, priority?}`).
- So to cap live video at 720p, **the track we publish must be 720p**. The full-quality recording track must therefore be a different `MediaStreamTrack` (§4.3).

### 4.3 Recording at full quality while publishing 720p

**Relevant SDK facts:**
- `LocalTrack.mediaStreamTrack` returns the underlying track (or the processed track if a processor is attached), per `src/room/track/LocalTrack.ts`.
- `publishTrack(track: LocalTrack | MediaStreamTrack, options?: TrackPublishOptions)` accepts a raw `MediaStreamTrack` with `{ source: Track.Source.Camera, simulcast, name }` (README, "Publish tracks from any source"; https://docs.livekit.io/transport/media/publish.md).
- Tracks passed in this way are **user-provided**. The SDK then:
  - doesn't stop the camera on mute (`LocalVideoTrack.mute`: `if (source === Camera && !this.isUserProvided) stop()`)
  - doesn't reacquire it after mobile backgrounding (`LocalTrack.handleAppVisibilityChanged`)
  - doesn't auto-switch devices when the device list changes (`CoreRoom` skips `isUserProvided`)

  That's exactly what a recorder needs: the SDK can't swap or stop the track under MediaRecorder.

**Do we need a separate `getUserMedia`?**
- If you let the SDK capture (`setCameraEnabled`/`createLocalVideoTrack`), it captures at `videoCaptureDefaults` (720p) and may restart the track on mute, device change or mobile background. Recording `localTrack.mediaStreamTrack` would then be 720p and could change identity mid-take. **Don't.**
- **Do this instead:** one app-owned `getUserMedia` at full quality, then `clone()` + `applyConstraints()` to get a 720p copy for publishing.
  - [Browser/MDN, not LiveKit] https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/clone and https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints
  - One camera open, two tracks. Chromium scales clones independently.
- At runtime, check `live.getSettings().height <= 720 && rec.getSettings().height > 720`. If a browser can't scale the clone independently, fall back to publishing the full-res track with `videoEncoding` bitrate-capped at 1.7 Mbps (resolution not capped, bandwidth capped), and log `capture.fallback`. The M2 test covers Chrome, Safari and Firefox.

```ts
// components/recording/capture.ts  (browser)
import { Track, type Room, type LocalTrackPublication } from 'livekit-client';

export async function startCapture(room: Room, choices: { videoDeviceId: string; audioDeviceId: string }) {
  const cam = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: choices.videoDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
  });
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: choices.audioDeviceId }, echoCancellation: true, noiseSuppression: true,
             autoGainControl: true, channelCount: 1, sampleRate: 48000 },
  });
  const recVideo = cam.getVideoTracks()[0];          // FULL quality -> MediaRecorder
  const recAudio = mic.getAudioTracks()[0];          // same track is both recorded and published (see §6.2)

  const liveVideo = recVideo.clone();                // 720p copy -> LiveKit
  await liveVideo.applyConstraints({ width: 1280, height: 720, frameRate: 30 });

  const camPub = await room.localParticipant.publishTrack(liveVideo, {
    source: Track.Source.Camera, simulcast: true, name: 'camera',
  });
  const micPub = await room.localParticipant.publishTrack(recAudio, {
    source: Track.Source.Microphone, name: 'microphone',
  });
  return { recVideo, recAudio, liveVideo, camPub, micPub };
}
// Mute in the call: camPub.mute()/unmute() (LocalTrackPublication.mute/unmute). This does NOT stop
// recVideo; decide product-wise whether "camera off" also pauses the local recording (recommended: yes,
// by setting recVideo.enabled=false so the file keeps continuous timing with black frames).
```

Record each source with its **own** `MediaRecorder`: camera video-only, mic audio-only, and screen video (plus screen audio if present). That gives separate camera, mic and screen tracks for the editor.

### 4.4 Screen share and device selection

Docs: https://docs.livekit.io/transport/media/screenshare.md
- `setScreenShareEnabled(true)`, or `localParticipant.createScreenTracks({ audio: true })` and then `publishTrack` each one. Standalone `createLocalScreenTracks` is exported from `livekit-client` (`src/exports.ts`, `src/room/video/create.ts`).
- Tab audio is only available when the user picks a browser tab.

For screen share, recording needs native resolution too. Use the same own-the-track pattern:

```ts
import { createLocalScreenTracks, Track } from 'livekit-client';
const screenTracks = await createLocalScreenTracks({ audio: true });     // LocalTrack[] (video + optional audio)
const sv = screenTracks.find(t => t.kind === Track.Kind.Video)!;
const recScreen = sv.mediaStreamTrack;                                    // record native res
const liveScreen = recScreen.clone(); await liveScreen.applyConstraints({ height: { max: 720 } });
await room.localParticipant.publishTrack(liveScreen, { source: Track.Source.ScreenShare, name: 'screen' });
// screen audio (if any): publishTrack(audioTrack.mediaStreamTrack, { source: Track.Source.ScreenShareAudio })
recScreen.addEventListener('ended', stopScreenShare);                    // browser "Stop sharing" button
```

You can also call `navigator.mediaDevices.getDisplayMedia` directly, which is equivalent. `createLocalScreenTracks` just wraps it.

**Device selection:**
- Lists: `Room.getLocalDevices('audioinput' | 'videoinput')` (README, "Device management APIs"), or `useMediaDeviceSelect({kind}).devices` (https://docs.livekit.io/reference/components/react/hook/usemediadeviceselect.md). Listen to `RoomEvent.MediaDevicesChanged` (`src/room/events.ts`).
- **Don't call `room.switchActiveDevice` on our user-provided tracks.** It calls `LocalTrack.setDeviceId`, which runs `restartTrack()` and re-captures through the SDK.
- Device change during a take:
  1. Close the current recorder segment (`stop()`, which flushes the final chunk).
  2. Run a new `getUserMedia` on the new device.
  3. Make a new `clone()` + `applyConstraints`.
  4. Call `camPub.track!.replaceTrack(newLive, true)` (`LocalTrack.replaceTrack(track, userProvidedTrack?)`).
  5. Start a new recorder segment (`RecordingTrack.segmentIndex + 1`) aligned on the host clock (§4.6).

### 4.5 Reconnection events

Docs: https://docs.livekit.io/intro/basics/connect.md#network-changes-and-reconnection and webhooks-events.md#sdk-events. Enum values are in `src/room/events.ts`: `Reconnecting='reconnecting'`, `SignalReconnecting`, `Reconnected='reconnected'`, `Disconnected='disconnected'`, `ParticipantActive`, `ConnectionQualityChanged`, `MediaDevicesChanged`, `ActiveDeviceChanged`.

How reconnection works, per the docs:
- First the SDK resumes: it reconnects the signal WebSocket and does an ICE restart. Media may pause briefly, and no `Reconnecting` event fires.
- If that fails, it does a **full reconnect**:
  1. Remote side gets `ParticipantDisconnected`.
  2. Local side gets `LocalTrackUnpublished`.
  3. `Reconnecting`.
  4. `Reconnected`.
  5. `ParticipantConnected` for everyone.
  6. Local tracks are republished, firing `LocalTrackPublished`.
- `ConnectionQuality.Lost` shows up *before* `Reconnecting` or `Disconnected`.
- `Disconnected` carries a `DisconnectReason`: `DUPLICATE_IDENTITY`, `ROOM_DELETED`, `PARTICIPANT_REMOVED`, `JOIN_FAILURE` or `ROOM_CLOSED`.

```ts
room
  .on(RoomEvent.Reconnecting, () => ui.banner('Reconnecting… your recording continues locally'))
  .on(RoomEvent.Reconnected, async () => { ui.clear(); await clockSync.resync(); await recState.reconcile(); })
  .on(RoomEvent.Disconnected, (reason) => {
    // ROOM_DELETED -> session ended by host: stop recorders (finalize), keep uploading
    // PARTICIPANT_REMOVED -> kicked: stop recorders, keep uploading what exists
    // DUPLICATE_IDENTITY -> another tab took over: stop recorders in THIS tab
    // others -> show "Rejoin" (fetch fresh token, same identity)
  })
  .on(RoomEvent.ConnectionQualityChanged, (q, p) => { /* show weak-network badge */ });
```

**The invariant:** MediaRecorders run on app-owned tracks, so **no LiveKit event stops a recording** except an explicit stop and the three terminal disconnect reasons above. Uploads keep going independently through B2 (§6.3).

### 4.6 Synchronized record start/stop and clock sync

**Docs:**
- Data packets: https://docs.livekit.io/transport/data/packets.md
  - `localParticipant.publishData(Uint8Array, { reliable, destinationIdentities, topic })` and `RoomEvent.DataReceived (payload, participant, kind, topic)`.
  - Reliable packets max out at **15 KiB**; lossy packets should stay under 1300 B.
  - Delivery is best effort, with **no server buffering for disconnected receivers**.
- RPC: https://docs.livekit.io/transport/data/rpc.md and the client-sdk-js README, "RPC".
  - `room.registerRpcMethod(method, async (data: RpcInvocationData) => string)`, where `data` has `callerIdentity`, `payload` and `responseTimeout`. The older `room.localParticipant.registerRpcMethod` forwards to the room (`src/room/rpc/legacyExtension.ts`, deprecated).
  - `room.localParticipant.performRpc({ destinationIdentity, method, payload, responseTimeout? })` returns a `Promise<string>`. The default timeout is 10 s, payloads max out at 15 KiB, and errors are `RpcError` (1500 = application error).
- Room metadata: https://docs.livekit.io/transport/data/state/room-metadata.md (limit 512 KiB, `RoomEvent.RoomMetadataChanged`). Server-set with `lk.room.updateRoomMetadata`.

**Design**

The **host browser is the clock master** (identified by `attributes.role === 'host'`).

1. **Clock sync.** Each guest runs an NTP-style exchange 8 times on join and on `Reconnected`, then every 60 s:
   ```ts
   // host
   room.registerRpcMethod('clock.now', async () => String(performance.timeOrigin + performance.now()));
   // guest
   async function sampleOffset(hostId: string) {
     const t0 = performance.timeOrigin + performance.now();
     const hostNow = Number(await room.localParticipant.performRpc({ destinationIdentity: hostId, method: 'clock.now', payload: '', responseTimeout: 2000 }));
     const t1 = performance.timeOrigin + performance.now();
     return { rtt: t1 - t0, offset: hostNow - (t0 + t1) / 2 };   // hostClock ≈ localClock + offset
   }
   // keep the offset from the sample with the minimum RTT; store it with each RecordingTrack
   ```
2. **Start.**
   1. The host clicks Record, and our API creates a `RecordingTake` (`takeId`).
   2. The server sets room metadata to `{recState:'countdown', takeId, startAtHostMs}` with `startAtHostMs = hostNow + 3500`.
   3. The host also broadcasts a reliable packet on topic `rec-control` for immediate delivery:
      ```ts
      const msg = { t: 'start', takeId, startAtHostMs };
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true, topic: 'rec-control' });
      ```
   4. Each client shows a 3-2-1 countdown and calls `recorder.start(timesliceMs)` at `startAtHostMs - offset`, scheduled with `setTimeout`, then corrected with `performance.now()`.
   5. Each client records `actualStartHostMs = localStart + offset` on its `RecordingTrack`. **The editor aligns tracks by `actualStartHostMs`, not by the countdown**, so scheduling jitter doesn't matter.
3. **Ack.**
   - Each client replies with `performRpc({destinationIdentity: host, method: 'rec.ack', payload: JSON.stringify({takeId, state:'recording'})})`, and the host UI shows a per-guest "REC" light.
   - Clients also mirror their state into our DB via `/api/recording/tracks`.
   - Nobody uses `setAttributes`, because `canUpdateOwnMetadata` is false.
4. **Stop.** Same pattern with `{t:'stop', takeId, stopAtHostMs}`. Clients stop and flush, then report `finalized` once the last chunk is in IndexedDB.
5. **Late joiners and reconnects.** Reliable packets aren't buffered, so on connect and on `Reconnected` (and on `RoomEvent.RoomMetadataChanged`), read `room.metadata`. If `recState==='recording'`, start immediately, take the current offset into account, and mark the track `lateStart=true`.

---

## 5. Limits and pricing (as of 2026-10-26)

Sources:
- https://livekit.com/pricing (fetched as https://livekit.io/pricing.md)
- https://docs.livekit.io/deploy/admin/quotas-and-limits.md
- https://docs.livekit.io/deploy/admin/billing.md

| | **Build** (free) | **Ship** | **Scale** |
|---|---|---|---|
| Price | $0 | from **$50/mo** | from **$500/mo** |
| WebRTC participant minutes included | 5,000 (hard cap) | 150,000, then **$0.0005/min** | 1.5M, then **$0.0004/min** |
| Concurrent connections | 100 | 1,000 | 5,000 |
| Downstream data included | 50 GB (hard cap) | 250 GB, then **$0.12/GB** | 3 TB, then **$0.10/GB** |
| Egress/transcode minutes | 2 concurrent egress | 600 | 8,000 |
| Other | — | — | Region pinning, HIPAA |

**Other limits:**
- Build: 2 concurrent ingress and 2 concurrent egress. Free-plan allowances are hard caps.
- Subscription limit: 100 video + 100 audio tracks per participant.
- Server API rate limit: **1,000 requests/min**. Don't call `listParticipants` in a hot loop; use webhooks.
- Egress files are limited to 3 h. That doesn't matter here, because we don't use Egress: recording is local.
- Metering: per second, **10 s minimum per WebRTC session**; data rounded up to 0.01 GB.

**Cost model for one session** (example: 4 people × 60 min):
- 240 participant-minutes ≈ $0.12 of overage on Ship.
- Downstream: each participant receives about 3 × ~0.5–1.7 Mbps. Adaptive stream and small tiles keep this near the h360 layer (≈0.45 Mbps × 3 ≈ 1.35 Mbps, ≈ 0.6 GB/participant/hour), so roughly 2.4 GB for the session.
- **Downstream GB, not minutes, is the bigger cost driver.** Keep the 720p cap and adaptive stream.
- Start on **Ship**. Revisit Scale at sustained traffic above ~1M min/mo or above 2.5 TB/mo.

---

## 6. Pitfalls

### 6.1 MediaRecorder codecs (Safari vs Chromium/Firefox) [Browser/MDN]

- Never hardcode a codec string. Pick one at runtime with `MediaRecorder.isTypeSupported()` (https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static):
  ```ts
  const VIDEO = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4;codecs=avc1.640028', 'video/mp4'];
  const AUDIO = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  const pick = (l: string[]) => l.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
  new MediaRecorder(stream, { mimeType: pick(VIDEO), videoBitsPerSecond: 8_000_000 });  // ~8 Mbps 1080p
  new MediaRecorder(micStream, { mimeType: pick(AUDIO), audioBitsPerSecond: 256_000 });
  ```
- Typically Chromium and Firefox produce WebM (VP8/VP9 + Opus), while Safari produces MP4 (H.264 + AAC).
- Store `mimeType` on every `RecordingTrack`.
- The post-processing worker (ffmpeg) normalizes to one mezzanine format before the editor and Deepgram.
- Timeslice chunks are **not independently playable**. Only the first chunk carries the container header. Concatenate chunks in order (by `seq`) before decoding, and never transcode a single chunk. For fragmented MP4 on Safari, also verify that concatenation produces a valid file (M2 test).

### 6.2 Echo cancellation and sample rate [Browser/MDN]

- Guests often use laptop speakers, so the **live** mic needs `echoCancellation: true` (https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation). Without it, remote voices bleed into each local recording.
- Recording that same processed track is the safe default.
- Offer a "Studio mode (wearing headphones)" toggle that captures with `echoCancellation:false, noiseSuppression:false, autoGainControl:false`. It records cleaner raw audio and also publishes it.
  - LiveKit's hi-fi guidance (https://docs.livekit.io/transport/media/advanced.md) uses `createLocalAudioTrack({ channelCount: 2, echoCancellation: false, noiseSuppression: false })` and publishes with `{ audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: false }`. The max audio bitrate is 510 kbps.
  - For us, mono and `AudioPresets.speech`-class quality is enough live. The recording is what matters.
- Ask for `sampleRate: 48000`. Opus is always 48 kHz internally, but the device may deliver 44.1 kHz, and Safari/AAC may follow the device rate. Read `track.getSettings().sampleRate`, store it on `RecordingTrack`, and resample to 48 kHz in post before multitrack alignment and Deepgram.

### 6.3 Memory for long recordings: chunks must never stay in RAM [Browser/MDN]

- Call `recorder.start(5000)`, with a timeslice of 5–10 s (https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start).
- In `ondataavailable` (https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event):
  1. Immediately `put` `{takeId, trackId, seq, blob, size, createdAtHostMs}` into IndexedDB.
  2. Drop the reference.
  3. Enqueue the upload.
- Never `push` chunks into an array.
- Upload worker:
  1. Gets presigned **multipart** part URLs from `/api/recording/uploads/:trackId/parts` (B2 S3-compatible API: https://www.backblaze.com/docs/cloud-storage-s3-compatible-api).
  2. PUTs each part and saves the returned `ETag` per part in IndexedDB and the server.
  3. Deletes the IndexedDB row only after the server confirms the part.
  4. On reload, resumes from IndexedDB, idempotent on `(trackId, seq)`.
  5. After stop plus the last part, the server calls `CompleteMultipartUpload`.
- **Part sizing:** S3 multipart parts must be ≥ 5 MiB except the last, but a 5 s chunk can be smaller. **Coalesce chunks into ≥ 5 MiB parts** in the upload worker by reading the rows back from IndexedDB. Never coalesce in a RAM-only buffer. Keep the `RecordingChunk` rows (seq ranges per part) so you can audit gaps.
- **B2 bucket CORS** must allow `PUT` from the app origin and **expose the `ETag` header**, or the browser can't read the ETags multipart needs (https://www.backblaze.com/docs/cloud-storage-cross-origin-resource-sharing-rules, `exposeHeaders`).
- Storage:
  - Call `navigator.storage.persist()` (https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
  - Check `navigator.storage.estimate()` before Record (https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate). 1080p at 8 Mbps ≈ 3.6 GB/h.
  - Warn below 2× the expected size.

### 6.4 Tab backgrounding [Browser/MDN + LiveKit]

- Hidden tabs throttle timers (https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).
  - MediaRecorder itself keeps recording, but **countdown timers and the upload loop slow down**.
  - Schedule the start using `performance.now()` deltas, not chained `setTimeout`s.
  - Run uploads in a Web Worker.
  - Request a Screen Wake Lock while recording (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
- LiveKit side:
  - `adaptiveStream.pauseVideoInBackground` (`src/room/track/types.ts`) pauses *incoming* video when hidden.
  - On **mobile**, the SDK reacquires SDK-owned camera tracks after backgrounding (`LocalTrack.handleAppVisibilityChanged`, `isMobile()`). Ours are user-provided, so we must listen for `recVideo.onended` / `onmute` and run the device-change flow (§4.4) to start a new segment.
  - iOS Safari may end the camera track when backgrounded. Show a "keep this tab in front" warning on mobile guests.
- `beforeunload`: warn if any IndexedDB chunks haven't been uploaded yet. `disconnectOnPageLeave: true` handles the LiveKit side (`src/options.ts`).

### 6.5 CORS, CSP and firewalls for `*.livekit.cloud`

Firewall docs (https://docs.livekit.io/deploy/admin/firewall.md):

| Host | Port / protocol | Purpose |
|---|---|---|
| `*.livekit.cloud` | TCP 443 | Signal (wss) |
| `*.turn.livekit.cloud` | TCP 443 | TURN/TLS |
| `*.host.livekit.cloud` | UDP 3478 | TURN/UDP |
| all hosts | UDP 50000–60000 | WebRTC media |
| all hosts | TCP 7881 | WebRTC over TCP |

There's also a per-region minimum hostname list (e.g. `<sub>.oashburn1a.production.livekit.cloud`). The connection fallback order is UDP → TURN/UDP → ICE/TCP → TURN/TLS, and Cloud provides TURN/TLS (https://docs.livekit.io/intro/basics/connect.md#connection-reliability).

CSP in `next.config.ts` `headers()`, per https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src:

```
connect-src 'self' wss://*.livekit.cloud https://*.livekit.cloud https://<bucket>.s3.<region>.backblazeb2.com https://s3.<region>.backblazeb2.com;
media-src 'self' blob: mediastream:;
img-src 'self' blob: data:;
worker-src 'self' blob:;
```

- WebRTC media isn't governed by CSP `connect-src`. The WebSocket signal and region-discovery HTTPS calls are.
- The webhook route needs no CORS: it's server-to-server.
- Add `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self)`.

### 6.6 Other gotchas

- **Identity reuse:** a second tab with the same identity kicks the first (`DUPLICATE_IDENTITY`). Detect it with a `BroadcastChannel` and block the second tab *before* it connects.
- **Webhook ordering:** only `room`/`participant` sid, name and identity are present on track events. Don't expect full objects.
- **No Egress.** Don't enable room composite or track egress. It costs transcode minutes and duplicates local recording.

---

## 7. Module layout, Prisma sketch and milestones

### 7.1 Module layout

```
lib/server/livekit/
  env.ts            # zod-validated LIVEKIT_URL/KEY/SECRET; never logged
  client.ts         # export const lk = new LiveKitAPI()
  tokens.ts         # mintJoinToken (AccessToken + VideoGrant, ttl 10m)
  rooms.ts          # roomNameFor, ensureRoom(createRoom), endRoom(deleteRoom), kick(removeParticipant), setRecState(updateRoomMetadata)
  webhooks.ts       # handleLivekitEvent: idempotent state machine + interval billing
  reconcile.ts      # cron: listRooms -> close stale sessions
lib/server/recording/
  b2.ts             # S3 client for B2: Create/UploadPart(presign)/Complete/AbortMultipartUpload
  sessions.ts       # create session, invites (hashed), take lifecycle
app/api/recording/
  sessions/route.ts                     # POST create (host)
  sessions/[id]/route.ts                # GET state
  sessions/[id]/invites/route.ts        # POST create invite link (host)
  sessions/[id]/token/route.ts          # POST host token
  join/route.ts                         # POST guest: inviteToken -> participant + token
  sessions/[id]/takes/route.ts          # POST start take (server sets room metadata), PATCH stop
  sessions/[id]/participants/[pid]/route.ts  # DELETE kick (removeParticipant)
  sessions/[id]/end/route.ts            # POST end (deleteRoom)
  tracks/route.ts                       # POST register RecordingTrack (mime, sampleRate, actualStartHostMs)
  uploads/[trackId]/parts/route.ts      # POST presign next part(s); PUT confirm part ETag
  uploads/[trackId]/complete/route.ts   # POST complete multipart -> enqueue assemble/transcribe
  livekit/webhook/route.ts              # WebhookReceiver
components/recording/
  StudioShell.tsx        # creates Room, RoomContext.Provider, RoomAudioRenderer, event wiring
  GreenRoom.tsx          # PreJoin (outside the room context) + storage/permission checks
  StudioGrid.tsx         # useTracks + GridLayout + ParticipantTile
  StudioControls.tsx     # own mic/cam toggles, DeviceSelect, screen share, ControlBar(leave only)
  RecordButton.tsx / Countdown.tsx / ParticipantRecLights.tsx
  capture.ts             # getUserMedia + clone/applyConstraints + publishTrack
  recorder.ts            # MediaRecorder per source, mime pick, segments
  chunkStore.ts          # IndexedDB (idb) chunk/part/ETag persistence
  uploadWorker.ts        # Web Worker: coalesce >=5MiB parts, presigned PUT, retry/backoff, resume
  clockSync.ts / recControl.ts   # RPC clock.now, rec-control packets, room metadata reconcile
```

### 7.2 Prisma models (additive only; no changes to existing models except optional back-relations)

```prisma
enum RecordingSessionStatus { DRAFT LIVE ENDED PROCESSING READY FAILED }
enum RecordingRole { HOST GUEST }
enum RecordingTrackKind { CAMERA MICROPHONE SCREEN SCREEN_AUDIO }
enum RecordingTrackStatus { RECORDING FINALIZED UPLOADING UPLOADED FAILED }

model RecordingSession {
  id               String   @id @default(uuid())
  ownerId          String                         // existing User/workspace id
  projectId        String?                        // script/editor project to attach the take to
  title            String
  livekitRoom      String   @unique               // rec_<id>
  livekitRoomSid   String?
  status           RecordingSessionStatus @default(DRAFT)
  maxParticipants  Int      @default(6)
  liveStartedAt    DateTime?
  liveEndedAt      DateTime?
  billedParticipantSeconds Int @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  participants     RecordingParticipant[]
  takes            RecordingTake[]
  invites          RecordingInvite[]
}

model RecordingInvite {
  id          String   @id @default(uuid())
  sessionId   String
  tokenHash   String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  session     RecordingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model RecordingParticipant {
  id           String   @id @default(uuid())     // == LiveKit identity
  sessionId    String
  role         RecordingRole
  displayName  String                            // goes to token `name`, never identity
  userId       String?                           // null for guests
  livekitSid   String?
  status       String   @default("INVITED")      // INVITED | LIVE | LEFT | REMOVED
  clockOffsetMs Float?
  createdAt    DateTime @default(now())
  session      RecordingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  intervals    RecordingParticipantInterval[]
  tracks       RecordingTrack[]
  @@index([sessionId])
}

model RecordingParticipantInterval {               // billing: one per join..left (reconnects => many)
  id            String   @id @default(uuid())
  participantId String
  joinedAt      DateTime
  leftAt        DateTime?
  participant   RecordingParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  @@index([participantId])
}

model RecordingTake {
  id            String   @id @default(uuid())
  sessionId     String
  index         Int
  startAtHostMs BigInt
  stopAtHostMs  BigInt?
  createdAt     DateTime @default(now())
  session       RecordingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  tracks        RecordingTrack[]
  @@unique([sessionId, index])
}

model RecordingTrack {
  id                String   @id @default(uuid())
  takeId            String
  participantId     String
  kind              RecordingTrackKind
  segmentIndex      Int      @default(0)         // new segment on device change / track end
  mimeType          String
  width             Int?
  height            Int?
  sampleRate        Int?
  actualStartHostMs BigInt                        // alignment key for the editor
  lateStart         Boolean  @default(false)
  status            RecordingTrackStatus @default(RECORDING)
  b2Key             String   @unique
  b2UploadId        String?
  totalBytes        BigInt   @default(0)
  durationMs        Int?
  take              RecordingTake @relation(fields: [takeId], references: [id], onDelete: Cascade)
  participant       RecordingParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  chunks            RecordingChunk[]
  @@unique([takeId, participantId, kind, segmentIndex])
}

model RecordingChunk {                              // one row per uploaded multipart PART
  id          String   @id @default(uuid())
  trackId     String
  partNumber  Int                                   // S3 part number (1..10000)
  seqFrom     Int                                   // first MediaRecorder chunk seq in this part
  seqTo       Int
  bytes       Int
  etag        String
  uploadedAt  DateTime @default(now())
  track       RecordingTrack @relation(fields: [trackId], references: [id], onDelete: Cascade)
  @@unique([trackId, partNumber])
}

model LivekitWebhookEvent {                         // idempotency + audit
  id         String   @id                          // event.id from LiveKit
  event      String
  roomName   String?
  createdAt  DateTime                              // from event.createdAt (unix s)
  receivedAt DateTime @default(now())
  @@index([roomName, createdAt])
}
```

### 7.3 Milestones and acceptance tests

**M0: Setup**
- [ ] `env.ts` fails fast when LIVEKIT_* are missing.
- [ ] A grep of the logs after a full test run finds no `LIVEKIT_API_SECRET` value and no `eyJ` JWT prefixes.
- [ ] Unit test: `mintJoinToken` → decode the JWT (without verifying) → `video.roomJoin=true`, `room=rec_<uuid>`, `canPublishData=true`, no `roomAdmin`, `exp - nbf ≈ 600 s`, `sub` is a UUID, and `attributes.role` is set.

**M1: Live call (VideoConference prototype)**
- [ ] The host creates a session, and `createRoom` runs with `emptyTimeout`/`maxParticipants`. `lk.room.listRooms([name])` returns it.
- [ ] A guest opens the invite in a fresh incognito window with no account, goes through PreJoin, and joins. Both see and hear each other.
- [ ] `chrome://webrtc-internals` shows the published camera at ≤1280×720 with 3 simulcast layers, and a small tile receives a lower layer (adaptive stream).
- [ ] Webhooks: `room_started`, `participant_joined` ×2, `track_published`, and after End `participant_left` + `room_finished`. Each event is stored once, and a replayed identical event is ignored.
- [ ] A forged webhook (bad signature or tampered body) returns 401.
- [ ] Kick: `removeParticipant` → the guest gets `Disconnected(PARTICIPANT_REMOVED)`, and a rejoin with the old token within 10 min fails.

**M2: Local capture and recording**
- [ ] The recorder's video track `getSettings()` reports ≥1080p (when the camera supports it), while the published track is ≤720p. This holds in Chrome, Safari and Firefox; otherwise the logged fallback applies.
- [ ] The picked `mimeType` is stored. A 10-minute take with 5 s timeslice yields about 120 chunks in IndexedDB, and the JS heap stays flat (DevTools memory snapshot before and after: under 50 MB growth).
- [ ] Concatenated chunks play in ffprobe for webm (Chromium) and mp4 (Safari).
- [ ] Screen share records at native resolution, and the browser's "Stop sharing" closes the segment cleanly.
- [ ] Switching the mic or camera mid-take produces `segmentIndex=1` with the correct `actualStartHostMs`, and the live call switches devices too.

**M3: Sync**
- [ ] Clock offset is measured with a min-RTT sample. With 3 participants, the `actualStartHostMs` spread for one take is under 100 ms on a LAN.
- [ ] Clap test: one clap captured by everyone aligns within 1 frame (33 ms) after offset alignment.
- [ ] A guest who joins mid-take starts recording from room metadata and is flagged `lateStart`.

**M4: Resilience**
- [ ] Network drop: DevTools offline for 60 s mid-take. `Reconnecting` → `Reconnected`, recording never stops, and the upload queue drains afterwards. The final file has no gaps (seq continuous).
- [ ] Tab reload mid-take: on return, unuploaded parts from IndexedDB resume, and multipart completes with the correct part count and ETags.
- [ ] Host ends the session while guests are still uploading: guests get `ROOM_DELETED`, keep uploading, and the session moves to `PROCESSING` only after all tracks are `UPLOADED`.
- [ ] Billing: a scripted session (2 people × 5 min, plus 1 forced full reconnect) gives `billedParticipantSeconds` within ±5% of the LiveKit dashboard usage, with ≥10 s per interval.

**M5: Editor handoff**
- [ ] After all uploads finish, a worker builds a multi-track take: per-participant camera, mic and screen tracks aligned by `actualStartHostMs` and resampled to 48 kHz. It's attached to the editor project, and mic tracks are sent to Deepgram.
- [ ] The CSP is enforced (not report-only) and the studio still connects. Firewall test: the host on a UDP-blocked network still connects via TURN/TLS on 443.

---

### Appendix: citation index

- Tokens and grants: https://docs.livekit.io/frontends/reference/tokens-grants.md · https://docs.livekit.io/frontends/build/authentication/custom.md
- Connect, reconnection, disconnect reasons: https://docs.livekit.io/intro/basics/connect.md
- Rooms: https://docs.livekit.io/intro/basics/rooms-participants-tracks/rooms.md · Participants: …/participants.md · Webhooks and events: …/webhooks-events.md
- RoomService API types: https://docs.livekit.io/reference/other/roomservice-api.md
- Publish: https://docs.livekit.io/transport/media/publish.md · Advanced/codecs/simulcast: https://docs.livekit.io/transport/media/advanced.md · Screen share: https://docs.livekit.io/transport/media/screenshare.md · Subscribe/adaptive stream: https://docs.livekit.io/transport/media/subscribe.md
- Data packets: https://docs.livekit.io/transport/data/packets.md · RPC: https://docs.livekit.io/transport/data/rpc.md · Text streams: https://docs.livekit.io/transport/data/text-streams.md · Room metadata: https://docs.livekit.io/transport/data/state/room-metadata.md · Attributes: https://docs.livekit.io/transport/data/state/participant-attributes.md
- React components: https://docs.livekit.io/reference/components/react/component/{livekitroom,roomcontext,videoconference,gridlayout,participanttile,controlbar,prejoin,mediadeviceselect,sessionprovider}.md · hooks: …/hook/{usetracks,usemediadeviceselect,usesession}.md · install: https://docs.livekit.io/reference/components/react/installation.md
- Quotas: https://docs.livekit.io/deploy/admin/quotas-and-limits.md · Billing: https://docs.livekit.io/deploy/admin/billing.md · Firewall: https://docs.livekit.io/deploy/admin/firewall.md · Pricing: https://livekit.com/pricing
- CLI and keys: https://docs.livekit.io/reference/developer-tools/livekit-cli/projects.md
- Source: https://github.com/livekit/client-sdk-js (README, `src/options.ts`, `src/room/events.ts`, `src/room/track/{LocalTrack,LocalVideoTrack,options}.ts`, `src/room/participant/publishUtils.ts`, `src/room/rpc/*`) · https://github.com/livekit/components-js (`packages/react/src/{components/LiveKitRoom.tsx,prefabs/ControlBar.tsx,prefabs/PreJoin.tsx,hooks/useSession.ts}`, `examples/nextjs/pages/simple.tsx`) · https://github.com/livekit/node-sdks/tree/main/packages/livekit-server-sdk (`src/{LiveKitAPI,RoomServiceClient,AccessToken,WebhookReceiver,grants}.ts`)
