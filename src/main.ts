import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BOARD_T, buildDashcam, type Piece, type PieceKey } from './model';
import { bodySize } from './components';
import { COMPONENTS } from './layout';
import { lang, NAV_ZH, onLang, t, wrapPhrases } from './i18n';
import { basisLabel, compInfo, PART_ORDER, PARTS, partText, sourceLine, SOURCES, type Basis, type PartId } from './parts';

// ---------- Story keyframes ----------

type Vec = [number, number, number];

interface Key {
  cam: Vec;
  target: Vec;
  explode: Partial<Record<PieceKey, number>>;
  /** Parts kept at full opacity; null means everything. */
  focus: PartId[] | null;
  /** Pieces hidden completely, e.g. a shell that would block the camera. */
  hide?: PieceKey[];
  /** How see-through the V851S package is drawn (0 solid, 1 x-ray), to show the memory inside it. */
  pkgXray?: number;
  /** Opacity for out-of-focus pieces, when DIM is too faint. */
  dim?: Partial<Record<PieceKey, number>>;
  labels: PartId[];
}

const ALL_APART: Partial<Record<PieceKey, number>> = {
  frontShell: 1,
  rearShell: 1,
  lensBoard: 1,
  lensHolder: 1,
  socBase: 1,
  dram: 1,
  socLid: 1,
  lcd: 1,
  supercap: 1,
};

const OPENED = { frontShell: 1.3, rearShell: 1, lensBoard: 1, lensHolder: 1, lcd: 0.6 };
const BOARD_VIEW: PieceKey[] = ['frontShell', 'lensHolder', 'lensBoard'];
const ALL_LABELS: PartId[] = ['shell', 'lens', 'soc', 'ddr', 'storage', 'power', 'board', 'lcd', 'supercap'];

const KEYS: Key[] = [
  { cam: [10.5, 5.8, 18], target: [0, 0.4, 0], explode: {}, focus: null, labels: [] },
  {
    cam: [17, 8, 17],
    target: [0, 0.2, 0],
    explode: { frontShell: 1, rearShell: 1 },
    focus: null,
    labels: ['shell'],
  },
  {
    cam: [10.5, 5, 13.5],
    target: [1.2, 0.2, 2.4],
    explode: { frontShell: 1.25, rearShell: 1, lensBoard: 1, lensHolder: 1 },
    focus: ['lens'],
    hide: ['frontShell'],
    labels: ['lens'],
  },
  {
    // The V851S lifts off its footprint, package solid: the marking reads.
    cam: [4.2, 3.4, 6.4],
    target: [-0.6, 0.25, 0.85],
    explode: { ...OPENED, socBase: 1, dram: 1, socLid: 1 },
    focus: ['soc', 'board'],
    hide: BOARD_VIEW,
    labels: ['soc'],
  },
  {
    // The package turns see-through: a block for the processor, one for the DDR2 (a diagram, not a
    // decapped chip; see model.ts). Storage lifts next to it.
    cam: [3.7, 2.9, 8.1],
    target: [0.2, 0.4, 0.7],
    explode: { ...OPENED, socBase: 1, dram: 1, socLid: 1 },
    pkgXray: 1,
    focus: ['soc', 'ddr', 'storage', 'board'],
    hide: BOARD_VIEW,
    labels: ['ddr', 'storage'],
  },
  {
    // Power section: regulators, inductors, MOSFET, diodes.
    cam: [-0.9, 2.0, 6.6],
    target: [-2.2, 0.05, 0.25],
    explode: { ...OPENED },
    focus: ['power', 'board'],
    hide: BOARD_VIEW,
    labels: ['power'],
  },
  {
    cam: [-13.5, 5, -15.5],
    target: [0.3, -0.4, -3.4],
    explode: { frontShell: 1, rearShell: 1.25, lensBoard: 1, lensHolder: 1, socBase: 0.5, dram: 0.5, socLid: 0.5, lcd: 1, supercap: 1 },
    focus: ['lcd', 'supercap'],
    // The camera is behind the board here, so keep its bottom side readable.
    dim: { board: 0.6 },
    labels: ['lcd', 'supercap'],
  },
  {
    cam: [25, 10.5, 19],
    target: [0, 0, -0.5],
    explode: ALL_APART,
    pkgXray: 1,
    focus: null,
    labels: ALL_LABELS,
  },
  {
    cam: [21, 9, 21],
    target: [0, 0, -0.5],
    explode: ALL_APART,
    pkgXray: 1,
    focus: null,
    labels: ALL_LABELS,
  },
];
const FREE_STEP = KEYS.length - 1;

/** Which piece carries the label for each part. */
const LABEL_PIECE: Record<PartId, PieceKey> = {
  shell: 'frontShell',
  lens: 'lensHolder',
  soc: 'socLid',
  ddr: 'dram',
  storage: 'storage',
  power: 'power',
  board: 'board',
  lcd: 'lcd',
  supercap: 'supercap',
};

const DEF_BY_REF = new Map(COMPONENTS.map((c) => [c.ref, c]));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Colours come from the tokens in style.css, so the scene and the page share one palette. */
const rootStyle = getComputedStyle(document.documentElement);
const token = (name: string) => rootStyle.getPropertyValue(name).trim();
const ACCENT = token('--accent');
const INK = token('--ink');
const SOURCE_COLOR = (b: Basis) => token(`--src-${b}`);

// ---------- Renderer, scene, camera ----------

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.85;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

const key = new THREE.DirectionalLight(0xfff6ea, 2.2);
key.position.set(6, 12, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -12;
key.shadow.camera.right = 12;
key.shadow.camera.top = 12;
key.shadow.camera.bottom = -12;
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
rim.position.set(-8, 4, -10);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dccb, 0.35));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.13 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -3.6;
ground.receiveShadow = true;
scene.add(ground);

const { root, pieces } = buildDashcam();
scene.add(root);
const pieceByKey = new Map<PieceKey, Piece>(pieces.map((p) => [p.key, p]));

for (const p of pieces) {
  for (const m of p.materials) {
    m.transparent = true;
    m.userData.baseEmissive = m.emissive.clone();
    m.userData.baseEmissiveIntensity = m.emissiveIntensity;
  }
}

// ---------- Free rotation (works at every scroll position) ----------
// The user's drag is stored as a yaw / pitch offset and applied on top of the
// scroll-driven camera, so the story keeps moving while the view stays theirs.
const orbit = { yaw: 0, pitch: 0, yawGoal: 0, pitchGoal: 0, dragging: false, lastX: 0, lastY: 0, pointerId: -1 };
const spherical = new THREE.Spherical();
const offset = new THREE.Vector3();
const viewTarget = new THREE.Vector3();

function resetView() {
  orbit.yawGoal = 0;
  orbit.pitchGoal = 0;
  setZoom(1);
}

/** How far the free orbit may tilt; free play keeps it shallower so the board never goes edge-on. */
function pitchLimit() {
  return stepTarget > KEYS.length - 1.35 ? 0.7 : 1.1;
}

// ---------- Layout ----------

let isMobile = false;
/**
 * The story framing was set for a viewer a little wider than it is tall (1880 x 1000 with the
 * text column). A narrower viewer (1440 x 900, a 4:3 window, a landscape iPad) pulls the camera
 * back by the same ratio, so the exploded model clears the chapter dots and the left edge.
 */
const VIEWER_ASPECT = 1.1;
let viewerFit = 1;

/** Width of the text column on the right (desktop). Keep in sync with --column in style.css. */
function columnWidth(w: number) {
  return THREE.MathUtils.clamp(w * 0.36, 400, 720);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Phones, and tablets held upright, stack the model above the text (matches style.css).
  isMobile = w <= 760 || (w <= 1024 && h > w);
  viewerFit = isMobile ? 1 : Math.max(1, VIEWER_ASPECT / ((w - columnWidth(w)) / h));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = isMobile ? 42 : 30;
  // Centre the model in the viewer: left of the text column on desktop, above the text on mobile.
  if (isMobile) {
    const shift = h * 0.42;
    camera.setViewOffset(w, h + shift, 0, shift, w, h);
  } else {
    const shift = columnWidth(w);
    camera.setViewOffset(w + shift, h, shift, 0, w, h);
  }
  camera.updateProjectionMatrix();
  layoutLabels();
  fitTitle();
}

// ---------- Headline ----------
// The headline is two fixed lines. CSS sets the largest size it may take; this shrinks it until the
// longer line fits the real column in the font that actually loaded (Switzer, Noto Sans SC or a
// system fallback), so a line never wraps into a third one or runs past the edge.

