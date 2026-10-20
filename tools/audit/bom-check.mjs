// Component mapping check: every board designator has its own bom.ts entry, reference-board values match
// the TinyVision BOM, and no copy falls back to a value guessed from the package.
// usage (from a-teardown/): node tools/audit/bom-check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'vite';

// Values from BOM_TinyVision_PCB1_2023-11-13.xlsx and SCH_TinyVision_2023-11-13.pdf, by reference designator.
const TINYVISION = {
  C3: '22 pF', C4: '22 pF', C18: '22 pF',
  C15: '1 µF', C23: '1 µF',
  C5: '100 nF', C6: '100 nF', C16: '100 nF', C24: '100 nF',
  C13: '22 µF', C14: '22 µF', C17: '22 µF', C19: '22 µF', C21: '22 µF', C35: '22 µF', C41: '22 µF',
  R7: '33 Ω', R8: '1 kΩ', R10: '150 kΩ', R11: '100 kΩ', R12: '680 kΩ', R13: '75 kΩ', R14: '150 kΩ', R15: '150 kΩ',
  R16: '5.1 kΩ', R17: '5.1 kΩ',
  L1: '1.5 µH', L2: '2.2 µH', L3: '1.5 µH',
  U2: 'CSNP1GCR01-BOW', U6: 'MP2122', U7: 'CJ6211B12F', U8: 'MT3520B', U9: 'CJ6211B28F', U10: 'MUP-M617-2',
  X1: '24 MHz', OTG1: 'TYPEC-304-BCP16', FPC2: 'AFC24-S24FIC-00', 'D1–D9': '0402ESDA-05N',
};

const errors = [];
const fail = (msg) => errors.push(msg);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { BOM } = await server.ssrLoadModule('/src/bom.ts');
  const { COMPONENTS } = await server.ssrLoadModule('/src/layout.ts');
  const refs = COMPONENTS.map((c) => c.ref);

  // 1. One entry per designator, nothing left over.
  for (const r of refs) if (!BOM[r]) fail(`${r}: no bom.ts entry`);
  for (const r of Object.keys(BOM)) if (!refs.includes(r)) fail(`${r}: bom.ts entry for a part that is not on the board`);

  for (const [r, e] of Object.entries(BOM)) {
    // 2. Both languages complete.
    for (const l of ['en', 'zh']) for (const f of ['part', 'role', 'pkg', 'board']) if (!e[l]?.[f]) fail(`${r}: missing ${l}.${f}`);
    // 3. Reference parts carry the reference board's value, in both languages.
    if (e.basis === 'reference') {
      const want = TINYVISION[e.refBoard];
      if (!want) fail(`${r}: basis reference but refBoard ${e.refBoard} is not a known TinyVision designator`);
      else for (const l of ['en', 'zh']) if (!e[l].part.includes(want)) fail(`${r}: ${l}.part "${e[l].part}" should carry ${want} (TinyVision ${e.refBoard})`);
      if (e.status === 'new' || e.status === 'adapted') fail(`${r}: basis reference with status ${e.status}`);
    } else {
      // 4. Design parts don't claim a reference counterpart.
      if (e.refBoard) fail(`${r}: basis ${e.basis} but refBoard ${e.refBoard}`);
      if (e.status === 'same' || e.status === 'moved' || e.status === 'renumbered') fail(`${r}: basis ${e.basis} with status ${e.status}`);
    }
  }

  // 5. Values that used to come from a per-package fallback.
  const expect = { C3: '22 pF', C4: '22 pF', C18: '22 pF', C15: '1 µF', C23: '1 µF', C16: '100 nF', C24: '100 nF', C5: '100 nF' };
  for (const [r, v] of Object.entries(expect)) if (BOM[r] && !BOM[r].en.part.startsWith(v)) fail(`${r}: expected ${v}, got ${BOM[r].en.part}`);
  const bySide = (ref) => COMPONENTS.find((c) => c.ref === ref);
  const c0402 = refs.filter((r) => bySide(r).kind === 'c0402').map((r) => BOM[r]?.en.part);
  if (new Set(c0402).size < 3) fail(`0402 capacitors show only ${[...new Set(c0402)].join(', ')}: values look inferred from the package`);
  const resistorRoles = new Set(refs.filter((r) => bySide(r).kind === 'r0402').map((r) => BOM[r]?.en.role));
  if (resistorRoles.size < 10) fail(`0402 resistors share ${resistorRoles.size} roles: roles look generic`);
} finally {
  await server.close();
}

// 6. No package-based fallback in the lookup code.
const parts = readFileSync('src/parts.ts', 'utf8');
if (/kind\s*===/.test(parts)) fail('parts.ts: component text is chosen by package kind again');

// 7. Old wording that this round corrected (both languages).
const STALE = [
  [/2K 封顶|2K ceiling|records at 2K|按 2K 录像/, 'resolution as "2K ceiling"'],
  [/1\.8 V DRAM|1\.8 V 内存|VCC-DRAM 1\.8 V(?! or)/, 'memory rail as 1.8 V (the design uses 1.5 V, as on TinyVision)'],
  [/speaker|喇叭/i, 'speaker (no amplifier on this board; the speaker was removed)'],
  [/晶粒|bond wire|lid lifts|掀开/, 'package drawn as an opened lid with dies'],
  [/TinyVision V851S board|开源 V851S 参考板|V851S 板原理图/, 'reference board called a V851S board (it is a V851SE board)'],
  [/handles fast boot|负责快速启动/, 'RISC-V "fast boot" claim (not in the datasheet)'],
  [/105 parts|105 个器件/, 'hard-coded part count'],
  [/Driven over RGB, i8080 or 2-lane MIPI DSI|支持 RGB、i8080 或 2-lane MIPI DSI 接口/, 'SoC display buses written as the panel interface'],
  [/locks the current clip|检测到碰撞时锁定/, 'accelerometer described as locking clips itself'],
];
const files = ['index.html', ...readdirSync('src').filter((f) => f.endsWith('.ts')).map((f) => `src/${f}`)];
for (const f of files) {
  const text = readFileSync(f, 'utf8')
    .split('\n')
    // Comments may name the old wording to explain the change.
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  for (const [re, what] of STALE) {
    const m = text.match(re);
    if (m) fail(`${f}: stale wording "${m[0]}" (${what})`);
  }
}

if (errors.length) {
  console.log(`bom-check: ${errors.length} problem(s)`);
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
console.log('bom-check: all board components mapped; reference values match TinyVision; no stale wording');
