import * as THREE from 'three';

// ---------- helpers ----------

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Deterministic random so the board looks the same on every load. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string) {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      }),
    );
  }
  return imageCache.get(url)!;
}

// ---------- PCB ----------

export interface Pad {
  /** Centre in board units (cm), y up. */
  x: number;
  y: number;
  w: number;
  h: number;
  round?: boolean;
}

export interface BoardArt {
  width: number;
  height: number;
  pads: Pad[];
  /** Silkscreen outlines: [x, y, w, h] centres in board units. */
  outlines: [number, number, number, number][];
  /** Silkscreen text: [text, x, y, sizeInCm]. */
  silk: [string, number, number, number?][];
  /** Traces as polylines in board units. */
  traces: { pts: [number, number][]; width: number }[];
  vias: [number, number][];
  holes: [number, number, number][];
  /** Filled silkscreen blocks (label / sticker areas): [x, y, w, h] centres. */
  blocks?: [number, number, number, number][];
}

export interface PcbOptions {
  /** Image of the copper under the mask (white, alpha = copper), aligned at PX per cm. */
  copperUrl?: string;
  /** Image of drilled holes (alpha = hole), same alignment; tented vias read as dark dots. */
  holesUrl?: string;
  /** Draw as seen from the bottom: x runs right-to-left so silkscreen reads correctly there. */
  bottom?: boolean;
}

/**
 * Colour, metalness, roughness and bump maps for a solder-masked board with ENIG pads.
 * When `copperUrl` is given, the copper under the mask comes from that image (white
 * where there is copper, aligned to the board at PX per cm) instead of `art.traces`.
 */