const h1 = document.querySelector<HTMLElement>('h1')!;
function fitTitle() {
  h1.style.removeProperty('font-size');
  const lines = [...h1.querySelectorAll<HTMLElement>('.h1-line')];
  if (!lines.length) return;
  const room = h1.clientWidth;
  const widest = Math.max(...lines.map((l) => l.scrollWidth));
  if (widest > room) {
    const size = parseFloat(getComputedStyle(h1).fontSize) * (room / widest) * 0.995;
    h1.style.fontSize = `${size.toFixed(2)}px`;
  }
}
document.fonts?.ready.then(fitTitle);
document.fonts?.addEventListener('loadingdone', fitTitle);

// ---------- Scroll → step ----------

const sections = [...document.querySelectorAll<HTMLElement>('.step')];
let stepTarget = 0;

// Step i starts when section i reaches the top of the viewport, so sections
// can have different heights (the last one is taller on phones).
function readScroll() {
  const y = window.scrollY;
  let s = 0;
  for (let i = 0; i < sections.length - 1; i++) {
    const top = sections[i].offsetTop;
    const next = sections[i + 1].offsetTop;
    if (y >= top) s = i + THREE.MathUtils.clamp((y - top) / (next - top), 0, 1);
  }
  stepTarget = THREE.MathUtils.clamp(s, 0, KEYS.length - 1);
  updateActive();
}
window.addEventListener('scroll', readScroll, { passive: true });

const progress = document.querySelector<HTMLElement>('.progress')!;
// On phones the dots carry no names, so each chapter's text opens with "05 / 09 · Memory + storage".
const chapterTags = sections.map((sec, i) => {
  if (i === 0) return null;
  const tag = document.createElement('p');
  tag.className = 'chapter-tag';
  sec.querySelector('.copy')!.prepend(tag);
  return tag;
});
// Each dot names its chapter and sums it up on hover or keyboard focus.
const dots = sections.map((sec) => {
  const b = document.createElement('button');
  b.type = 'button';
  const tip = document.createElement('span');
  tip.className = 'progress__tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.append(document.createElement('strong'), document.createElement('span'));
  b.append(tip);
  b.addEventListener('click', () => sec.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }));
  progress.appendChild(b);
  return b;
});
onLang(() => {
  dots.forEach((b, i) => {
    const sec = sections[i];
    const name = lang === 'zh' ? NAV_ZH[i] : (sec.dataset.nav ?? '');
    const summary = sec.querySelector('h1, h2')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    b.setAttribute('aria-label', `${name}${lang === 'zh' ? '：' : ': '}${summary}`);
    b.querySelector('.progress__tip > strong')!.textContent = name;
    b.querySelector('.progress__tip > span')!.textContent = summary;
    wrapPhrases(b.querySelector('.progress__tip > span')!);
    const tag = chapterTags[i];
    if (tag) tag.textContent = t().chapter(i + 1, sections.length, name);
  });
});

// The active chapter follows the same scroll position as the camera, so the text, the dots and the
// model always agree, however tall a chapter grows on a small screen.
let activeIndex = -1;
function updateActive() {
  const i = Math.round(stepTarget);
  if (i === activeIndex) return;
  activeIndex = i;
  sections.forEach((s, j) => s.classList.toggle('is-active', i === j));
  dots.forEach((d, j) => d.setAttribute('aria-current', String(i === j)));
}

// ---------- Parts list ----------

const bom = document.querySelector<HTMLUListElement>('#bom')!;
const bomRows = PART_ORDER.map((part) => {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  const name = document.createElement('span');
  const tag = document.createElement('span');
  tag.className = `basis basis--${PARTS[part].basis}`;
  btn.append(name, tag);
  btn.addEventListener('click', () => focusPart(part));
  btn.addEventListener('mouseenter', () => (hoverPart = part));
  btn.addEventListener('mouseleave', () => (hoverPart = null));
  li.appendChild(btn);
  bom.appendChild(li);
  return { part, name, tag };
});
onLang(() => {
  for (const { part, name, tag } of bomRows) {
    name.textContent = partText(part).label;
    tag.textContent = basisLabel(PARTS[part].basis);
  }
  // A language switch rewrites the copy, source links included.
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-source]')) {
    const key = a.dataset.source as keyof typeof SOURCES;
    if (SOURCES[key]) a.href = SOURCES[key];
  }
});

// ---------- Free-play slider ----------

/** Paints the filled part of a range track. */
function paintRange(input: HTMLInputElement) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

const slider = document.querySelector<HTMLInputElement>('#explode')!;
let freeExplode = 1;
slider.addEventListener('input', () => {
  freeExplode = Number(slider.value) / 100;
  paintRange(slider);
});
paintRange(slider);

// Zoom scales the camera distance everywhere: story steps, free play and a focused part.
const zoomInput = document.querySelector<HTMLInputElement>('#zoom')!;
const zoomValue = document.querySelector<HTMLOutputElement>('#zoom-value')!;
const ZOOM_MIN = Number(zoomInput.min) / 100;
const ZOOM_MAX = Number(zoomInput.max) / 100;
let zoomGoal = 1;
let zoomNow = 1;

function setZoom(z: number) {
  zoomGoal = THREE.MathUtils.clamp(z, ZOOM_MIN, ZOOM_MAX);
  zoomInput.value = String(Math.round(zoomGoal * 100));
  zoomValue.textContent = `${Math.round(zoomGoal * 100)}%`;
  paintRange(zoomInput);
}
zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value) / 100));
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
  b.addEventListener('click', () => setZoom(Math.round((zoomGoal + Number(b.dataset.zoom) * 0.25) * 4) / 4));
}
setZoom(1);

// ---------- Labels ----------

const labelLayer = document.querySelector<HTMLDivElement>('#labels')!;
const leaderSvg = document.querySelector<SVGSVGElement>('#leaders')!;
const SVGNS = 'http://www.w3.org/2000/svg';

interface Label {
  part: PartId;
  el: HTMLButtonElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
  opacity: number;
  /** Whether another solid part sits between the camera and the anchor (rechecked every few frames). */
  blocked: boolean;
}

const labels: Label[] = (Object.keys(PARTS) as PartId[]).map((part) => {
  const el = document.createElement('button');
  el.type = 'button';
  // The dot in each pill, and at the end of its leader, shows where the part comes from.
  el.className = `label label--${PARTS[part].basis}`;
  el.tabIndex = -1;
  el.setAttribute('aria-hidden', 'true');
  el.style.opacity = '0';
  el.addEventListener('click', () => focusPart(part));
  labelLayer.appendChild(el);
  const line = document.createElementNS(SVGNS, 'line');
  line.setAttribute('stroke', INK);
  line.setAttribute('stroke-width', '1');
  const dot = document.createElementNS(SVGNS, 'circle');
  dot.setAttribute('r', '3.5');
  dot.setAttribute('fill', SOURCE_COLOR(PARTS[part].basis));
  leaderSvg.append(line, dot);
  return { part, el, line, dot, opacity: 0, blocked: false };
});
onLang(() => {
  for (const l of labels) {
    l.el.textContent = partText(l.part).label;
    l.el.setAttribute('aria-label', t().show(partText(l.part).label));
  }
});

const copies = [...document.querySelectorAll<HTMLElement>('.copy')];
const tmp = new THREE.Vector3();
const center = new THREE.Vector3();
const anchorW = new THREE.Vector3();
const rayDir = new THREE.Vector3();
const sightRay = new THREE.Raycaster();
/** On phones the overview steps keep only the four big labels. */
const MOBILE_OVERVIEW: PartId[] = ['shell', 'soc', 'lens', 'lcd'];
let frameNo = 0;

/** True when a solid part other than `part` lies between the camera and `point`. */
function lineOfSightBlocked(point: THREE.Vector3, part: PartId) {
  const dist = camera.position.distanceTo(point);
  sightRay.set(camera.position, rayDir.subVectors(point, camera.position).normalize());
  sightRay.far = dist - 0.05;
  for (const hit of sightRay.intersectObjects(pickables, false)) {
    const piece = pieceByKey.get(hit.object.userData.piece as PieceKey);
    if (!piece || !piece.object.visible || opacityNow.get(piece.key)! <= 0.5) continue;
    if (piece.part === part) continue;
    return true;
  }
  return false;
}

/** Cosine between the screen's normal and the direction to the camera: > 0 on the picture side. */
function screenCos() {
  const lcd = pieceByKey.get('lcd')!;
  const n = rayDir.set(0, 0, -1).transformDirection(lcd.object.matrixWorld);
  const d = lcd.object.getWorldPosition(sightTarget).sub(camera.position).negate().normalize();
  return n.dot(d);
}

/** 1 when the camera faces the LCD (it shows the road), 0 when it doesn't. */
function screenFacing() {
  return pieceByKey.get('lcd')!.object.visible ? THREE.MathUtils.smoothstep(screenCos(), 0.72, 0.88) : 0;
}

function layoutLabels() {
  leaderSvg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
}

