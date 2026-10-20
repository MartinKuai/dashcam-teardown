import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { markingTexture, type MarkingSpec, type Pad } from './textures';

// Board components at true scale (1 unit = 1 cm). Coordinates are board-local:
// x right, y up, z out of the component side. Footprints follow common land
// patterns closely enough to read as real hardware up close.

export type Kind =
  | 'c0402'
  | 'c0603'
  | 'r0402'
  | 'esd0402'
  | 'led0603'
  | 'sot23'
  | 'sot23_5'
  | 'tsot23_8'
  | 'dfn1x1'
  | 'lga8'
  | 'lga12'
  | 'ind2520'
  | 'ind2016'
  | 'xtal2016'
  | 'sma'
  | 'sod123fl'
  | 'usbc'
  | 'tf'
  | 'fpc24'
  | 'jst2'
  | 'tact'
  | 'mic'
  | 'wirepad';

export type Group = 'board' | 'power' | 'storage';

export interface CompDef {
  ref: string;
  kind: Kind;
  x: number;
  y: number;
  /** Rotation about z in degrees. */
  rot?: number;
  group: Group;
  /** Laser marking lines for ICs and inductors. */
  mark?: string[];
  /** LED colour. */
  color?: number;
  /** Which side of the board the part is soldered to (default top). */
  side?: 'top' | 'bottom';
}

/** Anything that can collect meshes and materials (the PieceBuilder in model.ts). */
export interface Sink {
  group: THREE.Group;
  mat<T extends THREE.MeshStandardMaterial>(m: T): T;
  addInstanced(inst: THREE.InstancedMesh): void;
  meshes: THREE.Mesh[];
}

interface Mats {
  epoxy: THREE.MeshStandardMaterial;
  tin: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  resistor: THREE.MeshStandardMaterial;
  ferrite: THREE.MeshStandardMaterial;
  shell: THREE.MeshStandardMaterial;
  nylon: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  solder: THREE.MeshStandardMaterial;
}

function makeMats(s: Sink): Mats {
  return {
    epoxy: s.mat(new THREE.MeshStandardMaterial({ color: 0x26272b, roughness: 0.62 })),
    tin: s.mat(new THREE.MeshStandardMaterial({ color: 0xcfcfcb, metalness: 1, roughness: 0.32 })),
    ceramic: s.mat(new THREE.MeshStandardMaterial({ color: 0xa8916c, roughness: 0.55 })),
    resistor: s.mat(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 })),
    ferrite: s.mat(new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.75 })),
    shell: s.mat(new THREE.MeshStandardMaterial({ color: 0xd7d6d2, metalness: 1, roughness: 0.22 })),
    nylon: s.mat(new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.6 })),
    black: s.mat(new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.45 })),
    solder: s.mat(new THREE.MeshStandardMaterial({ color: 0xbdbdb8, metalness: 1, roughness: 0.25 })),
  };
}

// ---------- footprint / body dimensions ----------

interface Spec {
  /** Body size (x along length, y across, z height). */
  body: [number, number, number];
  pads: (d: CompDef) => Pad[];
}

const two = (pitch: number, pw: number, ph: number) => () => [
  { x: -pitch / 2, y: 0, w: pw, h: ph },
  { x: pitch / 2, y: 0, w: pw, h: ph },
];

const gull = (n: number, pitch: number, span: number, pw: number, ph: number) => () => {
  const pads: Pad[] = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < n; i++) pads.push({ x: (i - (n - 1) / 2) * pitch, y: side * span, w: pw, h: ph });
  }
  return pads;
};

