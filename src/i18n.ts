// The page reads in English or Simplified Chinese. English copy is written in index.html;
// the Chinese copy for those elements lives here, keyed by their data-i18n attributes.
// Part and component text is bilingual in parts.ts.

export type Lang = 'en' | 'zh';

const STORE_KEY = 'teardown-lang';

function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh') return q;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    // Storage can be blocked; fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export let lang: Lang = initialLang();

/** Strings set from code (part card labels, aria text, tooltips). */
const UI = {
  en: {
    whatLabel: 'What it does',
    whyLabel: 'Worth knowing',
    specLabel: 'Spec',
    roleLabel: 'Role',
    pkgLabel: 'Package',
    partOfLabel: 'Part of',
    boardLabel: 'On the reference board',
    bottomSide: 'Main board (bottom side)',
    show: (name: string) => `Show ${name}`,
    kicker: (ref: string, source: string) => `${ref}, ${source.toLowerCase()}`,
    /** The chapter line above each heading on phones: "05 / 09 · Memory + storage". */
    chapter: (n: number, of: number, name: string) => `${String(n).padStart(2, '0')} / ${String(of).padStart(2, '0')} · ${name}`,
  },
  zh: {
    whatLabel: '用途',
    whyLabel: '值得一提',
    specLabel: '规格',
    roleLabel: '用途',
    pkgLabel: '封装',
    partOfLabel: '所属部分',
    boardLabel: '参考板对应',
    bottomSide: '主板（背面）',
    show: (name: string) => `查看${name}`,
    kicker: (ref: string, source: string) => `${ref} · ${source}`,
    chapter: (n: number, of: number, name: string) => `${String(n).padStart(2, '0')} / ${String(of).padStart(2, '0')} · ${name}`,
  },
};

export const t = () => UI[lang];

/** Chapter names for the navigation dots, in story order (English ones are data-nav in index.html). */
export const NAV_ZH = ['开场', '外壳', '镜头与传感器', 'V851S', '内存与存储', '供电', '屏幕与超级电容', '零件出处', '自己动手拆'];

const HEAD = {
  en: { title: '', description: '' },
  zh: {
    title: '35 美元档行车记录仪 · V851S 参考设计',
    description: '一台约 35 美元档 1440p 行车记录仪的 V851S 参考设计，做成可交互的 3D 拆解，每个零件都标明依据。',
  },
};

const CTA: Record<Lang, string> = {
  en: 'https://contra.com/martin_k_ned4llz9',
  zh: '/zh/contact/',
};

