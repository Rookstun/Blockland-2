"""Live puppet: webcam pose -> the Brickadia doll (puppet/gen.mjs), one entity per body part.

  python puppet/track.py              webcam 0, 10 fps to the server
  python puppet/track.py --cam 1      another camera
  python puppet/track.py --demo       no camera: the doll waves (checks the game side)
  python puppet/track.py --dry        print frames, send nothing

Pipeline: MediaPipe pose (world landmarks) -> bone directions -> forward kinematics on the doll's own
rest pivots (rig.json, so parts never come apart) -> 18 digits a part -> ssh tunnel -> bridge plugin
(port 7790) -> `/pup` chat command -> dispatcher chip -> pup.<i> global events -> each part's chip
SetLocationRotations its grid. Needs: pip install mediapipe opencv-python; ssh key for pzedlo.
"""
import argparse, json, math, os, socket, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RIG = json.load(open(os.path.join(HERE, 'rig.json')))
PARTS = RIG['parts']
IDX = {p['name']: i for i, p in enumerate(PARTS)}
MODEL = os.path.join(HERE, 'pose_landmarker_full.task')
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'
HOST, PORT = 'pzedlo.hopto.org', 7790

# ---- tiny vector maths (brick coords: x forward, y right, z up) ----
def sub(a, b): return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
def add(a, b): return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
def mid(a, b): return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def norm(a):
    n = math.sqrt(dot(a, a)) or 1e-9
    return [a[0] / n, a[1] / n, a[2] / n]
def scale(a, s): return [a[0] * s, a[1] * s, a[2] * s]
# matrices are lists of 3 COLUMNS (images of the x, y, z axes)
def mv(M, v): return [M[0][k] * v[0] + M[1][k] * v[1] + M[2][k] * v[2] for k in range(3)]
def mm(A, B): return [mv(A, B[0]), mv(A, B[1]), mv(A, B[2])]
I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

def frame(right, up):
    """rotation whose y axis = right, z axis = up (orthonormalised)"""
    y = norm(right)
    z = norm(sub(up, scale(y, dot(up, y))))
    return [cross(y, z), y, z]

def arc(a, b):
    """shortest rotation taking unit a to unit b (Rodrigues)"""
    v, c = cross(a, b), dot(a, b)
    if c < -0.9999:  # opposite: turn 180 about any perpendicular
        p = norm(cross(a, [0, 0, 1] if abs(a[2]) < 0.9 else [1, 0, 0]))
        return [sub(scale(scale(p, 2), p[k]), I3[k]) for k in range(3)]
    k = 1 / (1 + c)
    def col(e):  # R e = e + v x e + k v x (v x e)
        ve = cross(v, e)
        return add(add(e, ve), scale(cross(v, ve), k))
    return [col(I3[0]), col(I3[1]), col(I3[2])]

def rotator(M):
    """matrix -> Unreal rotator (pitch, yaw, roll) in degrees (FMatrix::Rotator)"""
    X, Y, Z = M
    pitch = math.atan2(X[2], math.hypot(X[0], X[1]))
    yaw = math.atan2(X[1], X[0])
    sy = [-math.sin(yaw), math.cos(yaw), 0]
    roll = math.atan2(dot(Z, sy), dot(Y, sy))
    return [math.degrees(pitch), math.degrees(yaw), math.degrees(roll)]

def from_rotator(p, y, r):
    p, y, r = map(math.radians, (p, y, r))
    SP, CP, SY, CY, SR, CR = math.sin(p), math.cos(p), math.sin(y), math.cos(y), math.sin(r), math.cos(r)
    return [[CP * CY, CP * SY, SP], [SR * SP * CY - CR * SY, SR * SP * SY + CR * CY, -SR * CP],
            [-(CR * SP * CY + SR * SY), CY * SR - CR * SP * SY, CR * CP]]

# ---- pose -> part transforms ----
LM = dict(nose=0, l_ear=7, r_ear=8, l_sh=11, r_sh=12, l_elb=13, r_elb=14, l_wr=15, r_wr=16, l_pinky=17, r_pinky=18,
          l_index=19, r_index=20, l_hip=23, r_hip=24, l_knee=25, r_knee=26, l_ank=27, r_ank=28, l_heel=29, r_heel=30,
          l_toe=31, r_toe=32)

