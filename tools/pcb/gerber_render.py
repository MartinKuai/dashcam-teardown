"""Minimal RS-274X renderer for the EasyEDA gerbers of TinyVision.

usage: python -I gerber_render.py <gerber> <out.png> <px_per_mm> <xmin> <ymin> <xmax> <ymax> [mirror] [nopour] [vias]
"""
import math
import re
import sys

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
PPM = float(sys.argv[3])
XMIN, YMIN, XMAX, YMAX = map(float, sys.argv[4:8])
MIRROR = "mirror" in sys.argv[8:]
NO_POUR = "nopour" in sys.argv[8:]
VIAS_ONLY = "vias" in sys.argv[8:]
section = ""
SS = 2  # supersampling
S = PPM * SS
W = int((XMAX - XMIN) * S)
H = int((YMAX - YMIN) * S)
img = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(img)


def P(x, y):
    px = (x - XMIN) * S
    if MIRROR:
        px = W - px
    return (px, (YMAX - y) * S)


text = open(src, encoding="utf-8", errors="ignore").read()
# Split into blocks; keep %...% extended blocks together.
tokens = []
for m in re.finditer(r"%([^%]*)%|([^%*]+)\*", text):
    if m.group(1) is not None:
        for part in m.group(1).split("*"):
            if part.strip():
                tokens.append(("ext", part.strip()))
    else:
        t = m.group(2).strip()
        if t:
            tokens.append(("cmd", t))

dec = 3
apertures = {}
ap = None
mode = "G01"
x = y = 0.0
region = False
contours = []
cur = []
fill = 255


def num(s):
    return int(s) / 10**dec


def arc_pts(x0, y0, x1, y1, i, j, cw):
    cx, cy = x0 + i, y0 + j
    r = math.hypot(x0 - cx, y0 - cy)
    a0 = math.atan2(y0 - cy, x0 - cx)
    a1 = math.atan2(y1 - cy, x1 - cx)
    if cw:
        while a1 >= a0:
            a1 -= 2 * math.pi
    else:
        while a1 <= a0:
            a1 += 2 * math.pi
    if abs(x0 - x1) < 1e-9 and abs(y0 - y1) < 1e-9:
        a1 = a0 + (-2 * math.pi if cw else 2 * math.pi)
    n = max(8, int(abs(a1 - a0) * r * S / 3))
    return [(cx + r * math.cos(a0 + (a1 - a0) * k / n), cy + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(1, n + 1)]


def stroke(pts, w):
    w_px = max(1, w * S)
    q = [P(*p) for p in pts]
    d.line(q, fill=fill, width=int(round(w_px)), joint="curve")
    rr = w_px / 2
    for px, py in (q[0], q[-1]):
        d.ellipse((px - rr, py - rr, px + rr, py + rr), fill=fill)


def flash(a, fx, fy):
    kind, prm = a
    cx, cy = P(fx, fy)
    if kind == "C":
        r = prm[0] * S / 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)
    elif kind == "R":
        w, h = prm[0] * S / 2, prm[1] * S / 2
        d.rectangle((cx - w, cy - h, cx + w, cy + h), fill=fill)
    elif kind == "O":
        w, h = prm[0], prm[1]
        if w > h:
            stroke([(fx - (w - h) / 2, fy), (fx + (w - h) / 2, fy)], h)
        else:
            stroke([(fx, fy - (h - w) / 2), (fx, fy + (h - w) / 2)], w)
    elif kind == "Oval":
        width, x1, y1, x2, y2 = prm[:5]
        stroke([(fx + x1, fy + y1), (fx + x2, fy + y2)], width)


for kind, t in tokens:
    if kind == "ext":
        if t.startswith("FS"):
            dec = int(re.search(r"X(\d)(\d)", t).group(2))
        elif t.startswith("AD"):
            m = re.match(r"ADD(\d+)([A-Za-z]+),?(.*)", t)
            if m:
                prm = [float(v) for v in m.group(3).split("X") if v]
                apertures[int(m.group(1))] = (m.group(2), prm)
        elif t == "LPC":
            fill = 0
        elif t == "LPD":
            fill = 255
        continue
    if t.startswith("G04"):
        m = re.match(r"G04 (\w+) Start", t)
        if m:
            section = m.group(1)
        continue
    if NO_POUR and section in ("Copper", "PolygonModel"):
        continue
    if VIAS_ONLY and section != "Via":
        continue
    m = re.match(r"G(\d+)", t)
    if m:
        g = int(m.group(1))
        if g in (1, 2, 3):
            mode = f"G0{g}"
        elif g == 36:
            region, contours, cur = True, [], []
            continue
        elif g == 37:
            if len(cur) > 2:
                contours.append(cur)
            for c in contours:
                d.polygon([P(*p) for p in c], fill=fill)
            region, contours, cur = False, [], []
            continue
        elif g == 54:
            pass
        t = t[m.end():]
    m = re.match(r"D(\d+)$", t)
    if m and int(m.group(1)) >= 10:
        ap = apertures.get(int(m.group(1)))
        continue
    m = re.match(r"(?:X(-?\d+))?(?:Y(-?\d+))?(?:I(-?\d+))?(?:J(-?\d+))?D0?([123])$", t)
    if not m:
        continue
    nx = num(m.group(1)) if m.group(1) else x
    ny = num(m.group(2)) if m.group(2) else y
    i = num(m.group(3)) if m.group(3) else 0
    j = num(m.group(4)) if m.group(4) else 0
    op = int(m.group(5))
    if op == 1:
        pts = [(nx, ny)] if mode == "G01" else arc_pts(x, y, nx, ny, i, j, mode == "G02")
        if region:
            if not cur:
                cur = [(x, y)]
            cur.extend(pts)
        elif ap:
            if ap[0] == "C":
                stroke([(x, y)] + pts, ap[1][0])
            elif ap[0] == "R":
                stroke([(x, y)] + pts, min(ap[1][:2]))
    elif op == 2:
        if region and len(cur) > 2:
            contours.append(cur)
        cur = []
    elif op == 3 and ap:
        flash(ap, nx, ny)
    x, y = nx, ny

img = img.resize((W // SS, H // SS), Image.LANCZOS)
img.save(out)
print(out, img.size)
