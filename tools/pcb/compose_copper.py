"""Compose TinyVision copper layers into one 67 x 38 mm board texture.

usage: python -I compose_copper.py <gerber_out_dir> <out.png> [suffix]
`suffix` picks another render of the same layers, e.g. "_via" for vias only.
Rendered layers are 32 px/mm over x, y in [-2.5, 33] mm (1136 px square).
"""
import sys

import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
SUFFIX = sys.argv[3] if len(sys.argv) > 3 else ""
PPM = 32
W, H = int(67 * PPM), int(38 * PPM)
canvas = np.zeros((H, W), np.float32)


def load(name):
    return np.asarray(Image.open(f"{src}/{name}"), np.float32) / 255


layers = {k: load(f"{k}{SUFFIX}_32.png") for k in ("TopLayer", "InnerLayer1", "InnerLayer2", "BottomLayer")}
layers["BottomMirror"] = load(f"BottomLayer{SUFFIX}_32m.png")


def feather(h, w, f):
    ry = np.clip(np.minimum(np.arange(h), np.arange(h)[::-1]) / f, 0, 1)
    rx = np.clip(np.minimum(np.arange(w), np.arange(w)[::-1]) / f, 0, 1)
    return np.outer(ry, rx)


def paste(layer, crop, dst, f=24, rot=0):
    """crop = (left, top, right, bottom) in layer px; dst = (left, top) in canvas px."""
    l, t, r, b = crop
    tile = layers[layer][t:b, l:r]
    tile = np.rot90(tile, rot)
    h, w = tile.shape
    x0, y0 = dst
    cx0, cy0 = max(0, x0), max(0, y0)
    cx1, cy1 = min(W, x0 + w), min(H, y0 + h)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    a = feather(h, w, f)
    part = tile[cy0 - y0 : cy1 - y0, cx0 - x0 : cx1 - x0] * a[cy0 - y0 : cy1 - y0, cx0 - x0 : cx1 - x0]
    canvas[cy0:cy1, cx0:cx1] = np.maximum(canvas[cy0:cy1, cx0:cx1], part)


# A: V851S fan-out from the bottom layer, mirrored so the QFN lands on our SoC.
# QFN centre in the mirrored layer: (708, 590) px. Our SoC: (-5.5, 2) mm -> (896, 544) px.
paste("BottomMirror", (176, 176, 912, 816), (896 - (708 - 176), 544 - (590 - 176)), f=12)
# Left column (power section).
paste("InnerLayer2", (180, 150, 600, 1000), (-30, -20), f=16)
paste("InnerLayer1", (500, 640, 920, 1000), (-30, 820), f=16)
# Above and below the SoC tile.
paste("TopLayer", (180, 860, 960, 1060), (340, -60), f=16)
paste("BottomLayer", (180, 790, 960, 1060), (340, 760), f=16)
paste("InnerLayer2", (560, 640, 1000, 900), (340, 1010), f=16)
paste("InnerLayer1", (180, 860, 560, 1060), (760, 1010), f=16)
# Right of the SoC: storage, connectors, buttons.
paste("TopLayer", (180, 120, 1000, 900), (1080, -20), f=16)
paste("InnerLayer1", (180, 520, 1000, 1000), (1080, 760), f=16)
# Far right strip.
paste("InnerLayer2", (180, 150, 470, 1000), (1880, -20), f=16)
paste("BottomLayer", (700, 600, 990, 1000), (1880, 820), f=16)

Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8)).save(out)
print(out, canvas.shape)