function updateLabels(step: number, dt: number) {
  // A window with no size (a hidden tab or iframe) has nothing to project onto.
  if (!window.innerWidth || !window.innerHeight) return;
  const nearest = Math.round(step);
  const near = 1 - Math.min(1, Math.abs(step - nearest) / 0.3);
  const visible = new Set(KEYS[nearest].labels);
  if (isMobile && nearest >= FREE_STEP - 1) for (const p of [...visible]) if (!MOBILE_OVERVIEW.includes(p)) visible.delete(p);
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Looking at the screen, labels would sit on the road picture: only the LCD keeps its pill.
  const facing = screenFacing();
  // On phones a label below the top of the text sheet would be covered by it.
  let sheetTop = h;
  if (isMobile) {
    for (const c of copies) {
      const r = c.getBoundingClientRect();
      if (r.bottom > 0 && r.top < sheetTop) sheetTop = Math.max(0, r.top - 40);
    }
  }

  // Screen-space centre of the model, used to push labels outward.
  center.copy(viewTarget).project(camera);
  const cx = (center.x * 0.5 + 0.5) * w;
  const cy = (-center.y * 0.5 + 0.5) * h;

  for (const l of labels) {
    let want = visible.has(l.part) ? near : 0;
    // In free play, labels for parts hidden inside the shell fade out as it closes.
    if (step > FREE_STEP - 0.35 && l.part !== 'shell' && l.part !== 'lens') {
      want *= THREE.MathUtils.clamp((freeExplode - 0.35) / 0.35, 0, 1);
    }
    // Zoomed in on one component: the part labels would only get in the way.
    want *= 1 - focusBlend;
    if (l.part !== 'lcd') want *= 1 - facing;
    const piece = pieceByKey.get(LABEL_PIECE[l.part])!;
    anchorW.copy(piece.anchor);
    piece.object.localToWorld(anchorW);
    // A label whose part is behind something else would point at the wrong thing.
    if (want > 0 && (frameNo + labels.indexOf(l)) % 3 === 0) l.blocked = lineOfSightBlocked(anchorW, l.part);
    if (l.blocked) want = 0;
    l.opacity += (want - l.opacity) * (1 - Math.exp(-dt * 10));
    tmp.copy(anchorW).project(camera);
    const ax = (tmp.x * 0.5 + 0.5) * w;
    const ay = (-tmp.y * 0.5 + 0.5) * h;

    let dx = ax - cx;
    let dy = ay - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const reach = isMobile ? 34 : 56;
    const lx = ax + dx * reach;
    const ly = ay + dy * reach - (isMobile ? 6 : 10);

    const rect = l.el.getBoundingClientRect();
    // Desktop keeps clear of the progress dots on the left edge.
    // Desktop keeps labels inside the viewer: clear of the chapter dots and the text column.
    const right = isMobile ? w - 12 : w - columnWidth(w) - 12;
    const boxX = THREE.MathUtils.clamp(dx >= 0 ? lx : lx - rect.width, isMobile ? 12 : 64, right - rect.width);
    const boxY = THREE.MathUtils.clamp(ly - rect.height / 2, 56, h - rect.height - 12);

    if (boxY + rect.height > sheetTop) l.opacity = Math.min(l.opacity, 0);
    const o = l.opacity < 0.01 ? 0 : l.opacity;
    // Only labels you can actually see take clicks, Tab stops and a place in the accessibility tree,
    // so a faded one never blocks the model or catches focus. One that holds focus stays live.
    const live = o > 0.3 || document.activeElement === l.el;
    if (l.el.classList.contains('is-live') !== live) {
      l.el.classList.toggle('is-live', live);
      l.el.tabIndex = live ? 0 : -1;
      l.el.setAttribute('aria-hidden', String(!live));
    }
    l.el.style.opacity = String(o);
    l.el.style.transform = `translate(${boxX.toFixed(1)}px, ${boxY.toFixed(1)}px)`;
    l.line.setAttribute('x1', ax.toFixed(1));
    l.line.setAttribute('y1', ay.toFixed(1));
    l.line.setAttribute('x2', (dx >= 0 ? boxX : boxX + rect.width).toFixed(1));
    l.line.setAttribute('y2', (boxY + rect.height / 2).toFixed(1));
    // Facing the screen, the LCD keeps its pill but drops the leader so nothing lands on the picture.
    const leader = l.part === 'lcd' ? o * (1 - facing) : o;
    l.line.setAttribute('opacity', String(leader));
    l.dot.setAttribute('cx', ax.toFixed(1));
    l.dot.setAttribute('cy', ay.toFixed(1));
    l.dot.setAttribute('opacity', String(leader));
  }
}

// ---------- Part card ----------

const card = document.querySelector<HTMLElement>('#part-card')!;
const cardName = document.querySelector<HTMLElement>('#part-name')!;
const cardKicker = document.querySelector<HTMLElement>('#part-kicker')!;
const cardWhat = document.querySelector<HTMLElement>('#part-what')!;
const cardWhy = document.querySelector<HTMLElement>('#part-why')!;
const cardSpec = document.querySelector<HTMLElement>('#part-spec')!;
const cardSpecLabel = document.querySelector<HTMLElement>('#part-spec-label')!;
const cardWhatLabel = document.querySelector<HTMLElement>('#part-what-label')!;
const cardWhyLabel = document.querySelector<HTMLElement>('#part-why-label')!;
const cardBoardLabel = document.querySelector<HTMLElement>('#part-board-label')!;
const cardBoard = document.querySelector<HTMLElement>('#part-board')!;
const cardBody = card.querySelector<HTMLElement>('.part-card__body')!;
const story = document.querySelector<HTMLElement>('#story')!;
const viewerBar = document.querySelector<HTMLElement>('.viewer-bar')!;
let selectedPart: PartId | null = null;
/** Where keyboard focus came from when the card opened, so closing it can go back there. */
let returnFocus: HTMLElement | null = null;
/** Redraws the open card, so a language switch reaches it too. */
let renderCard: (() => void) | null = null;

interface CardText {
  basis: Basis;
  kicker: string;
  name: string;
  whatLabel: string;
  what: string;
  whyLabel: string;
  why: string;
  /** Component cards only: the matching part on the reference board. */
  boardLabel?: string;
  board?: string;
  specLabel: string;
  spec: string;
}

/** Keeps a number with its unit, both sides of a ×, and a package name ("LGA-8") on one line. */
const keepUnits = (s: string) =>
  s
    .replace(/(\d) (?=×|(?:MHz|mm|MB|TOPS|V|µH|pF|nF|µF|kΩ|Ω|°C|fps|MP)(?![A-Za-z0-9]))/g, '$1 ')
    .replace(/× (?=\d)/g, '× ')
    .replace(/\b([A-Z]{2,}-)(?=\d)/g, '$1⁠');

function showCard(c: CardText) {
  cardKicker.textContent = c.kicker;
  cardKicker.dataset.basis = c.basis;
  cardName.textContent = keepUnits(c.name);
  // A part number (no spaces) must not break at its own hyphens.
  cardName.style.whiteSpace = /\s/.test(c.name) ? '' : 'nowrap';
  cardWhatLabel.textContent = c.whatLabel;
  cardWhat.textContent = keepUnits(c.what);
  cardWhyLabel.textContent = c.whyLabel;
  cardWhy.textContent = keepUnits(c.why);
  cardBoardLabel.hidden = cardBoard.hidden = !c.board;
  cardBoardLabel.textContent = c.boardLabel ?? '';
  cardBoard.textContent = keepUnits(c.board ?? '');
  cardSpecLabel.textContent = c.specLabel;
  cardSpec.textContent = keepUnits(c.spec);
  for (const el of [cardName, cardWhat, cardWhy, cardBoard, cardSpec]) wrapPhrases(el);
  card.hidden = false;
  updateCardMore();
}

/** Whether the card body can scroll further down (or up). */
function cardCanScroll(down: boolean) {
  return down ? cardBody.scrollTop + cardBody.clientHeight < cardBody.scrollHeight - 1 : cardBody.scrollTop > 0;
}

/** Soft fades at the edges while there is more to read below (or above, under the close button). */
function updateCardMore() {
  card.classList.toggle('has-more', cardCanScroll(true));
  card.classList.toggle('is-scrolled', cardCanScroll(false));
}
cardBody.addEventListener('scroll', updateCardMore, { passive: true });

// Scrolling inside the card must never scroll the page: that would move the story on a chapter and
// close the card. At either end of the card's own scroll, the wheel or swipe simply stops.
card.addEventListener('wheel', (e) => {
  if (!cardCanScroll(e.deltaY > 0)) e.preventDefault();
}, { passive: false });
let touchY = 0;
card.addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true });
card.addEventListener('touchmove', (e) => {
  const y = e.touches[0].clientY;
  // A move with no distance says nothing about direction; cancelling it would kill the whole swipe.
  if (y === touchY) return;
  const down = y < touchY;
  touchY = y;
  // Once the swipe is scrolling, the browser won't let it be cancelled; overscroll-behavior: contain
  // on the body keeps it from spilling over to the page from then on.
  if (e.cancelable && !cardCanScroll(down)) e.preventDefault();
}, { passive: false });

