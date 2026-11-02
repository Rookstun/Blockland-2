# A picture hung on the map in a gold-encrusted frame (2026-11-02, owner: "place this image in the map and give it a
# gold encrusted frame"). The image is halved, quantized to an adaptive palette and laid as one 2x2-unit micro brick
# per pixel in a vertical wall facing -y (runs of one colour merged along each row); round it a stepped gold frame:
# three moulding steps of metallic gold, a darker inner lip, and jewels (glowing ruby / sapphire / emerald studs)
# every 40 along it, with rosettes at the corners. Bottom of the frame at z Z.
#   python mapgen/framedpic.py IMAGE CX Y Z out.json [scale=2] [colours=28]
import json, sys
from PIL import Image

img, CX, Y, Z, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
scale = int(sys.argv[6]) if len(sys.argv) > 6 else 2
ncol = int(sys.argv[7]) if len(sys.argv) > 7 else 28
im = Image.open(img).convert('RGB')
im = im.resize((im.width // scale, im.height // scale), Image.LANCZOS).quantize(colors=ncol, method=Image.Quantize.MAXCOVERAGE).convert('RGB')
W, H, P = im.width, im.height, 2           # pixels -> 2-unit cells
F = 24                                     # frame width
x0 = CX - (W * P) // 2
x0 -= x0 % 2
zb = Z + F                                 # picture bottom
bricks = []
def box(ax, ay, az, bx, by, bz, color, **m):
    assert (bx - ax) % 2 == 0 and (by - ay) % 2 == 0 and (bz - az) % 2 == 0, (ax, ay, az, bx, by, bz)
    bricks.append({'asset': 'PB_DefaultMicroBrick', 'size': [(bx - ax) // 2, (by - ay) // 2, (bz - az) // 2],
                   'position': [(ax + bx) // 2, (ay + by) // 2, (az + bz) // 2], 'color': list(color), **m})
px = im.load()
for j in range(H):
    z = zb + (H - 1 - j) * P
    i = 0
    while i < W:
        c = px[i, j]; e = i
        while e + 1 < W and px[e + 1, j] == c: e += 1
        box(x0 + i * P, Y - 2, z, x0 + (e + 1) * P, Y, z + P, c)
        i = e + 1
# backing board behind the picture
x1, z1 = x0 + W * P, zb + H * P
box(x0, Y, zb, x1, Y + 4, z1, (40, 30, 24))
GOLD = [(212, 168, 60), (232, 190, 80), (190, 146, 44)]
MET = {'material': 'BMC_Metallic', 'material_intensity': 8}
def ring(o, inset, depth0, depth1, color, **m):
    # a rectangular ring o..inset outside the picture, from y Y-depth1 to Y-depth0
    ax, bx, az, bz = x0 - o, x1 + o, zb - o, z1 + o
    ix, jx, iz, jz = x0 - inset, x1 + inset, zb - inset, z1 + inset
    box(ax, Y - depth1, az, bx, Y - depth0, iz, color, **m)          # bottom
    box(ax, Y - depth1, jz, bx, Y - depth0, bz, color, **m)          # top
    box(ax, Y - depth1, iz, ix, Y - depth0, jz, color, **m)          # left
    box(jx, Y - depth1, iz, bx, Y - depth0, jz, color, **m)          # right
ring(4, 0, -4, 4, (120, 84, 24), **MET)          # dark inner lip, flush to proud 4
ring(12, 4, -4, 8, GOLD[2], **MET)               # inner moulding
ring(20, 12, -4, 12, GOLD[0], **MET)             # middle (proudest)
ring(F, 20, -4, 6, GOLD[1], **MET)               # outer bevel
# jewels on the middle moulding: alternating ruby / sapphire / emerald, every 40, plus corner rosettes
JEWELS = [(220, 30, 50), (40, 90, 230), (30, 190, 90)]
GLOW = {'material': 'BMC_Glow', 'material_intensity': 3}
k = 0
mid = 16
for x in range(x0 - 8, x1 + 8, 40):
    for zz in (zb - mid, z1 + mid - 4):
        box(x - 2, Y - 14, zz - 2 + 2, x + 2, Y - 12, zz + 2 + 2, JEWELS[k % 3], **GLOW); k += 1
for z in range(zb + 12, z1 - 4, 40):
    for xx in (x0 - mid, x1 + mid - 4):
        box(xx - 2 + 2, Y - 14, z - 2, xx + 2 + 2, Y - 12, z + 2, JEWELS[k % 3], **GLOW); k += 1
for cx, cz in ((x0 - 12, zb - 12), (x1 + 12, zb - 12), (x0 - 12, z1 + 12), (x1 + 12, z1 + 12)):
    box(cx - 8, Y - 16, cz - 8, cx + 8, Y - 12, cz + 8, (244, 206, 96), **MET)
    box(cx - 4, Y - 18, cz - 4, cx + 4, Y - 16, cz + 4, (230, 30, 60), **GLOW)
# two gold legs so it stands on the ground
for lx in (x0 + 20, x1 - 24):
    box(lx, Y - 6, Z - (Z - 0) if Z > 0 else Z, lx + 4, Y + 6, Z, GOLD[2], **MET) if Z > 0 else None
json.dump(bricks, open(out, 'w'))
print(f'{W}x{H} px, {len(bricks)} bricks, picture x {x0}..{x1} z {zb}..{z1}', file=sys.stderr)