def to_brick(p):
    # MediaPipe world: x image-right, y down, z away from camera; person faces the camera = doll faces +x
    return [-p[2], -p[0], -p[1]]

def solve(P):
    """P: name -> brick-space point. Returns per part (pivot, rotation matrix), FK on the rig's rest pivots."""
    hip, sh = mid(P['l_hip'], P['r_hip']), mid(P['l_sh'], P['r_sh'])
    up = sub(sh, hip)
    rot = {'pelvis': frame(sub(P['r_hip'], P['l_hip']), up), 'chest': frame(sub(P['r_sh'], P['l_sh']), up)}
    rot['torso'] = frame(add(rot['pelvis'][1], rot['chest'][1]), up)
    ears = mid(P['l_ear'], P['r_ear'])
    bone = {'neck': sub(ears, sh)}
    for s in 'lr':
        bone[s + '_arm'] = sub(P[s + '_elb'], P[s + '_sh'])
        bone[s + '_forearm'] = sub(P[s + '_wr'], P[s + '_elb'])
        bone[s + '_hand'] = sub(mid(P[s + '_index'], P[s + '_pinky']), P[s + '_wr'])
        bone[s + '_leg'] = sub(P[s + '_knee'], P[s + '_hip'])
        bone[s + '_shin'] = sub(P[s + '_ank'], P[s + '_knee'])
        bone[s + '_foot'] = sub(P[s + '_toe'], P[s + '_heel'])
    out = {}
    for part in PARTS:  # parents come first in rig.json
        n, par = part['name'], part['parent']
        R0 = out[par][1] if par else I3
        if n == 'head':
            fwd = sub(P['nose'], ears)
            right = norm(sub(P['r_ear'], P['l_ear']))
            x = norm(sub(fwd, scale(right, dot(fwd, right))))
            R = [x, right, cross(x, right)]
        elif n in rot:
            R = rot[n]
        else:
            R = mm(arc(norm(mv(R0, part['dir'])), norm(bone[n])), R0)
        piv = part['pivot'] if not par else add(out[par][0], mv(R0, sub(part['pivot'], PARTS[IDX[par]]['pivot'])))
        out[n] = (piv, R)
    return out

def encode(sol):
    s = ''
    for part in PARTS:
        piv, R = sol[part['name']]
        s += ''.join('%03d' % max(0, min(999, round(v) + 500)) for v in piv)
        s += ''.join('%03d' % ((round(a) + 180) % 360) for a in rotator(R))  # -180..179 +180
    return s

# ---- a synthetic body in brick coords (rest = the doll's T pose), for --demo and the self-check ----
def body(t=None):
    B = dict(l_hip=[0, -5, 22], r_hip=[0, 5, 22], l_sh=[0, -8, 39], r_sh=[0, 8, 39], l_ear=[0, -5, 48], r_ear=[0, 5, 48],
             nose=[5, 0, 48], l_knee=[0, -5, 12], r_knee=[0, 5, 12], l_ank=[0, -5, 2], r_ank=[0, 5, 2],
             l_heel=[-3, -5, 1], r_heel=[-3, 5, 1], l_toe=[7, -5, 1], r_toe=[7, 5, 1])
    for s, sg in (('l', -1), ('r', 1)):
        B[s + '_elb'] = [0, sg * 18, 39]; B[s + '_wr'] = [0, sg * 28, 39]
        B[s + '_index'] = [1, sg * 34, 39]; B[s + '_pinky'] = [-1, sg * 34, 39]
    if t is not None:  # wave: right arm up and down, forearm swinging, a knee bend
        a = math.sin(t * 3) * 0.9
        B['r_elb'] = add(B['r_sh'], [0, 10 * math.cos(a), 10 * math.sin(a)])
        b = a + math.sin(t * 6) * 0.8
        B['r_wr'] = add(B['r_elb'], [0, 10 * math.cos(b), 10 * math.sin(b)])
        hd = norm(sub(B['r_wr'], B['r_elb']))
        B['r_index'] = add(B['r_wr'], add(scale(hd, 6), [1, 0, 0])); B['r_pinky'] = add(B['r_wr'], add(scale(hd, 6), [-1, 0, 0]))
        k = max(0, math.sin(t * 2)) * 0.7
        B['l_ank'] = add(B['l_knee'], [-10 * math.sin(k), 0, -10 * math.cos(k)])
        B['l_heel'] = add(B['l_ank'], [-3, 0, -1]); B['l_toe'] = add(B['l_ank'], [7, 0, -1])
    return B