// Focus moves to the card heading on every open, but its ring only shows to keyboard users: after
// a click or a tap, the browser would otherwise draw it around the title.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') document.documentElement.classList.add('kbd');
});
window.addEventListener('pointerdown', () => document.documentElement.classList.remove('kbd'));

/** Before opening a card: the element to return focus to (kept when one card replaces another). */
function triggerBeforeOpen() {
  if (!card.hidden) return returnFocus;
  const a = document.activeElement;
  return a instanceof HTMLElement && a !== document.body ? a : null;
}

/**
 * After opening a card: the text behind it is hidden, so it leaves the Tab order (inert) and focus
 * moves to the card's heading. The model, toolbar, chapter dots and top bar stay usable.
 */
function enterCard(trigger: HTMLElement | null, fresh: boolean) {
  returnFocus = trigger;
  story.inert = true;
  if (fresh) cardBody.scrollTop = 0;
  updateCardMore();
  cardName.focus({ preventScroll: true });
}

function showPartCard(part: PartId) {
  renderCard = () => {
    const { basis } = PARTS[part];
    const text = partText(part);
    showCard({
      basis,
      kicker: text.source ?? sourceLine(basis),
      name: text.name,
      whatLabel: t().whatLabel,
      what: text.what,
      whyLabel: t().whyLabel,
      why: text.why,
      specLabel: t().specLabel,
      spec: text.spec,
    });
  };
  renderCard();
}

onLang(() => {
  if (!card.hidden) renderCard?.();
});

// ---------- Focus ----------
// Clicking a component, a label or a part flies the camera to it and pins the card beside it.
// While focused, dragging only tilts the view inside a cone around the face being inspected,
// so you can look around a part but never end up behind the board.

interface Focus {
  piece: Piece;
  /** Point to look at, in the piece's local space. */
  local: THREE.Vector3;
  dist: number;
  /** Outward normal of the face being inspected, in the piece's local space. */
  normal: THREE.Vector3;
  /** Pieces kept at full opacity while focused, even if the current step hides them. */
  reveal: PieceKey[];
  /** Component being inspected, if any: its own meshes never count as blocking the view. */
  ref?: string;
  /** Largest clear tilt off the normal for each of TILT_SAMPLES azimuths (component focus only). */
  tiltLimit?: number[];
}

let focus: Focus | null = null;
/** Kept after closing so the camera can ease back out. */
let lastFocus: Focus | null = null;
let focusBlend = 0;
const focusPoint = new THREE.Vector3();
let selMarkerRef = '';

/** Drag offsets while focused, separate from the story orbit. */
const look = { yaw: 0, pitch: 0, yawGoal: 0, pitchGoal: 0 };
const LOOK_YAW = THREE.MathUtils.degToRad(40);
const LOOK_PITCH = THREE.MathUtils.degToRad(30);
const MAX_TILT = THREE.MathUtils.degToRad(55);
/** Phones show less around the target, so the focused camera sits further back. */
const MOBILE_FOCUS = 1.7;

const Z_UP = new THREE.Vector3(0, 0, 1);
const Z_DOWN = new THREE.Vector3(0, 0, -1);

/** The face each piece shows off: shells and parts face out, the screen and supercaps face the back. */
const PIECE_NORMAL: Record<PieceKey, THREE.Vector3> = {
  frontShell: Z_UP,
  rearShell: Z_DOWN,
  lensBoard: Z_UP,
  lensHolder: Z_UP,
  board: Z_UP,
  power: Z_UP,
  storage: Z_UP,
  socBase: Z_UP,
  dram: Z_UP,
  socLid: Z_UP,
  lcd: Z_DOWN,
  supercap: Z_DOWN,
};
const TILT_SAMPLES = 16;
const TILT_STEP = THREE.MathUtils.degToRad(5);

/** Two unit vectors spanning the plane perpendicular to n (n is a unit vector). */
function basisFor(n: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3) {
  u.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0);
  u.addScaledVector(n, -u.dot(n)).normalize();
  w.crossVectors(n, u);
}

/** True when a hit belongs to the component `ref` itself. */
function isOwnHit(hit: THREE.Intersection, ref?: string) {
  if (!ref) return false;
  if (hit.object.userData.comp === ref) return true;
  const byInstance = hit.object.userData.compByInstance as string[] | undefined;
  return !!byInstance && hit.instanceId !== undefined && byInstance[hit.instanceId] === ref;
}

/**
 * For each azimuth around the face normal, the largest tilt (up to MAX_TILT) at which the
 * component can be seen without a taller neighbour on the same piece getting in the way.
 * Other pieces are handled by the x-ray instead.
 */
const tiltRay = new THREE.Raycaster();
function tiltLimits(piece: Piece, local: THREE.Vector3, normal: THREE.Vector3, dist: number, ref: string) {
  const u = new THREE.Vector3();
  const w = new THREE.Vector3();
  basisFor(normal, u, w);
  piece.object.updateWorldMatrix(true, true);
  const origin = piece.object.localToWorld(local.clone());
  const dir = new THREE.Vector3();
  const limits: number[] = [];
  tiltRay.far = dist;
  for (let i = 0; i < TILT_SAMPLES; i++) {
    const a = (i / TILT_SAMPLES) * Math.PI * 2;
    let limit = 0;
    for (let t = MAX_TILT; t > 0; t -= TILT_STEP) {
      dir.copy(normal).multiplyScalar(Math.cos(t));
      dir.addScaledVector(u, Math.cos(a) * Math.sin(t)).addScaledVector(w, Math.sin(a) * Math.sin(t));
      dir.transformDirection(piece.object.matrixWorld);
      tiltRay.set(origin, dir);
      if (!tiltRay.intersectObjects(piece.meshes, false).some((h) => !isOwnHit(h, ref))) {
        limit = t;
        break;
      }
    }
    limits.push(limit);
  }
  return limits;
}

/** Clamps a world-space view direction to the focus's per-azimuth tilt limits. */
const limitU = new THREE.Vector3();
const limitW = new THREE.Vector3();
const limitN = new THREE.Vector3();
const limitQ = new THREE.Quaternion();
function applyTiltLimit(f: Focus, dir: THREE.Vector3) {
  if (!f.tiltLimit) return;
  f.piece.object.getWorldQuaternion(limitQ);
  dir.applyQuaternion(limitQ.invert());
  limitN.copy(f.normal);
  basisFor(limitN, limitU, limitW);
  const tilt = Math.acos(THREE.MathUtils.clamp(dir.dot(limitN), -1, 1));
  let az = Math.atan2(dir.dot(limitW), dir.dot(limitU));
  if (az < 0) az += Math.PI * 2;
  const x = (az / (Math.PI * 2)) * TILT_SAMPLES;
  const i = Math.floor(x) % TILT_SAMPLES;
  const j = (i + 1) % TILT_SAMPLES;
  // Use the tighter neighbour so the clamp never peeks past an edge between samples.
  const max = Math.min(f.tiltLimit[i], f.tiltLimit[j]);
  if (tilt > max) {
    dir.copy(limitN).multiplyScalar(Math.cos(max));
    dir.addScaledVector(limitU, Math.cos(az) * Math.sin(max)).addScaledVector(limitW, Math.sin(az) * Math.sin(max));
  }
  dir.applyQuaternion(limitQ.invert());
}

/** Pieces worth inspecting from either side: pick the side the camera is on. */
const TWO_SIDED: PieceKey[] = ['board'];

function makeMarker(color: number, opacity: number) {
  const m = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
  );
  m.renderOrder = 10;
  m.visible = false;
  return m;
}
const selMarker = makeMarker(new THREE.Color(ACCENT).getHex(), 1);
const hoverMarker = makeMarker(new THREE.Color(INK).getHex(), 0.55);

/** Puts a marker box around a component and returns its centre, size and face normal in piece space. */
function placeMarker(marker: THREE.LineSegments, ref: string, piece: Piece, fallback: THREE.Vector3) {
  const def = DEF_BY_REF.get(ref);
  if (!def) {
    marker.visible = false;
    return { local: piece.object.worldToLocal(fallback.clone()), size: 0.3, normal: PIECE_NORMAL[piece.key] };
  }
  const [bx, by, bz] = bodySize(def.kind);
  const bottom = def.side === 'bottom';
  // Board-mounted parts sit on the top (or bottom) copper; the power and storage groups start at it.
  const z0 = piece.key === 'board' ? (bottom ? -BOARD_T / 2 : BOARD_T / 2) : 0;
  const local = new THREE.Vector3(def.x, def.y, z0 + (bottom ? -bz / 2 : bz / 2));
  piece.object.add(marker);
  marker.position.copy(local);
  marker.rotation.set(0, 0, THREE.MathUtils.degToRad(def.rot ?? 0));
  marker.scale.set(bx + 0.04, by + 0.04, bz + 0.02);
  marker.visible = true;
  return { local, size: Math.max(bx, by), normal: bottom ? Z_DOWN : Z_UP };
}

