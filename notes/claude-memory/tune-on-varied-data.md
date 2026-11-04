---
name: tune-on-varied-data
description: Audio/media tuning must use many varied clips, never one video; reloads must not break playing media
metadata:
  type: feedback
---
When tuning media audio (heightmap2brz presets), score across many varied clips (speech, music, mixed, several videos), not one video or one segment.

**Why:** owner 2026-10-11: "dont tune it specifically to the one video", "you need more data". Also owner noticed videos lost audio while I kept reloading the media plugin (init wiped tmp/ under playing videos).

**How to apply:** build a clip set first (several sources, random segments), average scores per preset; keep reloads rare while players are watching, and never delete files a running session uses. See [[omegga-bridge]].