const SPECS: Record<Kind, Spec> = {
  c0402: { body: [0.1, 0.05, 0.05], pads: two(0.1, 0.055, 0.06) },
  c0603: { body: [0.16, 0.08, 0.08], pads: two(0.16, 0.08, 0.09) },
  r0402: { body: [0.1, 0.05, 0.035], pads: two(0.1, 0.055, 0.06) },
  esd0402: { body: [0.1, 0.05, 0.045], pads: two(0.1, 0.055, 0.06) },
  led0603: { body: [0.16, 0.08, 0.06], pads: two(0.16, 0.08, 0.09) },
  sot23: {
    body: [0.29, 0.13, 0.1],
    pads: () => [
      { x: -0.095, y: -0.11, w: 0.06, h: 0.1 },
      { x: 0.095, y: -0.11, w: 0.06, h: 0.1 },
      { x: 0, y: 0.11, w: 0.06, h: 0.1 },
    ],
  },
  sot23_5: {
    body: [0.29, 0.16, 0.1],
    pads: () => [
      { x: -0.095, y: -0.13, w: 0.055, h: 0.1 },
      { x: 0, y: -0.13, w: 0.055, h: 0.1 },
      { x: 0.095, y: -0.13, w: 0.055, h: 0.1 },
      { x: -0.095, y: 0.13, w: 0.055, h: 0.1 },
      { x: 0.095, y: 0.13, w: 0.055, h: 0.1 },
    ],
  },
  tsot23_8: { body: [0.29, 0.16, 0.08], pads: gull(4, 0.065, 0.13, 0.04, 0.1) },
  dfn1x1: {
    body: [0.1, 0.1, 0.04],
    pads: () => [
      { x: -0.03, y: -0.035, w: 0.025, h: 0.02 },
      { x: 0.03, y: -0.035, w: 0.025, h: 0.02 },
      { x: -0.03, y: 0.035, w: 0.025, h: 0.02 },
      { x: 0.03, y: 0.035, w: 0.025, h: 0.02 },
      { x: 0, y: 0, w: 0.045, h: 0.045 },
    ],
  },
  lga8: { body: [0.6, 0.8, 0.08], pads: () => [-0.19, -0.065, 0.065, 0.19].flatMap((x) => [-0.3, 0.3].map((y) => ({ x, y, w: 0.06, h: 0.12 }))) },
  lga12: { body: [0.2, 0.2, 0.1], pads: gull(3, 0.05, 0.08, 0.025, 0.04) },
  ind2520: { body: [0.25, 0.2, 0.12], pads: two(0.2, 0.08, 0.2) },
  ind2016: { body: [0.2, 0.16, 0.1], pads: two(0.16, 0.07, 0.16) },
  xtal2016: { body: [0.2, 0.16, 0.05], pads: () => [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ x: sx * 0.06, y: sy * 0.045, w: 0.06, h: 0.05 }))) },
  sma: { body: [0.43, 0.26, 0.21], pads: two(0.42, 0.14, 0.17) },
  sod123fl: { body: [0.27, 0.16, 0.1], pads: two(0.3, 0.09, 0.12) },
  usbc: { body: [0.73, 0.894, 0.326], pads: () => [...Array(12)].map((_, i) => ({ x: 0.32, y: (i - 5.5) * 0.05, w: 0.08, h: 0.025 })) },
  tf: { body: [1.15, 1.1, 0.18], pads: () => [...Array(8)].map((_, i) => ({ x: (i - 3.5) * 0.11, y: -0.6, w: 0.06, h: 0.1 })) },
  fpc24: { body: [1.47, 0.38, 0.2], pads: () => [...Array(24)].map((_, i) => ({ x: (i - 11.5) * 0.05, y: -0.22, w: 0.025, h: 0.08 })) },
  jst2: { body: [0.4, 0.33, 0.35], pads: () => [{ x: -0.0625, y: -0.2, w: 0.06, h: 0.1 }, { x: 0.0625, y: -0.2, w: 0.06, h: 0.1 }] },
  tact: { body: [0.4, 0.3, 0.2], pads: two(0.42, 0.08, 0.12) },
  mic: { body: [0.4, 0.4, 0.15], pads: () => [{ x: -0.07, y: 0, w: 0.08, h: 0.08, round: true }, { x: 0.07, y: 0, w: 0.08, h: 0.08, round: true }] },
  // Hand-soldered wire: round pad, a solder dome and the insulated lead leaving along +x.
  wirepad: { body: [0.16, 0.16, 0.06], pads: () => [{ x: 0, y: 0, w: 0.2, h: 0.2, round: true }] },
};

