# Applies a map delta to the live world (no live regens: diffs only).
#   python3 deltadeploy.py DEPLOY.json [--skip-clear] [--start N]
# DEPLOY.json = { clear: [[x, y, z, hx, hy, hz]...], add: [bricks], externalAssets }
#   clear: one ClearRegion per removed brick (its world box + 1: only bricks
#   entirely inside go), in batches; then every add in ONE bricks op with the
#   map owner (the owner's rule), through the bridge inbox with a long wait.
import json, os, re, subprocess, sys, time
D = json.load(open(sys.argv[1]))
TOOLS = "/home/max/omegga-server/bridge/tools"
BRIDGE = "/home/max/omegga-server/bridge"
OWNER = {"id": "891c4675-d18a-4ce1-a465-f4193ffe8b39", "name": "abysmal garbage"}
QUOTE = '<size="40"><color="ff4040"><b>"I DONT CARE IF THE FUCKIN SERVER CRASHES JUST DO IT ALL AT ONCE"</></></>'


LOG = "/tmp/omegga_pty2.log"
DONE = re.compile(rb"LogBrickCommands: (Cleared [0-9,]+ bricks|No bricks to clear)")


def done_count():
    # ClearRegions the game has actually run (the bridge only queues them, ~340/s)
    with open(LOG, "rb") as f:
        return len(DONE.findall(f.read()))


def job(ops, wait=900):
    jid = f"{int(time.time() * 1000)}_delta.json"
    with open(f"{BRIDGE}/inbox/{jid}.tmp", "w") as f:
        json.dump({"ops": ops}, f)
    os.rename(f"{BRIDGE}/inbox/{jid}.tmp", f"{BRIDGE}/inbox/{jid}")
    out, t0 = f"{BRIDGE}/outbox/{jid}", time.time()
    while not os.path.exists(out):
        if time.time() - t0 > wait:
            raise SystemExit(f"timeout waiting for {jid}")
        time.sleep(1)
    time.sleep(0.5)
    res = json.load(open(out))
    os.remove(out)
    return res


if "--skip-clear" not in sys.argv:
    B = 1500
    start = int(sys.argv[sys.argv.index("--start") + 1]) if "--start" in sys.argv else 0
    base, sent = done_count(), 0
    for i in range(start, len(D["clear"]), B):
        ops = [{"op": "cmd", "line": f"br.World.ClearRegion {x} {y} {z} {a} {b} {c}"} for x, y, z, a, b, c in D["clear"][i:i + B]]
        job(ops, wait=120)
        sent += len(ops)
        while done_count() - base < sent - B:  # keep at most one batch queued
            time.sleep(1)
        print(f"cleared {min(i + B, len(D['clear']))}/{len(D['clear'])}", flush=True)
    while done_count() - base < sent:  # the whole queue has run before the load
        time.sleep(2)
# (owner 2026-10-13: "stop announcing changes") no chat line before the load
res = job([{"op": "bricks", "at": [0, 0, 0], "owner": OWNER, "captureMs": 20000, "externalAssets": D.get("externalAssets", []), "bricks": D["add"]}])
r = res["results"][-1]
log = r.get("log", []) if isinstance(r, dict) else []
print("loaded", r.get("count") if isinstance(r, dict) else r, "| overlap lines:", sum("overlapping" in l for l in log))
for l in log:
    if "overlap" in l or "rror" in l:
        print(" ", l[:200])
