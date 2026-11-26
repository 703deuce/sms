---
name: lab-video-media
description: Media gathering for a film from scratch: real footage and photos of the real subject from any site, source order by what gives the best footage, yt-dlp sections around the moment, conform, upscale cap, sources log; real-clip share is a target, not a gate.
when_to_use: Opened at the media stage of a film from scratch (video-stage media).
page_line: Media stage: best real footage from any site, cut clean moments, hide player UI and logos, conform, 1.5x upscale cap, sources log.
attach_roles: stage
---

# Media (stage 3)

**Real footage and real photos of the actual subject are the backbone of any researched film**; designed graphics,
type and 3D sit on top. A mostly invented world only when the subject truly has no real imagery. Gather lean: only
what the script needs.

## Where (pick whatever gives the best footage)
Any site: YouTube (`ytdl`), X (`x-read`, full-archive search with videos; reposts of old moments too), news and
outlet players, Dailymotion, Internet Archive (strong for older TV), TikTok/Instagram/Facebook, official pages
(`readpage`), the `footage` tool, Wikimedia Commons (`$CS/scripts/fetch_commons.py search "<query>"` then
`get --project <dir>`). Search for the specific person, place, date or object the line names; stock only for truly
generic lines.

## Clips
- Find the moment from captions where available, otherwise by scrubbing; download that section plus padding:
  `ytdl ... --download-sections "*START-END"` (or `yt-dlp` directly).
- Choose the moment by performance (eyes, voice, energy), not by transcript; keep a whole thought (setup, turn,
  landing), and prefer the stretch where the picture proves the point.
- Cut on a clean phrase or musical boundary, ~6-10 s around what the line is about.
- Hide player UI, channel bugs and burned-in logos in frame (crop, frame or cover on purpose); prefer a source
  without burned-in lower thirds when an equally good one exists.
- Talking clips keep their audio (narration pauses, music ducks); music-bed clips stay muted (`lab-video-voice`).
- Conform: `ffmpeg -i in -vf "scale=W:H:force_original_aspect_ratio=increase,crop=W:H,fps=30" -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -ar 48000 out.mp4`
- Real-subject films: aim for real clips on about half the runtime. A target, never a gate: if footage doesn't
  exist, cover the beat with photos, a quoted card or graphics, and note it.

## Photos and documents
Image search, news and press photos, official sites, social posts, video frame grabs (no player UI or logo
visible). Use the best, most specific image. Never upscale past ~1.5x in the final frame; small sources go small in
the world. Code-drawn UI instead of screenshots for app interfaces; label recreations; quote only words really
written. AI stills or clips only as labelled illustration, never as evidence or as a real person or event.

## Log
`research/sources.md`: every source searched and what it returned, every clip and photo URL with its time range
and credit, and the footage/photo share. No licensing checks or caveats.