/** Chinese innerHTML for every [data-i18n] element. */
const ZH: Record<string, string> = {
  'hint-long': '拖动旋转 · 点击零件看详情 · 双击复位',
  'hint-short': '拖动旋转 · 点击零件看详情',
  'hint-touch': '左右滑动旋转 · 点按零件看详情',
  'work': '找我合作',
  'work-short': '找我合作',

  'kicker': 'V851S 参考设计 · 约 35 美元档',

  'h1': '<span class="h1-line">35 美元的行车记录仪</span><span class="h1-line">里面装了什么？</span>',
  'lead':
    '围绕全志 V851S 主控芯片设计的一台 1440p 行车记录仪，在 3D 模型里逐件还原，细到每颗电容。每个零件都标明依据：芯片数据手册、开源的 TinyVision 参考板，或是自主设计。',
  'src-datasheet': '数据手册',
  'src-reference': '参考板',
  'src-design': '自主设计',
  'cue-scroll': '向下滚动，一层层拆开',
  'cue-mouse': '拖动旋转，点击零件看详情',
  'cue-touch': '左右滑动旋转，点按零件看详情',

  's1-h': '两片外壳，四颗螺丝',
  's1-p':
    '镜头和散热孔朝前对着路面，屏幕朝后对着你；按键、USB-&#8288;C 口和 microSD 卡槽分在两侧。真正干活的部分，全在一块比银行卡还小的电路板上。',

  's2-h': '录像分辨率，由 ISP 决定',
  's2-p':
    'M12 镜头下面是一颗 CMOS 传感器，单独焊在一块小板上，通过 MIPI CSI 排线接到主板。V851S 的图像处理器（ISP）在线模式最高处理 2560&nbsp;×&nbsp;1440，所以本方案按 1440p 录像。',

  's3-h': '一颗 9&nbsp;mm 见方的主控芯片',
  's3-p':
    '整台相机靠这一颗芯片运转：Cortex-A7 核跑 Linux，旁边还有一颗 RISC-V 核；NPU 可以跑检测模型，硬件编码器输出 H.265 或 H.264 视频。数据手册给出的芯片额定环境温度是 −20 至 75&nbsp;°C。',

  's4-h': '内存，就封在芯片里',
  's4-p':
    'V851S 把 64&nbsp;MB DDR2 内存和处理器封装在一起，所以主板上不用另放内存芯片。模型把封装画成半透明，里面一块代表处理器、一块代表内存，这是示意图，不是开封实拍。固件存在一颗小小的 SD&nbsp;NAND 里，视频写进 microSD 卡。',

  's5-h': '一个 USB-&#8288;C 口，撑起五路电压',
  's5-p':
    '主控的核心、内存、IO，加上摄像头传感器，一共要五路电压，都由板上的器件从 5&nbsp;V 转出来；另一路 1.8&nbsp;V 由芯片内部的 LDO 产生。两颗降压芯片、两颗 LDO 连同反馈电阻，都和参考板一样。输入保护和断电后切换到超级电容的电路，是本方案为车载环境加上的。',

  's6-h': '芯片留给你拍板的两件事',
  's6-p':
    'V851S 能驱动一块小屏，同系列的 V851SE 没有显示输出，所以要不要屏幕，选芯片时就定了。开源参考板用的正是 V851SE，屏幕这部分是本方案自己加的。备用电源用两颗串联的超级电容，它们比锂电池更耐高温。',

  's7-h': '每个零件，都有出处',
  's7-note': '点击零件名，镜头会飞过去；也可以直接点板上的任意器件。',

  's8-h': '轮到你动手了',
  'assembled': '合上',
  'apart': '拆开',
  'sources':
    '资料来源：<a data-source="allwinner" href="#" target="_blank" rel="noopener">全志 V851S</a> 数据手册（v1.2），以及开源项目 <a data-source="tinyvision" href="#" target="_blank" rel="noopener">TinyVision</a>（基于 V851SE）的原理图与 BOM。',
  'credit': '我为硬件和 AI 产品做发布页和交互式演示，就像你正在看的这一页。',

  'card-hint': '拖动可换个角度看，按 <kbd>Esc</kbd> 关闭。',
};

/** Chinese aria-labels for every [data-i18n-label] element. */
const ZH_LABEL: Record<string, string> = {
  'scene': '行车记录仪的 3D 模型，点击零件可查看说明。',
  'lang': '语言',
  'chapters': '章节',
  'sources': '来源',
  'zoom': '缩放',
  'zoom-out': '缩小',
  'zoom-in': '放大',
  'explode': '拆开程度',
  'close': '关闭',
  'reset': '复位视角',
};

// Chinese has no spaces, so the browser may break a line anywhere, even inside a word ("行车记 / 录仪").
// Where Intl.Segmenter exists, the page sets word-break: keep-all (style.css) and puts a <wbr> only where a
// line may break: after punctuation, after a function word, or between two whole words. The segmenter's
// dictionary splits technical terms into single characters ("处理|器", "芯|片"), so a lone character sticks
// to its neighbours unless it is a function word. Nothing breaks before a closing mark like "，" or "。".
const segmenter = 'Segmenter' in Intl ? new Intl.Segmenter('zh-Hans', { granularity: 'word' }) : null;
const CJK = /[㐀-鿿豈-﫿]/;
const CJK_WORD = /^[㐀-鿿豈-﫿]{2,}$/;
const PUNCT_END = /[，。、；：？！）》」』”’]$/;
const NO_LINE_START = /^[，。、；：？！）》」』”’·]/;
const NO_LINE_END = /[（《「『“‘]$/;
/** Single-character words a line may break after. */
const FUNCTION_WORDS = new Set('的了和与或在是把被从到给对向让用由为就也都还再则而并但'.split(''));
/**
 * Terms the segmenter splits but a reader sees as one word. Each is merged back into one word before
 * breaks are placed, so it never breaks inside and, being a whole word, may break before or after.
 */
