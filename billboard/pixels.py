# image -> W x H RGB json (rows top to bottom): python pixels.py in.jpg W H out.json
import sys, json
from PIL import Image
src, W, H, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
im = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
px = list(im.getdata())
json.dump({'W': W, 'H': H, 'px': [list(p) for p in px]}, open(out, 'w'))
