// Occlusion audit: focuses every clickable component at several story steps, swings the view
// to the corners of the allowed range, and reports anything solid between camera and part.
// usage: node tools/audit/occlusion.cjs <playwright-module-path> [url]  (needs `npm run dev`)
const { chromium } = require(process.argv[2]);
const url = process.argv[3] || 'http://localhost:5274/';
// Optional: a zoom level to audit at (1 = 100%), and a comma list of story steps.
const ZOOM = Number(process.argv[4] || 1);
const ONLY = process.argv[5] ? process.argv[5].split(',').map(Number) : null;

const D = Math.PI / 180;
const ANGLES = [
  [0, 0],
  [40, 0],
  [-40, 0],
  [0, 30],
  [0, -30],
  [40, 30],
  [-40, 30],
  [40, -30],
  [-40, -30],
];
const STEPS = ONLY ?? [4, 5, 6, 8];

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((z) => {
    window.__td.speed(4);
    window.__td.zoom(z);
  }, ZOOM);
  const refs = await page.evaluate(() => window.__td.refs());
  const problems = [];
  let checked = 0;
  for (const step of STEPS) {
    await page.evaluate((i) => window.scrollTo({ top: document.querySelectorAll('.step')[i].offsetTop + 2, behavior: 'instant' }), step);
    await page.waitForTimeout(1500);
    for (const ref of refs) {
      // Only parts a visitor could click at this step (piece visible and solid).
      const clickable = await page.evaluate((r) => {
        window.__td.close();
        return window.__td.clickable(r);
      }, ref);
      if (!clickable) continue;
      await page.evaluate((r) => window.__td.focusRef(r), ref);
      await page.evaluate(() => window.__td.frames(30));
      for (const [y, p] of ANGLES) {
        await page.evaluate(([yy, pp]) => window.__td.look(yy, pp), [y * D, p * D]);
        await page.evaluate(() => window.__td.frames(20));
        const a = await page.evaluate(() => window.__td.audit());
        checked++;
        if (a && a.blockers.length) problems.push({ step, ref, yaw: y, pitch: p, blockers: a.blockers });
      }
    }
  }
  // Whole parts, as focused from their labels and the parts list.
  const PARTS = ['shell', 'lens', 'soc', 'ddr', 'storage', 'power', 'board', 'lcd', 'supercap'];
  for (const step of ONLY ?? [1, 2, 3, 4, 5, 6, 7, 8]) {
    await page.evaluate((i) => window.scrollTo({ top: document.querySelectorAll('.step')[i].offsetTop + 2, behavior: 'instant' }), step);
    await page.waitForTimeout(1500);
    for (const part of PARTS) {
      await page.evaluate((p) => {
        window.__td.close();
        window.__td.focusPart(p);
      }, part);
      await page.evaluate(() => window.__td.frames(30));
      for (const [y, p] of ANGLES) {
        await page.evaluate(([yy, pp]) => window.__td.look(yy, pp), [y * D, p * D]);
        await page.evaluate(() => window.__td.frames(20));
        const a = await page.evaluate(() => window.__td.audit());
        checked++;
        if (a && a.blockers.length) problems.push({ step, part, yaw: y, pitch: p, blockers: a.blockers });
      }
    }
  }
  console.log(JSON.stringify({ checked, problems: problems.length }, null, 0));
  for (const p of problems) console.log(JSON.stringify(p));
  await browser.close();
})();