export function pcbMaps(art: BoardArt, opts: PcbOptions = {}) {
  const { copperUrl, holesUrl, bottom = false } = opts;
  const PX = 320;
  const W = art.width * PX;
  const H = art.height * PX;
  const color = canvas(W, H);
  const metal = canvas(W, H);
  const rough = canvas(W, H);
  const bump = canvas(W, H);
  const c = color.ctx;
  const m = metal.ctx;
  const r = rough.ctx;
  // BoxGeometry maps the -z face with u running from +x to -x, so the bottom is mirrored.
  const X = (x: number) => (bottom ? art.width / 2 - x : x + art.width / 2) * PX;
  const Y = (y: number) => (art.height / 2 - y) * PX;
  /** Canvas x of the left edge of a box centred at x (the board-space right edge when mirrored). */
  const left = (x: number, w: number) => X(bottom ? x + w / 2 : x - w / 2);
  const MASK = '#123824';
  const maps = {
    map: toTexture(color.c),
    metalnessMap: toTexture(metal.c, false),
    roughnessMap: toTexture(rough.c, false),
    bumpMap: toTexture(bump.c, false),
  };

  const draw = (copper?: HTMLImageElement, drill?: HTMLImageElement) => {
    const rand = rng(17);
    // Solder mask over FR-4.
    c.fillStyle = MASK;
    c.fillRect(0, 0, W, H);
    m.fillStyle = '#000';
    m.fillRect(0, 0, W, H);
    r.fillStyle = '#5a5a5a'; // roughness ~0.35
    r.fillRect(0, 0, W, H);
    bump.ctx.fillStyle = '#000';
    bump.ctx.fillRect(0, 0, W, H);

    if (copper) {
      // Copper shows through the mask as a lighter green and lifts the mask slightly.
      const tint = canvas(W, H);
      tint.ctx.drawImage(copper, 0, 0, W, H);
      bump.ctx.drawImage(tint.c, 0, 0);
      tint.ctx.globalCompositeOperation = 'source-in';
      tint.ctx.fillStyle = '#2b7049';
      tint.ctx.fillRect(0, 0, W, H);
      c.drawImage(tint.c, 0, 0);
      if (drill) {
        // Tented via holes: the mask dips into them, so they read as dark dots.
        const d = canvas(W, H);
        d.ctx.drawImage(drill, 0, 0, W, H);
        d.ctx.globalCompositeOperation = 'source-in';
        d.ctx.fillStyle = '#0b2116';
        d.ctx.fillRect(0, 0, W, H);
        c.drawImage(d.c, 0, 0);
        bump.ctx.globalCompositeOperation = 'destination-out';
        bump.ctx.drawImage(drill, 0, 0, W, H);
        bump.ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      // Ground pour under the mask: slightly lighter, with clearance around pads and traces.
      c.fillStyle = '#185034';
      c.fillRect(PX * 0.08, PX * 0.08, W - PX * 0.16, H - PX * 0.16);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const t of art.traces) {
        c.strokeStyle = MASK;
        c.lineWidth = (t.width + 0.03) * PX;
        c.beginPath();
        t.pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))));
        c.stroke();
      }
      // Copper traces under the mask.
      for (const t of art.traces) {
        c.strokeStyle = '#2a6e46';
        c.lineWidth = t.width * PX;
        c.beginPath();
        t.pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))));
        c.stroke();
      }
      // Tented vias.
      for (const [vx, vy] of art.vias) {
        c.beginPath();
        c.arc(X(vx), Y(vy), 0.022 * PX, 0, Math.PI * 2);
        c.fillStyle = '#2f7a4f';
        c.fill();
        c.beginPath();
        c.arc(X(vx), Y(vy), 0.009 * PX, 0, Math.PI * 2);
        c.fillStyle = '#0d2a1b';
        c.fill();
      }
    }

    // Mask clearance around each pad, then the exposed ENIG pad.
    c.fillStyle = MASK;
    for (const p of art.pads) {
      const g = 0.012 * PX;
      c.fillRect(left(p.x, p.w) - g, Y(p.y + p.h / 2) - g, p.w * PX + 2 * g, p.h * PX + 2 * g);
    }
    for (const p of art.pads) {
      const x = left(p.x, p.w);
      const y = Y(p.y + p.h / 2);
      const w = p.w * PX;
      const h = p.h * PX;
      for (const [ctx, fill] of [
        [c, '#d8b46c'],
        [m, '#ffffff'],
        [r, '#3a3a3a'],
        [bump.ctx, '#ffffff'],
      ] as const) {
        ctx.fillStyle = fill;
        if (p.round) {
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(x, y, w, h);
      }
    }

    // Plated mounting holes.
    for (const [hx, hy, hr] of art.holes) {
      for (const [ctx, ring, hole] of [
        [c, '#d8b46c', '#0b0b0b'],
        [m, '#ffffff', '#000000'],
      ] as const) {
        ctx.beginPath();
        ctx.arc(X(hx), Y(hy), (hr + 0.06) * PX, 0, Math.PI * 2);
        ctx.fillStyle = ring;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(X(hx), Y(hy), hr * PX, 0, Math.PI * 2);
        ctx.fillStyle = hole;
        ctx.fill();
      }
    }

    // Silkscreen.
    c.strokeStyle = 'rgba(236, 236, 228, 0.9)';
    c.lineWidth = 0.012 * PX;
    for (const [ox, oy, ow, oh] of art.outlines) {
      c.strokeRect(left(ox, ow), Y(oy + oh / 2), ow * PX, oh * PX);
    }
    c.fillStyle = 'rgba(236, 236, 228, 0.94)';
    for (const [bx, by, bw, bh] of art.blocks ?? []) c.fillRect(left(bx, bw), Y(by + bh / 2), bw * PX, bh * PX);
    c.fillStyle = 'rgba(236, 236, 228, 0.92)';
    c.textBaseline = 'middle';
    for (const [text, sx, sy, size = 0.07] of art.silk) {
      c.font = `600 ${size * PX}px "Arial Narrow", Arial, sans-serif`;
      c.fillText(text, X(sx), Y(sy));
    }

    // Subtle mask texture.
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = `rgba(255,255,255,${rand() * 0.025})`;
      c.fillRect(rand() * W, rand() * H, 2, 2);
    }
    for (const t of Object.values(maps)) t.needsUpdate = true;
  };

  draw();
  if (copperUrl) {
    Promise.all([loadImage(copperUrl), holesUrl ? loadImage(holesUrl) : undefined])
      .then(([copper, drill]) => draw(copper, drill))
      .catch(() => undefined);
  }
  return maps;
}

// ---------- Markings ----------

export interface MarkingSpec {
  /** Body footprint in cm, used for aspect ratio. */
  w: number;
  h: number;
  lines: { text: string; size: number; weight?: number; y: number; x?: number; align?: CanvasTextAlign }[];
  logo?: { url: string; y: number; width: number };
  pin1?: { x: number; y: number; r: number };
  body?: string;
  ink?: string;
  font?: string;
}

/**
 * Laser-style marking on an epoxy body. Sizes and positions are fractions of
 * the body height (y from top), so the same spec works at any resolution.
 */
