import type { CompDef } from './components';
import { outlineFor, padsFor } from './components';
import { rng, type BoardArt, type Pad } from './textures';

// Main board of the V851S reference design, in board-local cm.
// Power, storage and camera parts follow the open-source TinyVision board (a V851SE board;
// BOM_TinyVision_PCB1_2023-11-13). Dashcam-specific parts (supercap power path,
// G-sensor, buttons, LCD connector, mic) are design choices. Positions are illustrative.
// What each designator is, and which reference-board part it maps to, is in bom.ts.
// Laser marks are only drawn where the marking is known (SS14 on the Schottky; the V851S
// marking is in model.ts); a part number is not its top mark, so the other parts stay blank.

export const BOARD_W = 6.7;
export const BOARD_H = 3.8;

/** V851S: QFN-88, 9 × 9 mm, 0.35 mm pitch, 5.26 mm exposed pad. */
export const SOC = { x: -0.55, y: 0.2, size: 0.9 };

const DEFS: CompDef[] = [
  // ---- Power input and protection (design choices) ----
  { ref: 'J1', kind: 'usbc', x: -2.98, y: -0.5, group: 'power' },
  { ref: 'D1', kind: 'sod123fl', x: -2.42, y: -0.05, rot: 90, group: 'power' },
  { ref: 'D2', kind: 'sma', x: -2.42, y: 0.55, rot: 90, group: 'power', mark: ['SS14'] },
  { ref: 'Q1', kind: 'sot23', x: -1.9, y: 0.55, group: 'power' },
  { ref: 'R30', kind: 'r0402', x: -1.9, y: 0.32, group: 'power' },
  { ref: 'R31', kind: 'r0402', x: -1.75, y: 0.32, group: 'power' },

  // ---- 3.3 V buck: MT3520B + 2.2 µH (TinyVision U8, L2) ----
  { ref: 'U8', kind: 'sot23_5', x: -2.72, y: 1.2, group: 'power' },
  { ref: 'L2', kind: 'ind2016', x: -2.25, y: 1.22, group: 'power' },
  { ref: 'C35', kind: 'c0603', x: -3.1, y: 1.2, rot: 90, group: 'power' },
  { ref: 'C17', kind: 'c0603', x: -2.72, y: 1.5, group: 'power' },
  { ref: 'C21', kind: 'c0603', x: -1.95, y: 1.22, rot: 90, group: 'power' },
  { ref: 'R12', kind: 'r0402', x: -2.45, y: 0.92, group: 'power' },
  { ref: 'R14', kind: 'r0402', x: -2.3, y: 0.92, group: 'power' },
  { ref: 'C18', kind: 'c0402', x: -2.15, y: 0.92, group: 'power' },

  // ---- Dual buck for VCC-DRAM (1.5 V, as on TinyVision) and VDD-SYS (0.9 V): MP2122 (TinyVision U6, L1, L3) ----
  { ref: 'U6', kind: 'tsot23_8', x: -2.62, y: -1.22, group: 'power' },
  { ref: 'L1', kind: 'ind2520', x: -2.0, y: -0.98, group: 'power' },
  { ref: 'L3', kind: 'ind2520', x: -2.0, y: -1.48, group: 'power' },
  { ref: 'C13', kind: 'c0603', x: -3.08, y: -1.22, rot: 90, group: 'power' },
  { ref: 'C14', kind: 'c0603', x: -1.62, y: -0.98, rot: 90, group: 'power' },
  { ref: 'C19', kind: 'c0603', x: -1.62, y: -1.48, rot: 90, group: 'power' },
  // Feedback dividers sit between the converter and its inductors, clear of the USB-C shell.
  { ref: 'R10', kind: 'r0402', x: -2.35, y: -1.06, rot: 90, group: 'power' },
  { ref: 'R11', kind: 'r0402', x: -2.25, y: -1.06, rot: 90, group: 'power' },
  { ref: 'R13', kind: 'r0402', x: -2.62, y: -1.58, group: 'power' },
  { ref: 'R15', kind: 'r0402', x: -2.47, y: -1.58, group: 'power' },

  // ---- Camera rails: CJ6211 1.2 V / 2.8 V LDOs (TinyVision U7, U9) ----
  { ref: 'U7', kind: 'dfn1x1', x: 0.72, y: 1.38, group: 'power' },
  { ref: 'U9', kind: 'dfn1x1', x: 1.95, y: 1.38, group: 'power' },
  { ref: 'C15', kind: 'c0402', x: 0.86, y: 1.38, rot: 90, group: 'power' },
  { ref: 'C16', kind: 'c0402', x: 0.58, y: 1.38, rot: 90, group: 'power' },
  { ref: 'C23', kind: 'c0402', x: 2.09, y: 1.38, rot: 90, group: 'power' },
  { ref: 'C24', kind: 'c0402', x: 1.81, y: 1.38, rot: 90, group: 'power' },

  // ---- Storage: SD NAND + TF socket (TinyVision U2, U10) ----
  { ref: 'U2', kind: 'lga8', x: 0.62, y: -0.98, group: 'storage' },
  { ref: 'U10', kind: 'tf', x: 2.3, y: -1.08, group: 'storage' },
  // SD NAND supply: 100 nF at its VCC pin (TinyVision C5) and a 22 µF on the 3.3 V rail (TinyVision C41).
  { ref: 'C5', kind: 'c0402', x: 1.05, y: -0.7, rot: 90, group: 'storage' },
  { ref: 'C41', kind: 'c0603', x: 1.05, y: -1.0, rot: 90, group: 'storage' },

  // ---- Clock, sensors, connectors ----
  { ref: 'X1', kind: 'xtal2016', x: -0.55, y: 1.08, group: 'board' },
  { ref: 'C3', kind: 'c0402', x: -0.8, y: 1.08, rot: 90, group: 'board' },
  { ref: 'C4', kind: 'c0402', x: -0.3, y: 1.08, rot: 90, group: 'board' },
  { ref: 'U11', kind: 'lga12', x: 0.62, y: 0.42, group: 'board' },
  { ref: 'J2', kind: 'fpc24', x: 1.32, y: 1.62, group: 'board' },
  { ref: 'J3', kind: 'fpc24', x: -0.55, y: -1.6, rot: 180, group: 'board' },
  { ref: 'MK1', kind: 'mic', x: 2.62, y: 1.45, group: 'board' },
  { ref: 'SW1', kind: 'tact', x: 3.12, y: 0.42, rot: -90, group: 'board' },
  { ref: 'SW2', kind: 'tact', x: 3.12, y: -0.02, rot: -90, group: 'board' },
  { ref: 'SW3', kind: 'tact', x: 3.12, y: -0.46, rot: -90, group: 'board' },
  { ref: 'LED1', kind: 'led0603', x: 2.55, y: 0.62, group: 'board', color: 0xff3a2a },
  { ref: 'LED2', kind: 'led0603', x: 2.55, y: 0.4, group: 'board', color: 0x3a7bff },
  { ref: 'R21', kind: 'r0402', x: 2.32, y: 0.62, group: 'board' },
  { ref: 'R22', kind: 'r0402', x: 2.32, y: 0.4, group: 'board' },
  // Supercap balancing resistors (design choice).
  { ref: 'R40', kind: 'r0402', x: 1.3, y: -1.65, group: 'board' },
  { ref: 'R41', kind: 'r0402', x: 1.45, y: -1.65, group: 'board' },
];