const KEEP_WHOLE =
  /行车记录仪|超级电容|数据手册|参考板|摄像头|传感器|自主设计|驻极体|肖特基|编解码器|电源路径|中控台|小屏|示意图|半透明|加速度计|去耦电容|储能电容|降压芯片|反馈电阻|处理器|主板|封装|芯片|内存|电容|实拍|开封/g;
/** A paragraph's last line keeps at least this many characters, so it never ends on a lone "板上。". */
const MIN_LAST_LINE = 6;

const mayBreak = (a: string, b: string) =>
  (CJK.test(a.slice(-1)) || CJK.test(b[0])) &&
  !NO_LINE_START.test(b) &&
  !NO_LINE_END.test(a) &&
  (PUNCT_END.test(a) || FUNCTION_WORDS.has(a) || (CJK_WORD.test(a) && CJK_WORD.test(b)));

/** Lets the Chinese text under `root` break only between phrases. Call it after setting the text. */
export function wrapPhrases(root: Element) {
  if (lang !== 'zh' || !segmenter) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const last = node === nodes[nodes.length - 1];
    const kept = [...node.data.matchAll(KEEP_WHOLE)];
    const inside = (at: number) => kept.some((m) => at > m.index && at < m.index + m[0].length);
    // Glue the segmenter's pieces of a kept term back into one word.
    const words: string[] = [];
    for (const { segment, index } of segmenter.segment(node.data)) {
      if (words.length && inside(index)) words[words.length - 1] += segment;
      else words.push(segment);
    }
    if (words.length < 2) continue;
    const frag = document.createDocumentFragment();
    let run = '';
    let at = 0;
    words.forEach((w, i) => {
      const next = words[i + 1];
      // A lone character after a Latin word stays on its line: "USB-C 口", "SD NAND 里".
      run += w === ' ' && next !== undefined && next.length === 1 && CJK.test(next) ? ' ' : w;
      at += w.length;
      if (next === undefined || inside(at) || (last && node.data.length - at < MIN_LAST_LINE)) return;
      if (mayBreak(w, next)) {
        frag.append(run, document.createElement('wbr'));
        run = '';
      }
    });
    frag.append(run);
    node.replaceWith(frag);
  }
}

if (segmenter) document.documentElement.classList.add('has-phrases');

// English originals, read from the page once so the HTML stays the English source.
const EN: Record<string, string> = {};
const EN_LABEL: Record<string, string> = {};
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) EN[el.dataset.i18n!] = el.innerHTML;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) EN_LABEL[el.dataset.i18nLabel!] = el.getAttribute('aria-label') ?? '';
HEAD.en.title = document.title;
HEAD.en.description = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';

function applyStatic() {
  const zh = lang === 'zh';
  document.documentElement.lang = zh ? 'zh-CN' : 'en';
  document.title = HEAD[lang].title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', HEAD[lang].description);
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const k = el.dataset.i18n!;
    el.innerHTML = zh ? (ZH[k] ?? EN[k]) : EN[k];
    // The headline sets its own two lines (fitTitle in main.ts); breaks inside them would undo that.
    if (k !== 'h1') wrapPhrases(el);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const k = el.dataset.i18nLabel!;
    el.setAttribute('aria-label', zh ? (ZH_LABEL[k] ?? EN_LABEL[k]) : EN_LABEL[k]);
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
  // "Work with me": Contra for English readers (a new tab), the site's own contact page for Chinese ones.
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-cta]')) {
    a.href = CTA[lang];
    if (lang === 'en') {
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }
  }
  // The name goes to the home of the site this page lives in.
  const home = document.querySelector<HTMLAnchorElement>('.topbar__name');
  if (home) home.href = lang === 'zh' ? '/zh/' : '/';
  document.documentElement.classList.remove('is-translating');
}

const listeners: (() => void)[] = [];

/** Runs `fn` now and again after every language switch. */
export function onLang(fn: () => void) {
  listeners.push(fn);
  fn();
}

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORE_KEY, next);
  } catch {
    // Not remembered across visits; the URL below still carries it.
  }
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  history.replaceState(null, '', url);
  applyStatic();
  for (const fn of listeners) fn();
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  b.addEventListener('click', () => setLang(b.dataset.lang as Lang));
}
applyStatic();