export function bodySize(kind: Kind) {
  return SPECS[kind].body;
}

/** Copper pads for a placed component, in board coordinates. */
export function padsFor(d: CompDef): Pad[] {
  const a = THREE.MathUtils.degToRad(d.rot ?? 0);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const quarter = Math.abs(Math.round(sin)) === 1;
  return SPECS[d.kind].pads(d).map((p) => ({
    x: d.x + p.x * cos - p.y * sin,
    y: d.y + p.x * sin + p.y * cos,
    w: quarter ? p.h : p.w,
    h: quarter ? p.w : p.h,
    round: p.round,
  }));
}

/** Silkscreen outline [x, y, w, h] for a placed component. */
export function outlineFor(d: CompDef): [number, number, number, number] {
  const [bx, by] = SPECS[d.kind].body;
  const quarter = Math.abs(Math.round(Math.sin(THREE.MathUtils.degToRad(d.rot ?? 0)))) === 1;
  const w = (quarter ? by : bx) + 0.06;
  const h = (quarter ? bx : by) + 0.06;
  return [d.x, d.y, w, h];
}

// ---------- geometry ----------

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const zAxis = new THREE.Vector3(0, 0, 1);

/** Instanced boxes: many small identical shapes in one draw call. */
class Batch {
  readonly items: { m: THREE.Matrix4; ref: string }[] = [];
  constructor(
    readonly geo: THREE.BufferGeometry,
    readonly mat: THREE.Material,
  ) {}
  push(d: CompDef, local: THREE.Vector3, scale = new THREE.Vector3(1, 1, 1), extraRotZ = 0) {
    const a = THREE.MathUtils.degToRad(d.rot ?? 0);
    tmpP.copy(local).applyAxisAngle(zAxis, a).add(new THREE.Vector3(d.x, d.y, 0));
    tmpQ.setFromAxisAngle(zAxis, a + extraRotZ);
    tmpS.copy(scale);
    this.items.push({ m: new THREE.Matrix4().compose(tmpP.clone(), tmpQ.clone(), tmpS.clone()), ref: d.ref });
  }
  build(sink: Sink, z0: number) {
    if (!this.items.length) return;
    const inst = new THREE.InstancedMesh(this.geo, this.mat, this.items.length);
    this.items.forEach((it, i) => {
      tmpM.makeTranslation(0, 0, z0).multiply(it.m);
      inst.setMatrixAt(i, tmpM);
    });
    inst.userData.compByInstance = this.items.map((it) => it.ref);
    inst.receiveShadow = true;
    sink.addInstanced(inst);
  }
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const roundBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);

function placeMesh(sink: Sink, d: CompDef, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], local: THREE.Vector3Like, z0: number, rotX = 0, rotY = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  const a = THREE.MathUtils.degToRad(d.rot ?? 0);
  const p = new THREE.Vector3(local.x, local.y, local.z).applyAxisAngle(zAxis, a);
  mesh.position.set(d.x + p.x, d.y + p.y, z0 + p.z);
  mesh.rotation.set(rotX, rotY, a, 'ZYX');
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.comp = d.ref;
  sink.group.add(mesh);
  sink.meshes.push(mesh);
  return mesh;
}

/** Top face carries the marking; the other five faces are plain epoxy. */
function markedBox(sink: Sink, mats: Mats, d: CompDef, size: [number, number, number], z0: number, spec?: Partial<MarkingSpec>, body = '#26272b') {
  const [w, h, t] = size;
  let top: THREE.Material = mats.epoxy;
  if (d.mark?.length || spec) {
    const n = d.mark?.length ?? 1;
    top = sink.mat(
      new THREE.MeshStandardMaterial({
        roughness: 0.6,
        map: markingTexture({
          w,
          h,
          body,
          pin1: { x: 0.12, y: 0.2, r: 0.06 },
          lines: (d.mark ?? []).map((text, i) => ({ text, size: Math.min(0.42, 0.62 / n), y: (i + 1) / (n + 1) })),
          ...spec,
        }),
      }),
    );
  }
  const side = body === '#26272b' ? mats.epoxy : sink.mat(new THREE.MeshStandardMaterial({ color: new THREE.Color(body), roughness: 0.7 }));
  const box = new THREE.BoxGeometry(w, h, t);
  return placeMesh(sink, d, box, [side, side, side, side, top, side], { x: 0, y: 0, z: t / 2 }, z0);
}