// ESD protection on USB and TF lines (TinyVision D1–D9 are 0402ESDA-05N).
for (let i = 0; i < 5; i++) DEFS.push({ ref: `D${10 + i}`, kind: 'esd0402', x: 1.62 + i * 0.13, y: -0.36, group: 'storage' });
for (let i = 0; i < 4; i++) DEFS.push({ ref: `D${15 + i}`, kind: 'esd0402', x: -2.95 + i * 0.13, y: -1.0, rot: 90, group: 'power' });

// Decoupling ring around the SoC: 100 nF 0402 plus a few 22 µF 0603.
{
  let n = 0;
  const r = SOC.size / 2 + 0.2;
  for (const [sx, sy, rot] of [
    [1, 0, 90],
    [-1, 0, 90],
    [0, 1, 0],
    [0, -1, 0],
  ] as const) {
    for (let k = -2; k <= 2; k++) {
      if (sy === 1 && k === 0) continue; // crystal lead-in
      const x = SOC.x + (sx ? sx * r : k * 0.17);
      const y = SOC.y + (sy ? sy * r : k * 0.17);
      DEFS.push({ ref: `C${50 + n++}`, kind: 'c0402', x, y, rot, group: 'board' });
    }
  }
  DEFS.push({ ref: 'C70', kind: 'c0603', x: SOC.x - 0.95, y: SOC.y + 0.45, rot: 90, group: 'board' });
  DEFS.push({ ref: 'C71', kind: 'c0603', x: SOC.x - 0.95, y: SOC.y - 0.15, rot: 90, group: 'board' });
  DEFS.push({ ref: 'C72', kind: 'c0603', x: SOC.x + 0.15, y: SOC.y - 0.95, group: 'board' });
}