const pieceBox = new THREE.Box3();

/** World-space bounds of a piece's own meshes (not markers or overlays). */
function boundsOf(piece: Piece) {
  pieceBox.makeEmpty();
  piece.object.updateWorldMatrix(true, true);
  for (const m of piece.meshes) pieceBox.expandByObject(m);
  return pieceBox;
}

const leaderLine = document.createElementNS(SVGNS, 'line');
leaderLine.setAttribute('stroke', ACCENT);
leaderLine.setAttribute('stroke-width', '1.25');
const leaderDot = document.createElementNS(SVGNS, 'circle');
leaderDot.setAttribute('r', '4');
leaderDot.setAttribute('fill', ACCENT);
leaderSvg.append(leaderLine, leaderDot);

function startFocus(f: Focus) {
  focus = f;
  lastFocus = f;
  look.yawGoal = 0;
  look.pitchGoal = 0;
  hoverMarker.visible = false;
  card.classList.add('part-card--beside');
  document.body.classList.add('is-focused');
}

function openComp(ref: string, part: PartId, piece: Piece, point: THREE.Vector3) {
  const trigger = triggerBeforeOpen();
  const fresh = card.hidden === true || selMarkerRef !== ref;
  closeCard();
  const def = DEF_BY_REF.get(ref);
  const { local, size, normal } = placeMarker(selMarker, ref, piece, point);
  selMarkerRef = ref;
  renderCard = () => {
    const c = compInfo(ref);
    showCard({
      basis: c.basis,
      kicker: t().kicker(ref, sourceLine(c.basis)),
      name: c.part,
      whatLabel: t().roleLabel,
      what: c.role,
      whyLabel: t().pkgLabel,
      why: c.pkg,
      boardLabel: t().boardLabel,
      board: c.board,
      specLabel: t().partOfLabel,
      spec: def?.side === 'bottom' ? t().bottomSide : partText(part).name,
    });
  };
  renderCard();
  const dist = THREE.MathUtils.clamp(size * 8, 1.7, 5);
  startFocus({ piece, local, dist, normal: normal.clone(), reveal: [piece.key], ref, tiltLimit: tiltLimits(piece, local, normal, dist, ref) });
  enterCard(trigger, fresh);
}

/** Flies to a whole part: from its label, the parts list, or a click on it. */
function focusPart(part: PartId, piece = pieceByKey.get(LABEL_PIECE[part])!) {
  const trigger = triggerBeforeOpen();
  const fresh = card.hidden === true || selectedPart !== part;
  closeCard();
  const box = boundsOf(piece);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const normal = PIECE_NORMAL[piece.key].clone();
  if (TWO_SIDED.includes(piece.key)) {
    // Look at whichever side of the board the camera is already on.
    tmp.copy(normal).transformDirection(piece.object.matrixWorld);
    if (tmp.dot(offset.copy(camera.position).sub(center)) < 0) normal.negate();
  }
  selectedPart = part;
  showPartCard(part);
  startFocus({
    piece,
    local: piece.object.worldToLocal(center.clone()),
    // Bounding-box diagonal, so small but deep parts (the lens) still get some room.
    dist: THREE.MathUtils.clamp(size.length() * 2.2, 2.5, 9),
    normal,
    reveal: piece.key === 'socLid' ? ['socLid', 'socBase', 'dram'] : [piece.key],
  });
  enterCard(trigger, fresh);
}

/**
 * Closes the card. `restore` (Esc, the close button, a tap on empty space) sends focus back to what
 * opened it; a close caused by scrolling to another chapter leaves focus alone.
 */
function closeCard(restore = false) {
  const wasOpen = !card.hidden;
  const hadFocus = card.contains(document.activeElement);
  card.hidden = true;
  story.inert = false;
  if (wasOpen) {
    const back = returnFocus;
    returnFocus = null;
    if (restore && back?.isConnected) back.focus({ preventScroll: true });
    else if (hadFocus) (document.activeElement as HTMLElement).blur();
  }
  selectedPart = null;
  focus = null;
  selMarker.visible = false;
  look.yawGoal = 0;
  look.pitchGoal = 0;
  card.classList.remove('part-card--beside');
  card.style.removeProperty('left');
  card.style.removeProperty('top');
  card.style.removeProperty('max-height');
  document.body.classList.remove('is-focused');
}

card.querySelector('.part-card__close')!.addEventListener('click', () => closeCard(true));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !card.hidden) closeCard(true);
});

/** Keeps the card next to the focused component, with a leader line to it. */
function updateFocusCard() {
  if (!window.innerWidth || !window.innerHeight) return;
  const show = focus && !card.hidden ? focusBlend : 0;
  leaderLine.setAttribute('opacity', String(show));
  leaderDot.setAttribute('opacity', String(show));
  if (!focus || card.hidden) return;
  tmp.copy(focusPoint).project(camera);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const sx = (tmp.x * 0.5 + 0.5) * w;
  const sy = (-tmp.y * 0.5 + 0.5) * h;
  leaderDot.setAttribute('cx', sx.toFixed(1));
  leaderDot.setAttribute('cy', sy.toFixed(1));
  if (isMobile) {
    // Phones keep the card as a bottom sheet; the line points down to it. A card placed beside a
    // part before the window turned narrow drops its desktop position.
    card.style.removeProperty('left');
    card.style.removeProperty('top');
    card.style.removeProperty('max-height');
    const top = card.getBoundingClientRect().top;
    leaderLine.setAttribute('x1', sx.toFixed(1));
    leaderLine.setAttribute('y1', sy.toFixed(1));
    leaderLine.setAttribute('x2', sx.toFixed(1));
    leaderLine.setAttribute('y2', top.toFixed(1));
    return;
  }
  const gap = Math.min(200, w * 0.14);
  const width = card.offsetWidth;
  // Right of the part when it fits, otherwise left of it.
  const maxLeft = w - width - 16;
  let left = sx + gap;
  if (left > maxLeft && sx - gap - width >= 16) left = sx - gap - width;
  left = THREE.MathUtils.clamp(left, 16, Math.max(16, maxLeft));
  // The card stays between the top bar and the bottom edge, and above the zoom toolbar where the two
  // would overlap (a short landscape window), so zoom and reset stay usable while it is open.
  const bar = viewerBar.getBoundingClientRect();
  const floor = left < bar.right && left + width > bar.left ? bar.top - 10 : h - 16;
  const room = Math.max(160, floor - 64);
  const cap = `${room.toFixed(0)}px`;
  if (card.style.maxHeight !== cap) card.style.maxHeight = cap;
  const rect = card.getBoundingClientRect();
  const top = THREE.MathUtils.clamp(sy - rect.height / 2, 64, Math.max(64, floor - rect.height));
  card.style.left = `${left.toFixed(1)}px`;
  card.style.top = `${top.toFixed(1)}px`;
  leaderLine.setAttribute('x1', sx.toFixed(1));
  leaderLine.setAttribute('y1', sy.toFixed(1));
  leaderLine.setAttribute('x2', left.toFixed(1));
  leaderLine.setAttribute('y2', THREE.MathUtils.clamp(sy, top + 24, top + rect.height - 24).toFixed(1));
}

// ---------- Picking ----------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pickables = pieces.flatMap((p) => p.meshes);
let hoverPart: PartId | null = null;
let downAt = { x: 0, y: 0 };
/** Set once a press has moved past TAP_SLOP: it is a drag, even if it ends back where it started. */
let dragged = false;

interface Hit {
  part: PartId;
  piece: Piece;
  point: THREE.Vector3;
  comp?: string;
}

function pick(clientX: number, clientY: number): Hit | null {
  const r = canvas.getBoundingClientRect();
  pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  for (const hit of raycaster.intersectObjects(pickables, false)) {
    const key = hit.object.userData.piece as PieceKey | undefined;
    if (!key) continue;
    const piece = pieceByKey.get(key)!;
    // Skip parts that are faded out of focus.
    if (!piece.object.visible || (piece.materials[0]?.opacity ?? 1) < 0.5) continue;
    const byInstance = hit.object.userData.compByInstance as string[] | undefined;
    const comp = (hit.object.userData.comp as string | undefined) ?? (byInstance && hit.instanceId !== undefined ? byInstance[hit.instanceId] : undefined);
    return { part: piece.part, piece, point: hit.point.clone(), comp };
  }
  return null;
}