/** Gull-wing leads for SOT / TSOT packages. */
function leads(batch: Batch, d: CompDef, positions: [number, number][], bodyH: number, len = 0.05) {
  for (const [x, side] of positions) {
    // Foot on the pad and a short riser into the body.
    batch.push(d, new THREE.Vector3(x, side * (bodyH / 2 + len * 0.55), 0.008), new THREE.Vector3(0.035, len * 0.7, 0.016));
    batch.push(d, new THREE.Vector3(x, side * (bodyH / 2 + 0.01), 0.035), new THREE.Vector3(0.035, 0.03, 0.05));
  }
}

// ---------- builder ----------

export function buildComponents(sink: Sink, defs: CompDef[], z0: number) {
  const mats = makeMats(sink);
  const ends = new Batch(unitBox, mats.tin);
  const fillets = new Batch(unitBox, mats.solder);
  const capBodies = new Batch(roundBox, mats.ceramic);
  const resBodies = new Batch(unitBox, mats.resistor);
  const resTops = new Batch(unitBox, sink.mat(new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.7 })));
  const esdBodies = new Batch(unitBox, sink.mat(new THREE.MeshStandardMaterial({ color: 0x5a5d63, roughness: 0.55 })));
  const leadBatch = new Batch(unitBox, mats.tin);
  const pins = new Batch(unitBox, sink.mat(new THREE.MeshStandardMaterial({ color: 0xd9c08a, metalness: 1, roughness: 0.3 })));

  for (const d of defs) {
    const [bx, by, bz] = SPECS[d.kind].body;
    switch (d.kind) {
      case 'c0402':
      case 'c0603': {
        const endW = bx * 0.22;
        capBodies.push(d, new THREE.Vector3(0, 0, bz / 2), new THREE.Vector3(bx - endW * 2, by, bz));
        for (const s of [-1, 1]) {
          ends.push(d, new THREE.Vector3(s * (bx / 2 - endW / 2), 0, bz / 2), new THREE.Vector3(endW, by * 1.02, bz * 1.02));
          fillets.push(d, new THREE.Vector3(s * (bx / 2 + 0.008), 0, 0.01), new THREE.Vector3(0.022, by * 1.05, 0.02));
        }
        break;
      }
      case 'r0402':
      case 'esd0402': {
        const endW = bx * 0.18;
        (d.kind === 'r0402' ? resBodies : esdBodies).push(d, new THREE.Vector3(0, 0, bz / 2), new THREE.Vector3(bx - endW * 2, by, bz));
        if (d.kind === 'r0402') resTops.push(d, new THREE.Vector3(0, 0, bz + 0.001), new THREE.Vector3(bx - endW * 2.2, by * 0.8, 0.002));
        for (const s of [-1, 1]) {
          ends.push(d, new THREE.Vector3(s * (bx / 2 - endW / 2), 0, bz / 2), new THREE.Vector3(endW, by, bz));
          fillets.push(d, new THREE.Vector3(s * (bx / 2 + 0.008), 0, 0.01), new THREE.Vector3(0.022, by * 1.05, 0.02));
        }
        break;
      }
      case 'led0603': {
        const lens = sink.mat(
          new THREE.MeshPhysicalMaterial({ color: d.color ?? 0xff3a2a, roughness: 0.15, transmission: 0.3, emissive: d.color ?? 0xff3a2a, emissiveIntensity: 0.35 }),
        );
        placeMesh(sink, d, new THREE.BoxGeometry(bx * 0.7, by, bz), lens, { x: 0, y: 0, z: bz / 2 }, z0);
        for (const s of [-1, 1]) ends.push(d, new THREE.Vector3(s * (bx / 2 - 0.02), 0, 0.02), new THREE.Vector3(0.04, by, 0.04));
        break;
      }
      // ICs get a pin-1 dot; text only where layout.ts gives a known marking.
      case 'sot23':
        markedBox(sink, mats, d, [bx, by, bz], z0 + 0.01, {});
        leads(leadBatch, d, [[-0.095, -1], [0.095, -1], [0, 1]], by);
        break;
      case 'sot23_5':
        markedBox(sink, mats, d, [bx, by, bz], z0 + 0.01, {});
        leads(leadBatch, d, [[-0.095, -1], [0, -1], [0.095, -1], [-0.095, 1], [0.095, 1]], by);
        break;
      case 'tsot23_8':
        markedBox(sink, mats, d, [bx, by, bz], z0 + 0.01, {});
        leads(leadBatch, d, [-0.0975, -0.0325, 0.0325, 0.0975].flatMap((x) => [[x, -1], [x, 1]] as [number, number][]), by);
        break;
      case 'dfn1x1':
      case 'lga12':
      case 'lga8':
        markedBox(sink, mats, d, [bx, by, bz], z0, {});
        break;
      case 'ind2520':
      case 'ind2016': {
        markedBox(sink, mats, d, [bx, by, bz], z0, { pin1: undefined, ink: 'rgba(220,220,214,0.7)' }, '#3a3b3e');
        for (const s of [-1, 1]) ends.push(d, new THREE.Vector3(s * (bx / 2 - 0.015), 0, 0.03), new THREE.Vector3(0.03, by * 0.9, 0.06));
        break;
      }
      case 'xtal2016': {
        placeMesh(sink, d, new THREE.BoxGeometry(bx, by, 0.02), mats.ceramic, { x: 0, y: 0, z: 0.01 }, z0);
        placeMesh(sink, d, new RoundedBoxGeometry(bx * 0.86, by * 0.8, 0.035, 2, 0.008), mats.shell, { x: 0, y: 0, z: 0.035 }, z0);
        break;
      }
      case 'sma':
      case 'sod123fl': {
        markedBox(sink, mats, d, [bx * 0.8, by, bz], z0 + 0.01, { lines: [{ text: d.mark?.[0] ?? '', size: 0.4, y: 0.5 }], pin1: undefined });
        // Cathode band.
        placeMesh(sink, d, new THREE.BoxGeometry(bx * 0.07, by * 1.01, 0.004), sink.mat(new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.6 })), { x: -bx * 0.3, y: 0, z: bz + 0.012 }, z0);
        for (const s of [-1, 1]) ends.push(d, new THREE.Vector3(s * (bx / 2 - 0.02), 0, 0.012), new THREE.Vector3(0.08, by * 0.55, 0.024));
        break;
      }
      case 'usbc': {
        // Stamped steel shell: a rounded tube with the mouth facing -x after rotation.
        const outer = new THREE.Shape();
        const r = bz / 2;
        outer.absarc(0, by / 2 - r, r, 0, Math.PI, false);
        outer.absarc(0, -by / 2 + r, r, Math.PI, Math.PI * 2, false);
        const inner = new THREE.Path();
        const ri = r - 0.025;
        inner.absarc(0, by / 2 - r, ri, 0, Math.PI, false);
        inner.absarc(0, -by / 2 + r, ri, Math.PI, Math.PI * 2, false);
        outer.holes.push(inner);
        const tube = new THREE.ExtrudeGeometry(outer, { depth: bx, bevelEnabled: false, curveSegments: 24 });
        tube.translate(0, 0, -bx / 2);
        const m = placeMesh(sink, d, tube, mats.shell, { x: 0, y: 0, z: r }, z0);
        m.rotation.set(0, Math.PI / 2, THREE.MathUtils.degToRad(d.rot ?? 0), 'ZYX');
        placeMesh(sink, d, new THREE.BoxGeometry(bx * 0.85, by * 0.62, 0.06), mats.black, { x: 0.02, y: 0, z: r }, z0);
        for (const s of [-1, 1]) placeMesh(sink, d, new THREE.BoxGeometry(0.12, 0.05, 0.08), mats.shell, { x: 0.15, y: s * (by / 2 + 0.02), z: 0.04 }, z0);
        break;
      }
      case 'tf': {
        placeMesh(sink, d, new THREE.BoxGeometry(bx, by, 0.05), mats.black, { x: 0, y: 0, z: 0.025 }, z0);
        const lid = placeMesh(sink, d, new RoundedBoxGeometry(bx, by * 0.96, 0.13, 2, 0.01), mats.shell, { x: 0, y: 0.02, z: 0.115 }, z0);
        lid.userData.comp = d.ref;
        // Embossed ribs on the shield.
        for (let i = 0; i < 3; i++) {
          placeMesh(sink, d, new THREE.BoxGeometry(bx * 0.7, 0.02, 0.012), mats.shell, { x: 0, y: -0.25 + i * 0.25, z: 0.185 }, z0);
        }
        break;
      }
      case 'fpc24': {
        placeMesh(sink, d, new THREE.BoxGeometry(bx, by * 0.6, 0.12), mats.nylon, { x: 0, y: 0.04, z: 0.06 }, z0);
        placeMesh(sink, d, new THREE.BoxGeometry(bx * 0.94, by * 0.42, 0.05), mats.black, { x: 0, y: -0.09, z: 0.17 }, z0);
        for (let i = 0; i < 24; i++) pins.push(d, new THREE.Vector3((i - 11.5) * 0.05, -0.2, 0.008), new THREE.Vector3(0.02, 0.08, 0.016));
        for (const s of [-1, 1]) ends.push(d, new THREE.Vector3(s * (bx / 2 + 0.03), 0, 0.03), new THREE.Vector3(0.06, 0.14, 0.06));
        break;
      }
      case 'jst2': {
        placeMesh(sink, d, new RoundedBoxGeometry(bx, by, bz, 2, 0.02), mats.nylon, { x: 0, y: 0.03, z: bz / 2 }, z0);
        for (const s of [-1, 1]) pins.push(d, new THREE.Vector3(s * 0.0625, -0.2, 0.01), new THREE.Vector3(0.03, 0.1, 0.02));
        break;
      }
      case 'tact': {
        placeMesh(sink, d, new THREE.BoxGeometry(bx, by, bz), mats.shell, { x: 0, y: 0, z: bz / 2 }, z0);
        placeMesh(sink, d, new RoundedBoxGeometry(0.18, 0.12, 0.08, 2, 0.02), mats.black, { x: 0, y: by / 2 + 0.04, z: bz / 2 }, z0);
        break;
      }
      case 'wirepad': {
        // Hand-soldered joints are low, satin blobs, not mirror spheres.
        const joint = sink.mat(new THREE.MeshStandardMaterial({ color: 0xb9b9b3, metalness: 1, roughness: 0.48 }));
        const dome = placeMesh(sink, d, new THREE.SphereGeometry(bx / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), joint, { x: 0, y: 0, z: 0 }, z0, Math.PI / 2);
        dome.scale.set(1, (bz * 0.6) / (bx / 2), 1);
        const wire = sink.mat(new THREE.MeshStandardMaterial({ color: d.color ?? 0xb3261e, roughness: 0.45 }));
        placeMesh(sink, d, new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12), wire, { x: 0.27, y: 0, z: 0.04 }, z0, 0, Math.PI / 2);
        break;
      }
      case 'mic': {
        const can = new THREE.CylinderGeometry(0.2, 0.2, bz, 40);
        placeMesh(sink, d, can, mats.shell, { x: 0, y: 0, z: bz / 2 }, z0, Math.PI / 2);
        const felt = new THREE.CylinderGeometry(0.17, 0.17, 0.01, 40);
        placeMesh(sink, d, felt, mats.black, { x: 0, y: 0, z: bz + 0.006 }, z0, Math.PI / 2);
        break;
      }
    }
  }

  for (const b of [ends, fillets, capBodies, resBodies, resTops, esdBodies, leadBatch, pins]) b.build(sink, z0);
}