// ---- Bottom side (all design choices; nothing here comes from the reference board) ----
{
  // 100 nF decoupling under the V851S, between its exposed pad and the pin ring.
  const r = 0.36;
  for (const [i, [dx, dy, rot]] of ([
    [r, 0.15, 90],
    [r, -0.15, 90],
    [-r, 0.15, 90],
    [-r, -0.15, 90],
    [0.15, r, 0],
    [-0.15, r, 0],
    [0.15, -r, 0],
    [-0.15, -r, 0],
  ] as const).entries()) {
    DEFS.push({ ref: `C${80 + i}`, kind: 'c0402', x: SOC.x + dx, y: SOC.y + dy, rot, group: 'board', side: 'bottom' });
  }
  // 0402s under the board: USB-C CC pull-downs and the microSD series resistors and decoupling from the
  // reference circuit, plus input, accelerometer and microphone parts (see bom.ts).
  const extra: [string, 'r0402' | 'c0402', number, number, number?][] = [
    ['R80', 'r0402', -2.35, -0.25],
    ['R81', 'r0402', -2.2, -0.25],
    ['C88', 'c0402', -2.05, -0.25],
    ['R82', 'r0402', 1.55, -0.85, 90],
    ['R83', 'r0402', 1.7, -0.85, 90],
    ['C89', 'c0402', 1.85, -0.85, 90],
    ['C90', 'c0402', 0.55, 0.62, 90],
    ['C91', 'c0402', 0.7, 0.62, 90],
    ['R84', 'r0402', 2.6, 1.0],
    ['R85', 'r0402', 2.6, 0.85],
  ];
  for (const [ref, kind, x, y, rot] of extra) DEFS.push({ ref, kind, x, y, rot, group: 'board', side: 'bottom' });
  // Wires soldered straight to the board: the supercap pack.
  DEFS.push({ ref: 'P1', kind: 'wirepad', x: 1.45, y: -1.38, group: 'board', side: 'bottom', color: 0xb3261e });
  DEFS.push({ ref: 'P2', kind: 'wirepad', x: 1.45, y: -1.68, group: 'board', side: 'bottom', color: 0x1d1d1f });
}

/** Round ENIG test points on the bottom, next to the nets a factory test jig probes. */
const TEST_POINTS: [string, string, number, number][] = [
  ['TP1', 'VBUS', -2.6, -0.05],
  ['TP2', '3V3', -2.3, 1.5],
  ['TP3', '0V9', -1.55, -0.6],
  ['TP4', '1V5', -1.35, -1.55],
  ['TP5', 'GND', -3.0, 0.9],
  ['TP6', 'TX', 0.85, 0.95],
  ['TP7', 'RX', 1.1, 0.95],
  ['TP8', 'FEL', 1.35, 0.95],
  ['TP9', '2V8', 1.95, 1.12],
  ['TP10', '1V2', 0.75, 1.15],
  ['TP11', 'SD-CLK', 2.15, -0.25],
  ['TP12', 'RST', 0.75, -1.6],
];

export const COMPONENTS = DEFS;

// ---------- copper art ----------

