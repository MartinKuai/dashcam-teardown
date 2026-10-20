// Copies the build into the personal site, which serves it at martinkuai.com/lab/dashcam-teardown/.
// usage (from a-teardown/): npm run sync   (builds first)
import fs from 'node:fs';
import path from 'node:path';

// 主页规定全站无破折号，smoke 只能查到首屏；在同步进主站前扫描 dist 拦截
function assertNoDashesInDist(distDir = 'dist') {
  if (!fs.existsSync(distDir)) throw new Error(`dist directory not found: ${distDir}`);
  const allRelPaths = fs.readdirSync(distDir, { recursive: true });
  const files = allRelPaths
    .map((p) => path.join(distDir, p))
    .filter((f) => fs.statSync(f).isFile() && (f.endsWith('.html') || f.endsWith('.js')));

  const dashRegex = /[—–]/g;
  let hasDash = false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = dashRegex.exec(content)) !== null) {
      hasDash = true;
      const start = Math.max(0, match.index - 30);
      const end = Math.min(content.length, match.index + 31);
      const snippet = content.slice(start, end).replace(/\r?\n/g, ' ');
      console.error(`Disallowed dash (U+${match[0].charCodeAt(0).toString(16).toUpperCase()}) in ${file}:`);
      console.error(`  ...${snippet}...`);
    }
  }

  if (hasDash) {
    console.error(`\nSync aborted: dist contains disallowed dashes. Fix sources and rebuild.`);
    process.exit(1);
  }
}

assertNoDashesInDist();

// LAB_TARGET overrides the destination (to try the copy without touching personal-site).
const target = process.env.LAB_TARGET ? path.resolve(process.env.LAB_TARGET) : path.resolve('../../personal-site/public/lab/dashcam-teardown');
if (!process.env.LAB_TARGET && !fs.existsSync(path.resolve(target, '../../..', 'astro.config.mjs'))) throw new Error(`personal-site not found next to Contra: ${target}`);
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync('dist', target, { recursive: true });
const files = fs.readdirSync(target, { recursive: true }).filter((f) => fs.statSync(path.join(target, f)).isFile());
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(target, f)).size, 0);
console.log(`synced ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB → ${target}`);