canvas.addEventListener('pointerdown', (ev) => {
  downAt = { x: ev.clientX, y: ev.clientY };
  dragged = false;
  orbit.dragging = true;
  orbit.pointerId = ev.pointerId;
  orbit.lastX = ev.clientX;
  orbit.lastY = ev.clientY;
  if (ev.pointerType === 'mouse') {
    canvas.setPointerCapture(ev.pointerId);
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', (ev) => {
  if (orbit.dragging && ev.pointerId === orbit.pointerId) {
    if (Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > TAP_SLOP) {
      dragged = true;
      cancelPendingTap();
    }
    const dx = ev.clientX - orbit.lastX;
    const dy = ev.clientY - orbit.lastY;
    orbit.lastX = ev.clientX;
    orbit.lastY = ev.clientY;
    // On touch, vertical swipes scroll the page, so only mice tilt the view.
    const tilt = ev.pointerType === 'mouse';
    if (focus) {
      look.yawGoal = THREE.MathUtils.clamp(look.yawGoal - dx * 0.006, -LOOK_YAW, LOOK_YAW);
      if (tilt) look.pitchGoal = THREE.MathUtils.clamp(look.pitchGoal + dy * 0.005, -LOOK_PITCH, LOOK_PITCH);
    } else {
      orbit.yawGoal -= dx * 0.006;
      if (tilt) orbit.pitchGoal = THREE.MathUtils.clamp(orbit.pitchGoal + dy * 0.005, -pitchLimit(), pitchLimit());
    }
    hoverPart = null;
    hoverMarker.visible = false;
    return;
  }
  if (ev.pointerType !== 'mouse') return;
  const h = pick(ev.clientX, ev.clientY);
  // A component under the cursor gets its own outline; otherwise the whole part lights up.
  hoverPart = h && !h.comp && !focus ? h.part : null;
  if (h?.comp && !(focus && h.comp === selMarkerRef)) placeMarker(hoverMarker, h.comp, h.piece, h.point);
  else hoverMarker.visible = false;
  canvas.style.cursor = h ? (h.comp ? 'zoom-in' : 'pointer') : 'grab';
  canvas.title = h?.comp ? `${h.comp} · ${compInfo(h.comp).part}` : '';
});

function endDrag(ev: PointerEvent) {
  if (ev.pointerId !== orbit.pointerId) return;
  orbit.dragging = false;
  if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  canvas.style.cursor = 'grab';
}

// One tap (mouse, touch or pen) selects what is under it; two quick taps reset the view instead.
// Both come from pointer events, so no click or dblclick handler can fire a second time. A single
// tap waits DOUBLE_TAP_MS to make sure no second one follows; a drag never selects anything.
const TAP_SLOP = 6;
const DOUBLE_TAP_MS = 260;
let pendingTap: { x: number; y: number; t: number; timer: number } | null = null;

function cancelPendingTap() {
  if (pendingTap) window.clearTimeout(pendingTap.timer);
  pendingTap = null;
}

function selectHit(h: Hit | null) {
  if (h?.comp) openComp(h.comp, h.part, h.piece, h.point);
  else if (h) focusPart(h.part, h.piece);
  else closeCard(true);
}

canvas.addEventListener('pointerup', (ev) => {
  endDrag(ev);
  if (dragged || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > TAP_SLOP) return;
  const now = performance.now();
  const second = pendingTap && now - pendingTap.t < DOUBLE_TAP_MS && Math.hypot(ev.clientX - pendingTap.x, ev.clientY - pendingTap.y) < 24;
  cancelPendingTap();
  if (second) {
    resetCurrentView();
    return;
  }
  // Pick now, while the view is where the tap landed; act once it's clear this isn't a double tap.
  const h = pick(ev.clientX, ev.clientY);
  pendingTap = {
    x: ev.clientX,
    y: ev.clientY,
    t: now,
    timer: window.setTimeout(() => {
      pendingTap = null;
      selectHit(h);
    }, DOUBLE_TAP_MS),
  };
});
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => {
  hoverPart = null;
  hoverMarker.visible = false;
});
/**
 * Double-click, double-tap and the reset button: rotation and zoom go back to the default. With a
 * part open, the view returns to the part's default angle and the card stays open.
 */
function resetCurrentView() {
  if (focus) {
    look.yawGoal = 0;
    look.pitchGoal = 0;
    setZoom(1);
  } else resetView();
}
const resetButton = document.querySelector<HTMLButtonElement>('#reset-view')!;
resetButton.addEventListener('click', resetCurrentView);
onLang(() => (resetButton.title = resetButton.getAttribute('aria-label') ?? ''));

// ---------- Animation ----------

const currentCam = new THREE.Vector3(...KEYS[0].cam);
const currentTarget = new THREE.Vector3(...KEYS[0].target);
const goalCam = new THREE.Vector3();
const goalTarget = new THREE.Vector3();
const explodeNow = new Map<PieceKey, number>(pieces.map((p) => [p.key, 0]));
const opacityNow = new Map<PieceKey, number>(pieces.map((p) => [p.key, 1]));
let pkgNow = 0;
let step = 0;
let lastStoryStep = -1;

const smooth = (t: number) => t * t * (3 - 2 * t);

// ---------- X-ray: whatever blocks the view fades to an outline ----------
// In free play the shells and the LCD back fade when they hide the board. While a part is
// focused, any piece between the camera and it (or around the camera) fades, so no angle
// you can reach while inspecting something is ever blocked.

const XRAY_OPACITY = 0.12;
/** The see-through package keeps its marking faintly legible. */
const PKG_XRAY_OPACITY = 0.2;
const INK_RIM = new THREE.Color(0x2b2824);
const FREE_OCCLUDERS: PieceKey[] = ['frontShell', 'rearShell', 'lcd'];
interface Xray {
  amount: number;
  blocking: boolean;
  /** The camera sits inside this piece's bounds (story or free play, e.g. zoomed in). */
  inside: boolean;
  /** Hover / selection rim, 0–1. */
  glow: number;
  /** Bounds in the piece's own space, for the camera-inside test. */
  box: THREE.Box3;
  rim: THREE.ShaderMaterial;
  overlays: THREE.Mesh[];
}
const xray = new Map<PieceKey, Xray>();
const xrayBox = new THREE.Box3();
const sight = new THREE.Ray();
const sightTarget = new THREE.Vector3();
const boardCenter = new THREE.Vector3();
const camLocal = new THREE.Vector3();
const sightCaster = new THREE.Raycaster();
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();
const probe = new THREE.Vector3();

