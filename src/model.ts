import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildComponents, type Group, type Sink } from './components';
import { BOARD_H, BOARD_W, boardArt, COMPONENTS, SOC } from './layout';
import type { PartId } from './parts';
import { diagramBlockTexture, markingTexture, pcbMaps, plasticBump, screenTexture, smallPcbTexture } from './textures';

/** Files in public/, under the path the page is served from (a sub-path on martinkuai.com). */
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`;

// Reference design: a compact dashcam around the Allwinner V851S, at true scale
// (1 scene unit = 1 cm). +z is the lens side, -z the screen side.

export type PieceKey =
  | 'frontShell'
  | 'rearShell'
  | 'lensBoard'
  | 'lensHolder'
  | 'board'
  | 'power'
  | 'storage'
  | 'socBase'
  | 'dram'
  | 'socLid'
  | 'lcd'
  | 'supercap';

export interface Piece {
  key: PieceKey;
  part: PartId;
  object: THREE.Group;
  base: THREE.Vector3;
  /** Offset applied at explode = 1. */
  explode: THREE.Vector3;
  materials: THREE.MeshStandardMaterial[];
  meshes: THREE.Mesh[];
  /** Where the label leader line attaches, in the piece's local space. */
  anchor: THREE.Vector3;
}

const W = 7.2;
const H = 4.4;
const R = 0.45;
const WALL = 0.14;
const DEPTH = 1.12; // each half
const LENS = new THREE.Vector2(1.4, 0.3);
const LCD_POS = new THREE.Vector3(-0.5, 0.1, -0.62);
const LCD_W = 4.4;
const LCD_H = 3.3;
const BOARD_Z = -0.15;
export const BOARD_T = 0.16;
const TOP = BOARD_Z + BOARD_T / 2;

export const SOC_LIFT = 0.9;

function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedRectPath(w: number, h: number, r: number, cx = 0, cy = 0) {
  const p = new THREE.Path();
  p.curves = roundedRect(w, h, r, cx, cy).curves;
  return p;
}

function circlePath(cx: number, cy: number, r: number) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

const extrude = (shape: THREE.Shape, depth: number, bevel = 0.03) =>
  new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 32,
  });

class PieceBuilder {
  readonly group = new THREE.Group();
  readonly materials: THREE.MeshStandardMaterial[] = [];
  readonly meshes: THREE.Mesh[] = [];

  constructor(
    readonly key: PieceKey,
    readonly part: PartId,
  ) {}

  mat<T extends THREE.MeshStandardMaterial>(m: T): T {
    this.materials.push(m);
    return m;
  }

  add(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], pos?: THREE.Vector3Like) {
    const mesh = new THREE.Mesh(geo, mat);
    if (pos) mesh.position.set(pos.x, pos.y, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  addInstanced(inst: THREE.InstancedMesh) {
    inst.castShadow = true;
    this.group.add(inst);
    this.meshes.push(inst);
  }

  done(base: THREE.Vector3, explode: THREE.Vector3, anchor: THREE.Vector3): Piece {
    this.group.position.copy(base);
    for (const m of this.meshes) m.userData.piece = this.key;
    return {
      key: this.key,
      part: this.part,
      object: this.group,
      base: base.clone(),
      explode,
      materials: this.materials,
      meshes: this.meshes,
      anchor,
    };
  }
}

const bump = plasticBump();
const plastic = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0x1d1d1f,
    roughness: 0.72,
    clearcoat: 0.08,
    clearcoatRoughness: 0.7,
    bumpMap: bump,
    bumpScale: 0.6,
  });
const metal = (color = 0xc9c6c0, roughness = 0.3) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness });

/** Dark inset used for openings and grilles on the shell surface. */
const recess = () => new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 });

// ---------- Shell ----------

function frontShell(): Piece {
  const b = new PieceBuilder('frontShell', 'shell');
  const m = b.mat(plastic());
  const plate = roundedRect(W, H, R);
  plate.holes.push(circlePath(LENS.x, LENS.y, 0.72));
  b.add(extrude(plate, 0.14), m, { x: 0, y: 0, z: DEPTH - 0.14 });
  const ring = roundedRect(W, H, R);
  ring.holes.push(roundedRectPath(W - WALL * 2, H - WALL * 2, R - WALL));
  b.add(extrude(ring, DEPTH - 0.14, 0.015), m, { x: 0, y: 0, z: 0 });

  // Machined lens bezel.
  const alu = b.mat(metal(0x8e8e92, 0.38));
  const bezel = b.add(new THREE.CylinderGeometry(0.86, 0.9, 0.08, 96, 1, true), alu, { x: LENS.x, y: LENS.y, z: DEPTH + 0.02 });
  bezel.rotation.x = Math.PI / 2;
  const face = new THREE.RingGeometry(0.72, 0.86, 96);
  b.add(face, alu, { x: LENS.x, y: LENS.y, z: DEPTH + 0.06 });

  // Status LED window and a small vent grid.
  const dark = b.mat(recess());
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const hole = b.add(new THREE.CircleGeometry(0.035, 16), dark, { x: -2.9 + i * 0.13, y: -1.55 + j * 0.13, z: DEPTH + 0.031 });
      hole.castShadow = false;
    }
  }
  const led = b.mat(new THREE.MeshStandardMaterial({ color: 0x5a1410, emissive: 0xe0442b, emissiveIntensity: 0.5 }));
  b.add(new THREE.CircleGeometry(0.05, 20), led, { x: -2.95, y: 1.75, z: DEPTH + 0.031 });

  // Ports on the side walls: USB-C on the left, microSD slot on the right.
  const usb = b.add(new RoundedBoxGeometry(0.02, 0.95, 0.38, 2, 0.008), dark, { x: -W / 2 - 0.002, y: -0.5, z: 0.18 });
  usb.castShadow = false;
  const sd = b.add(new RoundedBoxGeometry(0.02, 1.25, 0.16, 2, 0.006), dark, { x: W / 2 + 0.002, y: -1.08, z: 0.1 });
  sd.castShadow = false;

  return b.done(new THREE.Vector3(), new THREE.Vector3(0, 0, 5.0), new THREE.Vector3(-W / 2 + 0.35, H / 2 - 0.15, DEPTH));
}

function rearShell(): Piece {
  const b = new PieceBuilder('rearShell', 'shell');
  const m = b.mat(plastic());
  const plate = roundedRect(W, H, R);
  plate.holes.push(roundedRectPath(LCD_W - 0.5, LCD_H - 0.5, 0.06, LCD_POS.x, LCD_POS.y));
  b.add(extrude(plate, 0.14), m, { x: 0, y: 0, z: -DEPTH });
  const ring = roundedRect(W, H, R);
  ring.holes.push(roundedRectPath(W - WALL * 2, H - WALL * 2, R - WALL));
  b.add(extrude(ring, DEPTH - 0.14, 0.015), m, { x: 0, y: 0, z: -DEPTH + 0.14 });

  // Four screws: pan heads with a cross recess.
  const steel = b.mat(metal(0x9a9a9e, 0.35));
  const dark = b.mat(recess());
  for (const [sx, sy] of [
    [-3.2, 1.8],
    [3.2, 1.8],
    [-3.2, -1.8],
    [3.2, -1.8],
  ]) {
    const head = b.add(new THREE.CylinderGeometry(0.11, 0.12, 0.04, 24), steel, { x: sx, y: sy, z: -DEPTH - 0.04 });
    head.rotation.x = Math.PI / 2;
    for (const rz of [0, Math.PI / 2]) {
      const slot = b.add(new THREE.BoxGeometry(0.13, 0.025, 0.012), dark, { x: sx, y: sy, z: -DEPTH - 0.062 });
      slot.rotation.z = rz;
    }
  }
  // Buttons on the right wall.
  const btn = b.mat(new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.55 }));
  for (const y of [0.42, -0.02, -0.46]) b.add(new RoundedBoxGeometry(0.1, 0.32, 0.22, 2, 0.03), btn, { x: W / 2 + 0.03, y, z: -0.3 });

  // Windscreen mount with a hinge.
  b.add(new RoundedBoxGeometry(2.0, 0.24, 1.0, 3, 0.06), m, { x: 0.9, y: H / 2 + 0.12, z: -0.55 });
  const hinge = b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 32), m, { x: 0.9, y: H / 2 + 0.42, z: -0.55 });
  hinge.rotation.z = Math.PI / 2;
  const pin = b.add(new THREE.CylinderGeometry(0.08, 0.08, 0.96, 20), steel, { x: 0.9, y: H / 2 + 0.42, z: -0.55 });
  pin.rotation.z = Math.PI / 2;
  const pad = b.add(new RoundedBoxGeometry(3.0, 0.14, 1.6, 3, 0.05), m, { x: 0.9, y: H / 2 + 0.72, z: -0.55 });
  pad.rotation.x = -0.18;

  return b.done(new THREE.Vector3(), new THREE.Vector3(0, 0, -5.2), new THREE.Vector3(-W / 2 + 0.35, H / 2 - 0.15, -DEPTH));
}

// ---------- Lens + sensor ----------

function lensBoard(): Piece {
  const b = new PieceBuilder('lensBoard', 'lens');
  const pcb = b.mat(new THREE.MeshPhysicalMaterial({ map: smallPcbTexture(), roughness: 0.4, clearcoat: 0.5 }));
  b.add(new THREE.BoxGeometry(1.8, 1.8, 0.1), pcb);
  // Sensor in a ceramic package with a glass window.
  const ceramic = b.mat(new THREE.MeshStandardMaterial({ color: 0x3b342c, roughness: 0.6 }));
  b.add(new THREE.BoxGeometry(0.85, 0.72, 0.08), ceramic, { x: 0, y: 0, z: 0.09 });
  const die = b.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x2d2550,
      metalness: 0.7,
      roughness: 0.18,
      iridescence: 1,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [180, 620],
    }),
  );
  b.add(new THREE.BoxGeometry(0.56, 0.42, 0.01), die, { x: 0, y: 0, z: 0.135 });
  const glass = b.mat(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 0.9, thickness: 0.02, transparent: true }));
  b.add(new THREE.BoxGeometry(0.78, 0.64, 0.015), glass, { x: 0, y: 0, z: 0.142 });
  // Small passives on the sensor board.
  const cap = b.mat(new THREE.MeshStandardMaterial({ color: 0xa8916c, roughness: 0.55 }));
  for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.1, 0.05, 0.05), cap, { x: -0.6 + i * 0.24, y: -0.62, z: 0.075 });
  // MIPI flex down to J2.
  const flex = b.mat(new THREE.MeshStandardMaterial({ color: 0xc9772a, roughness: 0.45, metalness: 0.1 }));
  b.add(new THREE.BoxGeometry(0.75, 0.75, 0.012), flex, { x: -0.2, y: 1.25, z: -0.05 });
  return b.done(new THREE.Vector3(LENS.x, LENS.y, 0.2), new THREE.Vector3(0, 0, 2.4), new THREE.Vector3(0.3, 0.3, 0.15));
}

function lensHolder(): Piece {
  const b = new PieceBuilder('lensHolder', 'lens');
  const black = b.mat(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6 }));
  b.add(new RoundedBoxGeometry(1.4, 1.4, 0.5, 3, 0.05), black, { x: 0, y: 0, z: 0.42 });
  // M12 lens barrel with threads and a focus lock ring.
  const barrel = b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.62, 64), black, { x: 0, y: 0, z: 0.98 });
  barrel.rotation.x = Math.PI / 2;
  const thread = b.mat(new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.45 }));
  for (let i = 0; i < 9; i++) {
    const t = b.add(new THREE.TorusGeometry(0.555, 0.012, 6, 64), thread, { x: 0, y: 0, z: 0.72 + i * 0.03 });
    t.castShadow = false;
  }
  const knurl = b.mat(metal(0x2a2a2d, 0.5));
  const lock = b.add(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 48), knurl, { x: 0, y: 0, z: 0.7 });
  lock.rotation.x = Math.PI / 2;
  const front = b.add(new THREE.CylinderGeometry(0.6, 0.58, 0.08, 64), knurl, { x: 0, y: 0, z: 1.32 });
  front.rotation.x = Math.PI / 2;
  // Front element with an anti-reflection tint, plus an inner aperture ring.
  const aperture = b.add(new THREE.RingGeometry(0.26, 0.5, 64), black, { x: 0, y: 0, z: 1.355 });
  aperture.castShadow = false;
  const glass = b.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0e18,
      roughness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      iridescence: 0.9,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [240, 640],
    }),
  );
  const lens = b.add(new THREE.SphereGeometry(0.44, 64, 24, 0, Math.PI * 2, 0, Math.PI / 3.2), glass, { x: 0, y: 0, z: 1.22 });
  lens.rotation.x = Math.PI / 2;
  lens.scale.set(1, 0.42, 1);
  return b.done(new THREE.Vector3(LENS.x, LENS.y, 0.2), new THREE.Vector3(0, 0, 3.7), new THREE.Vector3(0, 0.5, 1.3));
}

// ---------- Main board + component groups ----------

function board(): Piece {
  const b = new PieceBuilder('board', 'board');
  const maps = pcbMaps(boardArt(), { copperUrl: asset('pcb-copper.png') });
  const back = pcbMaps(boardArt('bottom'), { copperUrl: asset('pcb-back-copper.png'), holesUrl: asset('pcb-back-holes.png'), bottom: true });
  const top = b.mat(
    new THREE.MeshPhysicalMaterial({
      map: maps.map,
      metalnessMap: maps.metalnessMap,
      metalness: 1,
      roughnessMap: maps.roughnessMap,
      roughness: 1,
      bumpMap: maps.bumpMap,
      bumpScale: 1.2,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
    }),
  );
  const edge = b.mat(new THREE.MeshStandardMaterial({ color: 0x1c3d2a, roughness: 0.7 }));
  const bottom = b.mat(
    new THREE.MeshPhysicalMaterial({
      map: back.map,
      metalnessMap: back.metalnessMap,
      metalness: 1,
      roughnessMap: back.roughnessMap,
      roughness: 1,
      bumpMap: back.bumpMap,
      bumpScale: 1.2,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
    }),
  );
  b.add(new THREE.BoxGeometry(BOARD_W, BOARD_H, BOARD_T), [edge, edge, edge, edge, top, bottom]);
  buildComponents(b, COMPONENTS.filter((c) => c.group === 'board' && c.side !== 'bottom'), BOARD_T / 2);
  // Bottom-side parts: built the usual way inside a group flipped about x, so (x, y) maps to (x, -y).
  const flipped = new THREE.Group();
  flipped.rotation.x = Math.PI;
  b.group.add(flipped);
  const backSink: Sink = {
    group: flipped,
    meshes: b.meshes,
    mat: <T extends THREE.MeshStandardMaterial>(m: T) => b.mat(m),
    addInstanced: (inst) => {
      inst.castShadow = true;
      flipped.add(inst);
      b.meshes.push(inst);
    },
  };
  const under = COMPONENTS.filter((c) => c.side === 'bottom').map((c) => ({ ...c, y: -c.y, rot: -(c.rot ?? 0) }));
  buildComponents(backSink, under, BOARD_T / 2);
  return b.done(new THREE.Vector3(0, 0, BOARD_Z), new THREE.Vector3(), new THREE.Vector3(2.9, 1.55, BOARD_T / 2));
}

function compGroup(key: 'power' | 'storage', group: Group, anchor: THREE.Vector3): Piece {
  const b = new PieceBuilder(key, key);
  buildComponents(b, COMPONENTS.filter((c) => c.group === group), 0);
  return b.done(new THREE.Vector3(0, 0, TOP), new THREE.Vector3(0, 0, 0.5), anchor);
}

// ---------- V851S package (SiP) ----------
// QFN-88 is molded solid; there is no lid. The story shows the mold see-through (main.ts) to make one
// point: the 64 MB DDR2 sits inside this package. No public source shows the dies' count, size or
// placement, so the inside is drawn as two flat diagram blocks, not as silicon with bond wires.

const SUB_T = 0.02;
const MOLD_T = 0.065;
const socWorld = (dx = 0, dy = 0, dz = 0) => new THREE.Vector3(SOC.x + dx, SOC.y + dy, TOP + dz);

function socBase(): Piece {
  const b = new PieceBuilder('socBase', 'soc');
  const s = SOC.size;
  const substrate = b.mat(new THREE.MeshStandardMaterial({ color: 0x46512f, roughness: 0.5 }));
  b.add(new THREE.BoxGeometry(s, s, SUB_T), substrate, { x: 0, y: 0, z: SUB_T / 2 });
  // Exposed thermal pad and QFN terminals underneath / at the edge.
  const tin = b.mat(metal(0xd2d2ce, 0.3));
  b.add(new THREE.BoxGeometry(0.526, 0.526, 0.004), tin, { x: 0, y: 0, z: 0.0 });
  const pad = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.05, 0.02), tin, 88);
  const m4 = new THREE.Matrix4();
  let i = 0;
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < 22; k++) {
      const t = (k - 10.5) * 0.035;
      const out = s / 2 - 0.022;
      const [x, y] = [
        [t, out],
        [out, t],
        [t, -out],
        [-out, t],
      ][side];
      m4.makeRotationZ(side % 2 === 0 ? 0 : Math.PI / 2);
      m4.setPosition(x, y, SUB_T / 2);
      pad.setMatrixAt(i++, m4);
    }
  }
  b.addInstanced(pad);
  // Diagram block for the processor side of the SiP.
  const block = b.mat(new THREE.MeshStandardMaterial({ map: diagramBlockTexture('PROCESSOR', 'A7 · RISC-V · NPU', '#4a4f5a'), roughness: 0.85 }));
  b.add(new THREE.BoxGeometry(0.4, 0.4, 0.02), block, { x: -0.16, y: 0.1, z: SUB_T + 0.01 });
  return b.done(socWorld(), new THREE.Vector3(0, 0, SOC_LIFT), new THREE.Vector3(-0.3, 0.3, SUB_T + 0.02));
}

function dram(): Piece {
  const b = new PieceBuilder('dram', 'ddr');
  // Diagram block for the memory: it is in the package; its size and position here are not known.
  const block = b.mat(new THREE.MeshStandardMaterial({ map: diagramBlockTexture('DDR2', '64 MB', '#2f5ea8', 0.6), roughness: 0.85 }));
  b.add(new THREE.BoxGeometry(0.27, 0.45, 0.02), block);
  return b.done(socWorld(0.24, -0.06, SUB_T + 0.01), new THREE.Vector3(0, 0, SOC_LIFT), new THREE.Vector3(0.08, 0.15, 0.01));
}

function socLid(): Piece {
  const b = new PieceBuilder('socLid', 'soc');
  const s = SOC.size;
  // Official V851S marking layout (datasheet §15.1): logo, part name, lot number, date code.
  const top = b.mat(
    new THREE.MeshStandardMaterial({
      roughness: 0.62,
      map: markingTexture({
        w: s,
        h: s,
        body: '#24262b',
        ink: 'rgba(214, 214, 210, 0.9)',
        logo: { url: asset('allwinner-logo.png'), y: 0.22, width: 0.62 },
        pin1: { x: 0.1, y: 0.86, r: 0.022 },
        lines: [
          { text: 'V851S', size: 0.23, weight: 400, y: 0.52 },
          // Lot (LLLLLBA) and date code (XXX1) in the datasheet's format; the values are samples.
          { text: 'N2C14BA   2421', size: 0.085, weight: 400, y: 0.86, x: 0.55 },
        ],
      }),
    }),
  );
  const side = b.mat(new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.62 }));
  b.add(new THREE.BoxGeometry(s, s, MOLD_T), [side, side, side, side, top, side], { x: 0, y: 0, z: 0 });
  return b.done(socWorld(0, 0, SUB_T + MOLD_T / 2), new THREE.Vector3(0, 0, SOC_LIFT), new THREE.Vector3(s / 2 - 0.08, s / 2 - 0.08, MOLD_T / 2));
}

// ---------- Screen + supercap ----------

function lcd(): Piece {
  const b = new PieceBuilder('lcd', 'lcd');
  const back = b.mat(metal(0xb9b6b0, 0.4));
  b.add(new THREE.BoxGeometry(LCD_W, LCD_H, 0.22), back);
  const bezel = b.mat(new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.3 }));
  b.add(new THREE.BoxGeometry(LCD_W - 0.06, LCD_H - 0.06, 0.03), bezel, { x: 0, y: 0, z: -0.12 });
  const tex = screenTexture(asset('lcd-screen.jpg'));
  const screen = b.mat(
    new THREE.MeshPhysicalMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, roughness: 0.08, clearcoat: 1 }),
  );
  const plane = b.add(new THREE.PlaneGeometry(4.06, 3.05), screen, { x: 0, y: 0.05, z: -0.137 });
  plane.rotation.y = Math.PI;
  plane.castShadow = false;
  const flex = b.mat(new THREE.MeshStandardMaterial({ color: 0xc9772a, roughness: 0.45, metalness: 0.1 }));
  b.add(new THREE.BoxGeometry(1.45, 0.9, 0.012), flex, { x: -0.05, y: -LCD_H / 2 - 0.35, z: 0.05 });
  return b.done(LCD_POS.clone(), new THREE.Vector3(0, 0, -2.6), new THREE.Vector3(-LCD_W / 2 + 0.2, LCD_H / 2 - 0.1, -0.12));
}

function supercap(): Piece {
  const b = new PieceBuilder('supercap', 'supercap');
  // Two 2.7 V cells in series for the 5 V rail.
  const sleeve = b.mat(new THREE.MeshPhysicalMaterial({ color: 0x1b2433, roughness: 0.35, clearcoat: 0.6 }));
  const cap = b.mat(metal(0xbdbab3, 0.3));
  const stripe = b.mat(new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.5 }));
  const lead = b.mat(metal(0xd6d3cc, 0.3));
  for (const y of [-0.2, 0.2]) {
    const body = b.add(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 40), sleeve, { x: 0, y, z: 0 });
    body.rotation.z = Math.PI / 2;
    const end = b.add(new THREE.CylinderGeometry(0.165, 0.165, 0.02, 40), cap, { x: 0.61, y, z: 0 });
    end.rotation.z = Math.PI / 2;
    const band = b.add(new THREE.CylinderGeometry(0.183, 0.183, 0.1, 40, 1, true), stripe, { x: -0.35, y, z: 0 });
    band.rotation.z = Math.PI / 2;
    for (const z of [-0.06, 0.06]) {
      const l = b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), lead, { x: -0.8, y, z });
      l.rotation.z = Math.PI / 2;
    }
  }
  return b.done(new THREE.Vector3(2.3, -1.55, -0.55), new THREE.Vector3(0, -0.8, -3.7), new THREE.Vector3(0.5, 0.35, 0));
}

export function buildDashcam() {
  const root = new THREE.Group();
  const pieces = [
    frontShell(),
    rearShell(),
    lensBoard(),
    lensHolder(),
    board(),
    compGroup('power', 'power', new THREE.Vector3(-2.62, -1.22, 0.1)),
    compGroup('storage', 'storage', new THREE.Vector3(0.62, -0.98, 0.1)),
    socBase(),
    dram(),
    socLid(),
    lcd(),
    supercap(),
  ];
  for (const p of pieces) root.add(p.object);
  return { root, pieces };
}