function socPads(): Pad[] {
  const pads: Pad[] = [];
  const half = SOC.size / 2;
  const n = 22;
  const pitch = 0.035;
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * pitch;
    pads.push({ x: SOC.x + t, y: SOC.y + half - 0.02, w: 0.018, h: 0.06 });
    pads.push({ x: SOC.x + t, y: SOC.y - half + 0.02, w: 0.018, h: 0.06 });
    pads.push({ x: SOC.x + half - 0.02, y: SOC.y + t, w: 0.06, h: 0.018 });
    pads.push({ x: SOC.x - half + 0.02, y: SOC.y + t, w: 0.06, h: 0.018 });
  }
  pads.push({ x: SOC.x, y: SOC.y, w: 0.526, h: 0.526 });
  return pads;
}

/** Copper, silkscreen and holes for one side of the main board, in board coordinates. */
export function boardArt(side: 'top' | 'bottom' = 'top'): BoardArt {
  return side === 'top' ? topArt() : bottomArt();
}

const HOLES: BoardArt['holes'] = [
  [-3.05, 1.6, 0.11],
  [3.05, 1.6, 0.11],
  [-3.05, -1.6, 0.11],
  [3.05, -1.6, 0.11],
];

function bottomArt(): BoardArt {
  const defs = DEFS.filter((d) => d.side === 'bottom');
  const pads: Pad[] = [...defs.flatMap(padsFor), ...TEST_POINTS.map(([, , x, y]) => ({ x, y, w: 0.1, h: 0.1, round: true }))];
  const silk: BoardArt['silk'] = defs
    .filter((d) => !/^C8[0-7]$/.test(d.ref))
    .map((d) => {
      const o = outlineFor(d);
      // Seen from below, text runs toward -x, so it starts at the part's +x edge.
      return [d.ref, o[0] + o[2] / 2, o[1] + o[3] / 2 + 0.05, 0.055];
    });
  for (const [tp, net, x, y] of TEST_POINTS) {
    silk.push([tp, x - 0.08, y + 0.03, 0.05]);
    silk.push([net, x - 0.08, y - 0.04, 0.04]);
  }
  silk.push(['C80-C87', SOC.x - 0.2, SOC.y + 0.55, 0.05]);
  silk.push(['SC+', 1.3, -1.38, 0.05], ['SC-', 1.3, -1.68, 0.05]);
  silk.push(['DC-V851S-REF  V1.0', 1.55, 1.62, 0.085]);
  silk.push(['2441', 2.47, 1.42, 0.06]);
  silk.push(['94V-0', 2.95, 1.42, 0.06]);
  silk.push(['LOT', 2.84, -0.95, 0.05]);
  silk.push(['QR', 0.5, -0.88, 0.05]);

  const outlines: BoardArt['outlines'] = defs.filter((d) => d.kind !== 'c0402' && d.kind !== 'r0402').map(outlineFor);
  // Date-code box, two empty FCC / CE marking boxes and the production lot box.
  outlines.push([2.33, 1.42, 0.38, 0.13], [-1.55, 1.5, 0.28, 0.28], [-1.2, 1.5, 0.28, 0.28], [2.5, -0.95, 0.75, 0.2]);
  // Where the line puts its QR serial sticker: a filled silkscreen block.
  const blocks: BoardArt['blocks'] = [[0.25, -1.25, 0.6, 0.6]];

  return { width: BOARD_W, height: BOARD_H, pads, outlines, silk, traces: [], vias: [], holes: HOLES, blocks };
}