for (const piece of pieces) {
  // Fresnel rim: dark at grazing angles, clear face-on, so the outline survives the fade.
  const rim = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x2b2824) }, uOpacity: { value: 0 }, uPower: { value: 2.5 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uPower; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        gl_FragColor = vec4(uColor, f * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const box = new THREE.Box3();
  piece.object.updateWorldMatrix(true, true);
  const inv = piece.object.matrixWorld.clone().invert();
  const overlays: THREE.Mesh[] = [];
  for (const mesh of piece.meshes) {
    // Only the bigger bodies get an outline; small parts just fade.
    if (!(mesh instanceof THREE.InstancedMesh)) {
      mesh.geometry.computeBoundingSphere();
      if (mesh.geometry.boundingSphere!.radius > 0.25) {
        const overlay = new THREE.Mesh(mesh.geometry, rim);
        overlay.raycast = () => {};
        overlay.renderOrder = 5;
        overlay.visible = false;
        mesh.add(overlay);
        overlays.push(overlay);
      }
    }
    xrayBox.makeEmpty().expandByObject(mesh);
    box.union(xrayBox.applyMatrix4(inv));
  }
  xray.set(piece.key, { amount: 0, blocking: false, inside: false, glow: 0, box, rim, overlays });
}

/** Free play: marks the shells / LCD back whose bounds cross the line from the camera to the board. */
function updateFreeBlocking(target: THREE.Vector3) {
  const dist = camera.position.distanceTo(target);
  // The LCD only counts from its metal back; from the front you want to see the picture.
  const fromFront = screenCos() > 0;
  sight.set(camera.position, rayDir.subVectors(target, camera.position).normalize());
  for (const [key, x] of xray) {
    const piece = pieceByKey.get(key)!;
    camLocal.copy(camera.position);
    piece.object.worldToLocal(camLocal);
    x.inside = piece.object.visible && xrayBox.copy(x.box).expandByScalar(0.1).containsPoint(camLocal);
    if (!FREE_OCCLUDERS.includes(key) || (key === 'lcd' && fromFront)) {
      x.blocking = false;
      continue;
    }
    xrayBox.copy(x.box).applyMatrix4(piece.object.matrixWorld);
    const hit = piece.object.visible && sight.intersectBox(xrayBox, sightTarget);
    x.blocking = !!hit && camera.position.distanceTo(sightTarget) < dist - 0.2;
  }
}

/**
 * Focus: marks every piece that a sight line from the camera to the target (its centre and
 * four points around it) passes through, plus any piece the camera sits inside. Faded
 * pieces are still tested, so they stay faded for as long as they'd be in the way.
 */
function updateFocusBlocking(f: Focus, target: THREE.Vector3) {
  for (const x of xray.values()) {
    x.blocking = false;
    x.inside = false;
  }
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  const spread = f.dist * 0.08;
  for (const [dx, dy] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    probe.copy(target).addScaledVector(camRight, dx * spread).addScaledVector(camUp, dy * spread);
    const dist = camera.position.distanceTo(probe);
    sightCaster.set(camera.position, rayDir.subVectors(probe, camera.position).normalize());
    sightCaster.far = dist - 0.03;
    for (const hit of sightCaster.intersectObjects(pickables, false)) {
      const key = hit.object.userData.piece as PieceKey | undefined;
      if (!key || f.reveal.includes(key) || isOwnHit(hit, f.ref)) continue;
      const piece = pieceByKey.get(key)!;
      if (piece.object.visible) xray.get(key)!.blocking = true;
    }
  }
  for (const [key, x] of xray) {
    if (x.blocking || f.reveal.includes(key)) continue;
    const piece = pieceByKey.get(key)!;
    camLocal.copy(camera.position);
    piece.object.worldToLocal(camLocal);
    if (piece.object.visible && xrayBox.copy(x.box).expandByScalar(0.1).containsPoint(camLocal)) x.blocking = true;
  }
}

/** Free play keeps the whole exploded model in frame from any angle. */
const modelBox = new THREE.Box3();
const modelSphere = new THREE.Sphere();
let minDistGoal = 0;
let minDist = 0;
function updateMinDistance(target: THREE.Vector3) {
  modelBox.makeEmpty();
  for (const p of pieces) if (p.object.visible) for (const m of p.meshes) modelBox.expandByObject(m);
  modelBox.getBoundingSphere(modelSphere);
  const r = modelSphere.radius + modelSphere.center.distanceTo(target);
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
  minDistGoal = (r / Math.sin(Math.min(halfV, halfH))) * 1.1;
}
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const viewDir = new THREE.Vector3();
const faceNormal = new THREE.Vector3();
const focusDir = new THREE.Vector3();
const sideAxis = new THREE.Vector3();
const turn = new THREE.Quaternion();
const noTurn = new THREE.Quaternion();
const v = (a: Vec) => new THREE.Vector3(...a);
const RED = new THREE.Color(ACCENT);
const DIM = 0.35;
const MOBILE_DISTANCE = 2.3;

function sample(s: number) {
  const i = Math.min(Math.floor(s), KEYS.length - 2);
  const f = smooth(THREE.MathUtils.clamp(s - i, 0, 1));
  const a = KEYS[i];
  const b = KEYS[i + 1];
  goalCam.copy(v(a.cam)).lerp(v(b.cam), f);
  goalTarget.copy(v(a.target)).lerp(v(b.target), f);
  // Narrow screens need the camera further back to fit the same parts.
  if (isMobile) goalCam.sub(goalTarget).multiplyScalar(MOBILE_DISTANCE).add(goalTarget);
  const explode = new Map<PieceKey, number>();
  const focus = new Map<PieceKey, number>();
  for (const p of pieces) {
    const ea = a.explode[p.key] ?? 0;
    const eb = b.explode[p.key] ?? 0;
    explode.set(p.key, ea + (eb - ea) * f);
    const fa = a.hide?.includes(p.key) ? 0 : !a.focus || a.focus.includes(p.part) ? 1 : (a.dim?.[p.key] ?? DIM);
    const fb = b.hide?.includes(p.key) ? 0 : !b.focus || b.focus.includes(p.part) ? 1 : (b.dim?.[p.key] ?? DIM);
    focus.set(p.key, fa + (fb - fa) * f);
  }
  const pkg = (a.pkgXray ?? 0) + ((b.pkgXray ?? 0) - (a.pkgXray ?? 0)) * f;
  return { explode, focus, pkg };
}

const clock = new THREE.Clock();
/** Dev-only: the occlusion audit runs the animation faster. */
let timeScale = 1;
/** Dev-only: the video capture steps the scene itself, one fixed frame at a time. */
let manualClock = false;
let elapsed = 0;

function frame() {
  const real = Math.min(clock.getDelta(), 0.05) * timeScale;
  if (!manualClock) advanceScene(real);
  requestAnimationFrame(frame);
}

/** Advances the scene by dt seconds and renders it. */
function advanceScene(dt: number) {
  frameNo++;
  elapsed += dt;
  const t = elapsed;
  const ease = 1 - Math.exp(-dt * (reduceMotion ? 30 : 5));

  step += (stepTarget - step) * ease;
  // Scrolling on to another step hands the camera back to the story.
  const storyStep = Math.round(stepTarget);
  if (storyStep !== lastStoryStep) {
    lastStoryStep = storyStep;
    if (focus) closeCard();
  }
  const { explode, focus: fade, pkg } = sample(step);
  const free = step > FREE_STEP - 0.35;

  pkgNow += (pkg * (free ? freeExplode : 1) - pkgNow) * ease;

  // Free play: the slider scales how far apart everything is.
  if (free) {
    for (const [k, e] of explode) explode.set(k, e * freeExplode);
  }

  // X-ray applies in free play (once the parts are apart) and whenever a part is focused.
  const xrayOn = focus ? 1 : free ? THREE.MathUtils.clamp((freeExplode - 0.2) / 0.3, 0, 1) : 0;
  if (frameNo % 3 === 0) {
    if (focus && focusBlend > 0.5) updateFocusBlocking(focus, focusPoint);
    else if (!focus) updateFreeBlocking(boardCenter.set(0, 0, 0).applyMatrix4(pieceByKey.get('board')!.object.matrixWorld));
  }

  for (const p of pieces) {
    const e = explodeNow.get(p.key)! + (explode.get(p.key)! - explodeNow.get(p.key)!) * ease;
    explodeNow.set(p.key, e);
    p.object.position.copy(p.base).addScaledVector(p.explode, e);

    let want = focus?.reveal.includes(p.key) ? 1 : fade.get(p.key)!;
    const x = xray.get(p.key)!;
    // Fade out quicker than back in, so a blocker is gone before the camera reaches it.
    // The V851S package also goes see-through when the story shows the memory inside it.
    const isPkg = p.key === 'socLid';
    const target = Math.max(x.blocking ? xrayOn : 0, x.inside ? 1 : 0, isPkg ? pkgNow : 0);
    x.amount += (target - x.amount) * (target > x.amount ? 1 - Math.exp(-dt * 12) : ease);
    want = THREE.MathUtils.lerp(want, Math.min(want, isPkg ? PKG_XRAY_OPACITY : XRAY_OPACITY), x.amount);
    let o = opacityNow.get(p.key)! + (want - opacityNow.get(p.key)!) * ease;
    opacityNow.set(p.key, o);

    // Hover and selection draw a red rim light around the part instead of tinting it, which
    // turned dark plastic a muddy brown. Small parts with no rim overlay get a faint tint.
    const lit = hoverPart === p.part || selectedPart === p.part;
    x.glow += ((lit ? 1 : 0) - x.glow) * (1 - Math.exp(-dt * 14));
    const rimAmount = Math.max(x.amount * 0.9, x.glow * 0.9);
    const xrayRim = x.amount > x.glow;
    x.rim.uniforms.uOpacity.value = rimAmount;
    x.rim.uniforms.uColor.value.copy(xrayRim ? INK_RIM : RED);
    // The x-ray keeps a soft outline; the hover glow hugs the silhouette only.
    x.rim.uniforms.uPower.value = xrayRim ? 2.5 : 7;
    for (const ov of x.overlays) ov.visible = rimAmount > 0.01;
    p.object.visible = o > 0.02;
    for (const m of p.materials) {
      m.opacity = o;
      m.depthWrite = o > 0.95;
      if (lit && !x.overlays.length) {
        m.emissive.copy(RED);
        m.emissiveIntensity = 0.06;
      } else {
        m.emissive.copy(m.userData.baseEmissive);
        m.emissiveIntensity = m.userData.baseEmissiveIntensity;
      }
    }
  }

  // Gentle idle sway on the intro, fading out as the teardown starts.
  const sway = reduceMotion ? 0 : Math.sin(t * 0.45) * 0.28 * Math.max(0, 1 - step);
  root.rotation.y = sway;

  currentCam.lerp(goalCam, ease);
  currentTarget.lerp(goalTarget, ease);

  // Apply the user's rotation around whatever the story is looking at.
  const spin = 1 - Math.exp(-dt * 12);
  if (stepTarget > KEYS.length - 1.35) orbit.pitchGoal = THREE.MathUtils.clamp(orbit.pitchGoal, -0.7, 0.7);
  orbit.yaw += (orbit.yawGoal - orbit.yaw) * spin;
  orbit.pitch += (orbit.pitchGoal - orbit.pitch) * spin;
  offset.copy(currentCam).sub(currentTarget);
  spherical.setFromVector3(offset);
  spherical.theta += orbit.yaw;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - orbit.pitch, 0.12, Math.PI - 0.12);
  let radius = spherical.radius * viewerFit;
  viewDir.setFromSpherical(spherical.set(1, spherical.phi, spherical.theta));
  viewTarget.copy(currentTarget);
  // Free play: never closer than the distance that keeps the whole model in frame.
  const freeAmt = THREE.MathUtils.clamp((step - (FREE_STEP - 0.5)) / 0.5, 0, 1);
  if (freeAmt > 0) {
    if (frameNo % 10 === 0) updateMinDistance(viewTarget);
    minDist += (minDistGoal - minDist) * ease;
    radius = THREE.MathUtils.lerp(radius, Math.max(radius, minDist), freeAmt);
  }

  // Fly in to the focused part, and back out when its card closes.
  focusBlend += ((focus ? 1 : 0) - focusBlend) * (1 - Math.exp(-dt * (reduceMotion ? 30 : 5)));
  look.yaw += (look.yawGoal - look.yaw) * spin;
  look.pitch += (look.pitchGoal - look.pitch) * spin;
  const f = focus ?? lastFocus;
  if (f && focusBlend > 0.001) {
    focusPoint.copy(f.local);
    f.piece.object.localToWorld(focusPoint);
    faceNormal.copy(f.normal).transformDirection(f.piece.object.matrixWorld);
    // Default view: mostly along the face normal, a little of the story angle so it stays oblique.
    focusDir.copy(faceNormal).multiplyScalar(0.6).addScaledVector(viewDir, 0.4);
    if (focusDir.lengthSq() < 1e-4) focusDir.copy(faceNormal);
    focusDir.normalize().applyAxisAngle(WORLD_UP, look.yaw);
    sideAxis.crossVectors(WORLD_UP, focusDir);
    if (sideAxis.lengthSq() > 1e-6) focusDir.applyAxisAngle(sideAxis.normalize(), -look.pitch);
    // Never more than MAX_TILT off the normal: no grazing views, never round the back.
    const tilt = focusDir.angleTo(faceNormal);
    if (tilt > MAX_TILT) {
      sideAxis.crossVectors(faceNormal, focusDir).normalize();
      focusDir.copy(faceNormal).applyAxisAngle(sideAxis, MAX_TILT);
    }
    // And never past the point where a taller neighbour would cover the part.
    applyTiltLimit(f, focusDir);
    const k = smooth(Math.min(1, focusBlend));
    viewTarget.lerp(focusPoint, k);
    turn.setFromUnitVectors(viewDir, focusDir);
    viewDir.applyQuaternion(noTurn.slerp(turn, k));
    noTurn.identity();
    radius = THREE.MathUtils.lerp(radius, f.dist * (isMobile ? MOBILE_FOCUS : 1), k);
  }

  zoomNow += (zoomGoal - zoomNow) * spin;
  radius /= zoomNow;
  camera.position.copy(viewTarget).addScaledVector(viewDir, radius);
  camera.lookAt(viewTarget);

  updateFocusCard();
  updateLabels(step, dt);
  renderer.render(scene, camera);
}

