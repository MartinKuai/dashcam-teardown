"""Bottom-side copper for the main board: a GND pour with the same vias as the top.

usage: python -I back_copper.py <vias.png> <out_dir>
`vias.png` is compose_copper.py's output for the vias-only renders ("_via" suffix), in
top-view coordinates at 32 px/mm. Writes, in bottom-view coordinates (mirrored in x):
  pcb-back-copper.png  white, alpha = copper under the mask
  pcb-back-holes.png   white, alpha = drilled via holes
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
PPM = 32

vias = Image.open(src).point(lambda v: 255 if v > 128 else 0)
vias = vias.transpose(Image.FLIP_LEFT_RIGHT)  # seen from the bottom, x runs the other way
W, H = vias.size

# Pour: whole board, pulled back 0.5 mm from the edge as a fab would.
pour = np.zeros((H, W), np.uint8)
inset = int(0.5 * PPM)
pour[inset:H - inset, inset:W - inset] = 255

# 0.2 mm clearance around every via, then the via annulus itself. Blur + threshold keeps
# the grown and shrunk shapes round (a square Max/Min filter makes octagons).
soft = np.asarray(vias.filter(ImageFilter.GaussianBlur(4)))
pour[soft > 12] = 0
pour[np.asarray(vias) > 0] = 255

# Drill: the via pad shrunk to roughly the 0.3 mm hole.
holes = np.where(np.asarray(vias.filter(ImageFilter.GaussianBlur(3))) > 200, 255, 0)


def save(alpha, name):
    a = np.asarray(alpha, np.uint8)
    rgba = np.dstack([np.full_like(a, 255)] * 3 + [a])
    Image.fromarray(rgba, "RGBA").save(f"{out}/{name}", optimize=True)
    print(name, a.shape)


save(pour, "pcb-back-copper.png")
save(holes, "pcb-back-holes.png")