function topArt(): BoardArt {
  const rand = rng(23);
  const top = DEFS.filter((d) => d.side !== 'bottom');
  const pads: Pad[] = [...socPads(), ...top.flatMap(padsFor)];
  const traces: BoardArt['traces'] = [];
  const vias: [number, number][] = [];

  // QFN fan-out: each signal leaves the pad, steps out 45°, and drops to a via.
  const half = SOC.size / 2;
  const n = 22;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      if (rand() < 0.25) continue;
      const t = (i - (n - 1) / 2) * 0.035;
      const out = half + 0.05 + rand() * 0.05;
      const spread = t * 1.55;
      const dist = half + 0.32 + rand() * 0.12;
      const [ux, uy] = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ][side];
      const p0: [number, number] = [SOC.x + (ux ? ux * (half - 0.02) : t), SOC.y + (uy ? uy * (half - 0.02) : t)];
      const p1: [number, number] = [SOC.x + (ux ? ux * out : t), SOC.y + (uy ? uy * out : t)];
      const p2: [number, number] = [SOC.x + (ux ? ux * dist : spread), SOC.y + (uy ? uy * dist : spread)];
      traces.push({ pts: [p0, p1, p2], width: 0.01 });
      vias.push(p2);
    }
  }
  // Thermal vias under the exposed pad.
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) vias.push([SOC.x + i * 0.09, SOC.y + j * 0.09]);

  // MIPI CSI: two differential pairs plus clock from SoC to the camera connector J2.
  for (let p = 0; p < 3; p++) {
    for (const off of [0, 0.022]) {
      const y0 = SOC.y + 0.1 + p * 0.07 + off;
      traces.push({
        pts: [
          [SOC.x + half + 0.1, y0],
          [0.3, y0],
          [0.65 + p * 0.07, 1.0 + p * 0.03 + off],
          [0.9 + p * 0.12 + off, 1.45],
        ],
        width: 0.012,
      });
    }
  }
  // SD NAND bus.
  for (let k = 0; k < 6; k++) {
    traces.push({
      pts: [
        [SOC.x + 0.1 + k * 0.05, SOC.y - half - 0.1],
        [SOC.x + 0.1 + k * 0.05, -0.55],
        [0.42 + k * 0.05, -0.72],
      ],
      width: 0.01,
    });
  }
  // TF socket bus.
  for (let k = 0; k < 6; k++) {
    const y = -0.2 - k * 0.06;
    traces.push({
      pts: [
        [SOC.x + half + 0.1, y + 0.1],
        [1.3, y],
        [1.62 + k * 0.13, -0.36],
        [1.85 + k * 0.11, -0.52],
      ],
      width: 0.01,
    });
  }
  // USB D+ / D- pair.
  for (const off of [0, 0.022]) {
    traces.push({ pts: [[-2.62, -0.48 + off], [-1.4, -0.48 + off], [SOC.x - half - 0.1, SOC.y - 0.25 + off]], width: 0.012 });
  }
  // Power: wide traces from the bucks and LDOs.
  traces.push({ pts: [[-2.05, 1.22], [-1.5, 1.22], [-1.5, 0.75], [SOC.x - 0.3, SOC.y + half + 0.1]], width: 0.05 });
  traces.push({ pts: [[-1.85, -0.98], [-1.35, -0.98], [-1.35, SOC.y - 0.2], [SOC.x - half - 0.1, SOC.y - 0.2]], width: 0.06 });
  traces.push({ pts: [[-1.85, -1.48], [-1.2, -1.48], [-1.2, SOC.y - half - 0.25], [SOC.x - 0.2, SOC.y - half - 0.1]], width: 0.05 });
  traces.push({ pts: [[-2.65, -0.5], [-2.42, -0.05], [-2.42, 0.55], [-1.9, 0.55]], width: 0.06 });
  traces.push({ pts: [[0.72, 1.38], [1.95, 1.38]], width: 0.03 });

  // Stitching vias along the board edge.
  for (let x = -3.1; x <= 3.1; x += 0.22) {
    vias.push([x, BOARD_H / 2 - 0.12]);
    vias.push([x, -BOARD_H / 2 + 0.12]);
  }

  const silk: BoardArt['silk'] = top.filter((d) => !/^C(5|6)\d$|^D1[0-8]$/.test(d.ref)).map((d) => {
    const o = outlineFor(d);
    return [d.ref, o[0] - o[2] / 2, o[1] + o[3] / 2 + 0.05, 0.055];
  });
  silk.push(['U1', SOC.x - 0.55, SOC.y + 0.55, 0.07]);
  silk.push(['DVR-V851S-MB  V1.0', 0.5, -1.72, 0.08]);

  const outlines = top.filter((d) => !['c0402', 'r0402', 'esd0402'].includes(d.kind)).map(outlineFor);
  outlines.push([SOC.x, SOC.y, SOC.size + 0.08, SOC.size + 0.08]);

  return {
    width: BOARD_W,
    height: BOARD_H,
    pads,
    outlines,
    silk,
    traces,
    vias,
    holes: HOLES,
  };
}