def selfcheck():
    for r in ((10, 20, 30), (-40, 170, -80), (89, 0, 0)):
        M, back = from_rotator(*r), from_rotator(*rotator(from_rotator(*r)))
        assert all(abs(M[i][k] - back[i][k]) < 1e-6 for i in range(3) for k in range(3)), r
    sol = solve(body())
    for part in PARTS:  # the rest pose must give the doll's rest pivots and no rotation
        piv, R = sol[part['name']]
        assert all(abs(a - b) < 1e-6 for a, b in zip(piv, part['pivot'])), (part['name'], piv)
        assert all(abs(R[i][k] - I3[i][k]) < 1e-6 for i in range(3) for k in range(3)), part['name']
    assert len(encode(sol)) == 18 * len(PARTS)

# ---- transport ----
class Feed:
    def __init__(self):
        self.tunnel = subprocess.Popen(['ssh', '-N', '-o', 'ExitOnForwardFailure=yes', '-L', f'{PORT}:127.0.0.1:{PORT}', HOST])
        for _ in range(50):
            try:
                self.sock = socket.create_connection(('127.0.0.1', PORT), timeout=2)
                return
            except OSError:
                if self.tunnel.poll() is not None: sys.exit('ssh tunnel failed (is port 7790 busy locally, or the ssh key missing?)')
                time.sleep(0.2)
        sys.exit('no connection to the bridge feed (bridge plugin reloaded with the puppet listener?)')
    def send(self, line): self.sock.sendall((line + '\n').encode())
    def close(self):
        self.sock.close(); self.tunnel.terminate()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cam', type=int, default=0)
    ap.add_argument('--fps', type=float, default=10)
    ap.add_argument('--smooth', type=float, default=0.5, help='0 = raw, 0.9 = very smooth')
    ap.add_argument('--demo', action='store_true')
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    selfcheck()
    feed = None if a.dry else Feed()
    dt = 1 / a.fps
    try:
        if a.demo:
            t0 = time.time()
            while True:
                line = encode(solve(body(time.time() - t0)))
                feed.send(line) if feed else print(line)
                time.sleep(dt)
        import cv2, mediapipe as mp
        from mediapipe.tasks.python import BaseOptions, vision
        if not os.path.exists(MODEL):
            print('downloading the pose model (~9 MB) from Google ...'); urllib.request.urlretrieve(MODEL_URL, MODEL)
        lm = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO))
        cap = cv2.VideoCapture(a.cam)
        if not cap.isOpened(): sys.exit(f'camera {a.cam} did not open')
        rig_h = PARTS[IDX['head']]['pivot'][2] + 10  # doll height (head top), units
        P, last, t0 = None, 0, time.time()
        print('tracking: q in the camera window to stop')
        while True:
            ok, img = cap.read()
            if not ok: break
            res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int((time.time() - t0) * 1000))
            if res.pose_world_landmarks:
                w = res.pose_world_landmarks[0]
                raw = {k: scale(to_brick([w[i].x, w[i].y, w[i].z]), rig_h / 1.7) for k, i in LM.items()}  # ~1.7 m person -> doll
                P = raw if P is None else {k: add(scale(P[k], a.smooth), scale(raw[k], 1 - a.smooth)) for k in raw}
                for p in res.pose_landmarks[0]:
                    cv2.circle(img, (int(p.x * img.shape[1]), int(p.y * img.shape[0])), 3, (0, 255, 0), -1)
                if time.time() - last >= dt:
                    last = time.time()
                    line = encode(solve(P))
                    feed.send(line) if feed else print(line)
            cv2.imshow('puppet (q quits)', img)
            if cv2.waitKey(1) & 0xFF == ord('q'): break
    except KeyboardInterrupt:
        pass
    finally:
        if feed: feed.close()

if __name__ == '__main__':
    main()