export function markingTexture(spec: MarkingSpec) {
  const H = 1024;
  const W = Math.round((H * spec.w) / spec.h);
  const { c, ctx } = canvas(W, H);
  const tex = toTexture(c);
  const ink = spec.ink ?? 'rgba(205, 205, 200, 0.86)';

  const draw = (logo?: HTMLImageElement) => {
    ctx.fillStyle = spec.body ?? '#25262a';
    ctx.fillRect(0, 0, W, H);
    const rand = rng(W + H);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.03})`;
      ctx.fillRect(rand() * W, rand() * H, 2, 2);
    }
    if (spec.pin1) {
      ctx.beginPath();
      ctx.arc(spec.pin1.x * W, spec.pin1.y * H, spec.pin1.r * H, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
    }
    if (logo && spec.logo) {
      const lw = spec.logo.width * W;
      const lh = (lw * logo.height) / logo.width;
      ctx.globalAlpha = 0.86;
      ctx.drawImage(logo, (W - lw) / 2, spec.logo.y * H - lh / 2, lw, lh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    // Shrink every line by the same factor so the longest one fits the body,
    // keeping the marking uniform like a laser marker would.
    const family = spec.font ?? 'Arial, Helvetica, sans-serif';
    let fit = 1;
    for (const l of spec.lines) {
      ctx.font = `${l.weight ?? 500} ${l.size * H}px ${family}`;
      const width = ctx.measureText(l.text).width;
      if (width > W * 0.84) fit = Math.min(fit, (W * 0.84) / width);
    }
    for (const l of spec.lines) {
      ctx.textAlign = l.align ?? 'center';
      ctx.font = `${l.weight ?? 500} ${l.size * H * fit}px ${family}`;
      ctx.fillText(l.text, (l.x ?? 0.5) * W, l.y * H);
    }
    tex.needsUpdate = true;
  };

  draw();
  if (spec.logo) loadImage(spec.logo.url).then(draw).catch(() => undefined);
  return tex;
}

// ---------- Other surfaces ----------

/** Microphone glyph (capsule, holder, stand) centred on x, y, in the OSD's white-on-dark style. */
function micIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const shape = () => {
    ctx.beginPath();
    ctx.roundRect(-8, -24, 16, 28, 8);
    ctx.moveTo(-15, -4);
    ctx.arc(0, -4, 15, Math.PI, 0, true);
    ctx.moveTo(0, 11);
    ctx.lineTo(0, 20);
    ctx.moveTo(-9, 20);
    ctx.lineTo(9, 20);
  };
  shape();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 9;
  ctx.stroke();
  shape();
  ctx.strokeStyle = '#f6f6f2';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-8, -24, 16, 28, 8);
  ctx.fillStyle = '#f6f6f2';
  ctx.fill();
  ctx.restore();
}

/** What the 2-inch screen shows: a live recording view with the dashcam's on-screen display. */
export function screenTexture(url: string) {
  const W = 1024;
  const H = 768;
  const { c, ctx } = canvas(W, H);
  const tex = toTexture(c);

  const draw = (frame?: HTMLImageElement) => {
    if (frame) ctx.drawImage(frame, 0, 0, W, H);
    else {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#5d7ea6');
      sky.addColorStop(1, '#2a2d31');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
    }
    // On-screen display, drawn the way a cheap dashcam does it: white text with a dark edge.
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const text = (s: string, x: number, y: number, size: number, align: CanvasTextAlign = 'left') => {
      ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = align;
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.strokeText(s, x, y);
      ctx.fillStyle = '#f6f6f2';
      ctx.fillText(s, x, y);
    };
    ctx.fillStyle = '#e8321e';
    ctx.beginPath();
    ctx.arc(52, 52, 17, 0, Math.PI * 2);
    ctx.fill();
    text('REC  00:12:47', 82, 54, 38);
    text('1440P 30', W - 34, 54, 34, 'right');
    text('2026/10/17  17:32:08', 34, H - 46, 32);
    // No GPS on this board, so no speed readout: just the "audio on" mic, which the board does have.
    micIcon(ctx, W - 58, H - 48);
    tex.needsUpdate = true;
  };

  draw();
  loadImage(url).then(draw).catch(() => undefined);
  return tex;
}

/**
 * A flat block for a diagram of what sits inside a package: a solid fill, a dashed inner border and a
 * label. Deliberately not a die photo; nothing about its layout comes from a decapped chip.
 */
export function diagramBlockTexture(title: string, sub: string, fill: string, aspect = 1) {
  const w = 512;
  const h = Math.round(512 / aspect);
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(244, 241, 235, 0.75)';
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 14]);
  ctx.strokeRect(22, 22, w - 44, h - 44);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(244, 241, 235, 0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.min(120, (w - 80) / (title.length * 0.62));
  ctx.font = `600 ${size}px Switzer, Arial, sans-serif`;
  ctx.fillText(title, w / 2, h / 2 - size * 0.45);
  ctx.font = `400 ${size * 0.62}px Switzer, Arial, sans-serif`;
  ctx.fillText(sub, w / 2, h / 2 + size * 0.6);
  return toTexture(c);
}

/** Fine noise used as a bump map for molded plastic. */
export function plasticBump() {
  const { c, ctx } = canvas(512, 512);
  const rand = rng(5);
  const img = ctx.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + rand() * 30;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

export function smallPcbTexture() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#123824';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#185034';
  ctx.fillRect(16, 16, 480, 480);
  for (const [x, y] of [
    [44, 44],
    [468, 44],
    [44, 468],
    [468, 468],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#d8b46c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0b0b';
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(236,236,228,0.9)';
  ctx.font = '600 30px Arial, sans-serif';
  ctx.fillText('SENSOR', 60, 120);
  return toTexture(c);
}
