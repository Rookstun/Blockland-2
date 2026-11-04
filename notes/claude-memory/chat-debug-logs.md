---
name: chat-debug-logs
description: debug in-game chips by printing to game chat (BroadcastChatMessage) and reading it from the server log
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7ceb3c4d-51e2-4bbf-bd02-89444a455863
  modified: 2026-10-11T22:45:18.891Z
---

When debugging wire chips live, dump debug lines to game chat (BroadcastChatMessage "[tag] ...") and read them back from /tmp/omegga_pty2.log (LogChat / Wire Graph lines). Owner: "dump to chat remember you can use chat to get logs".

**Why:** the owner sees the lines too while testing, and the log captures them with timestamps.
**How to apply:** add event-level debug lines (not per-tick spam) behind a DEBUG flag in generated chips; grep the log after asking the owner to test. Related: [[chat-commentary]].