// Dev-only hooks for the occlusion audit (tools/audit). Stripped from production builds.
if (import.meta.env.DEV) {
  const auditRay = new THREE.Raycaster();
  Object.assign(window, {
    __td: {
      refs: () => COMPONENTS.map((c) => c.ref),
      speed: (k: number) => (timeScale = k),
      /**
       * Video capture: take the clock off real time, then step the scene a fixed dt per call, so every
       * captured frame is exactly 1/fps apart however slowly the screenshots are taken.
       */
      manual(on: boolean) {
        manualClock = on;
        clock.getDelta();
      },
      advance(n: number, dt = 1 / 60) {
        for (let i = 0; i < n; i++) advanceScene(dt);
      },
      /** Scrolls and updates the story position at once, without waiting for a scroll event. */
      scrollTo(y: number) {
        window.scrollTo({ top: y, behavior: 'instant' });
        readScroll();
      },
      /** Turns the free orbit (radians), as a drag would. */
      orbit(yaw: number, pitch = 0) {
        orbit.yawGoal = yaw;
        orbit.pitchGoal = pitch;
      },
      explode: (v: number) => {
        slider.value = String(Math.round(v * 100));
        slider.dispatchEvent(new Event('input'));
      },
      zoom: (z: number) => setZoom(z),
      /** Resolves after n rendered frames, so the audit waits on the scene, not the clock. */
      frames: (n: number) => new Promise<void>((res) => {
        const tick = () => (--n <= 0 ? res() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
      focusRef(ref: string) {
        const def = DEF_BY_REF.get(ref)!;
        const piece = pieceByKey.get(def.group === 'board' ? 'board' : def.group)!;
        openComp(ref, piece.part, piece, piece.object.getWorldPosition(new THREE.Vector3()));
      },
      focusPart: (part: PartId) => focusPart(part),
      /** What a click at (x, y) would select: a component ref, a part id, or null for empty space. */
      hit(x: number, y: number) {
        const h = pick(x, y);
        return h ? (h.comp ?? h.part) : null;
      },
      /** Pairs of parts on the same side whose body footprints overlap. */
      overlaps() {
        const box = (c: (typeof COMPONENTS)[number]) => {
          const [bx, by] = bodySize(c.kind);
          const q = Math.abs(Math.round(Math.sin(THREE.MathUtils.degToRad(c.rot ?? 0)))) === 1;
          const w = q ? by : bx;
          const h = q ? bx : by;
          return [c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2];
        };
        const out: string[] = [];
        for (let i = 0; i < COMPONENTS.length; i++) {
          for (let j = i + 1; j < COMPONENTS.length; j++) {
            const a = COMPONENTS[i];
            const b = COMPONENTS[j];
            if ((a.side ?? 'top') !== (b.side ?? 'top')) continue;
            const [ax0, ay0, ax1, ay1] = box(a);
            const [bx0, by0, bx1, by1] = box(b);
            if (ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1) out.push(`${a.ref}/${b.ref}`);
          }
        }
        return out;
      },
      clickable(ref: string) {
        const def = DEF_BY_REF.get(ref)!;
        const key: PieceKey = def.group === 'board' ? 'board' : def.group;
        return pieceByKey.get(key)!.object.visible && opacityNow.get(key)! > 0.5;
      },
      look(yaw: number, pitch: number) {
        look.yawGoal = yaw;
        look.pitchGoal = pitch;
      },
      close: closeCard,
      /** What a viewer would actually see in the way: solid pieces (or neighbours) on the sight line. */
      audit() {
        if (!focus) return null;
        const f = focus;
        const blockers: string[] = [];
        const dist = camera.position.distanceTo(focusPoint);
        auditRay.set(camera.position, rayDir.subVectors(focusPoint, camera.position).normalize());
        auditRay.far = dist - 0.03;
        for (const hit of auditRay.intersectObjects(pickables, false)) {
          const key = hit.object.userData.piece as PieceKey | undefined;
          if (!key || isOwnHit(hit, f.ref) || opacityNow.get(key)! < 0.3) continue;
          // A whole part is allowed to show its own components in front of its centre.
          if (!f.ref && f.reveal.includes(key)) continue;
          const byInstance = hit.object.userData.compByInstance as string[] | undefined;
          const comp = (hit.object.userData.comp as string | undefined) ?? (byInstance && hit.instanceId !== undefined ? byInstance[hit.instanceId] : '');
          blockers.push(`${key}${comp ? ':' + comp : ''}`);
        }
        for (const [key, x] of xray) {
          if (opacityNow.get(key)! < 0.3) continue;
          camLocal.copy(camera.position);
          pieceByKey.get(key)!.object.worldToLocal(camLocal);
          if (x.box.containsPoint(camLocal)) blockers.push(`inside:${key}`);
        }
        return { ref: f.ref, blockers: [...new Set(blockers)] };
      },
    },
  });
}

// Turning a phone or resizing the window changes every chapter's height, so the same scrollY would
// land in another chapter (and close an open card). Keep the story position instead: the resize
// event runs before this frame's scroll event, so stepTarget still holds the position from before.
window.addEventListener('resize', () => {
  const keep = stepTarget;
  resize();
  const i = Math.min(Math.floor(keep), sections.length - 2);
  const top = sections[i].offsetTop;
  const next = sections[i + 1].offsetTop;
  window.scrollTo({ top: top + (keep - i) * (next - top), behavior: 'instant' });
  readScroll();
});
resize();
readScroll();
onLang(readScroll);
onLang(fitTitle);
step = stepTarget;
requestAnimationFrame(frame);
