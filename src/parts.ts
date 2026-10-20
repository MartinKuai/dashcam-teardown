// Reference design: a compact dashcam built around the Allwinner V851S.
// Not a teardown of a real product. Three kinds of source, shown on every part:
//  - datasheet: Allwinner V851SX datasheet v1.2 / product page
//  - reference: the open-source TinyVision board (schematic + BOM, 2023-11-13), built on the V851SE
//  - design: choices made for this dashcam design
// Board components, one entry per designator, live in bom.ts.

import { lang, type Lang } from './i18n';
import { BOM, type Basis } from './bom';
import { COMPONENTS } from './layout';

export type { Basis };

export const SOURCES = {
  allwinner: 'https://www.allwinnertech.com/index.php?c=product&a=index&id=118',
  tinyvision: 'https://github.com/YuzukiHD/TinyVision/tree/main/docs/hardware/TinyVision',
  cnx: 'https://www.cnx-software.com/2022/10/06/allwinner-v851s-v851se-low-cost-camera-soc-embeds-64mb-ddr2-a-0-5-tops-npu/',
};

/** Estimated retail price class, see SPEC.md §7 for the estimate. */
export const PRICE_USD = 35;

export type PartId = 'shell' | 'lens' | 'soc' | 'ddr' | 'storage' | 'power' | 'board' | 'lcd' | 'supercap';

const BASIS_LABEL: Record<Lang, Record<Basis, string>> = {
  en: { datasheet: 'Datasheet', reference: 'Reference board', design: 'Design choice' },
  zh: { datasheet: '数据手册', reference: '参考板', design: '自主设计' },
};

/** The line under a part card's title: where the part comes from, as a phrase. */
const SOURCE_LINE: Record<Lang, Record<Basis, string>> = {
  en: {
    datasheet: 'From the V851S datasheet',
    reference: 'From the open-source reference board',
    design: 'Design choice',
  },
  zh: { datasheet: '出自 V851S 数据手册', reference: '出自开源参考板', design: '自主设计' },
};

export const basisLabel = (b: Basis) => BASIS_LABEL[lang][b];
export const sourceLine = (b: Basis) => SOURCE_LINE[lang][b];

interface PartText {
  name: string;
  label: string;
  spec: string;
  what: string;
  why: string;
  /**
   * The card's source line when one tag would overstate the evidence: a part that mixes sources,
   * or one whose drawing goes beyond what the source shows. Defaults to the source phrase.
   */
  source?: string;
}

export interface PartInfo extends PartText {
  id: PartId;
  basis: Basis;
}

/** Components on the board, both sides; the V851S package is modelled on its own. */
const COMP_COUNT = COMPONENTS.length;

export const PARTS: Record<PartId, PartInfo> = {
  soc: {
    id: 'soc',
    name: 'Allwinner V851S',
    label: 'V851S',
    basis: 'datasheet',
    spec: 'Cortex-A7 up to 900 MHz + RISC-V E907 up to 600 MHz · NPU up to 0.5 TOPS · QFN-88, 9 × 9 mm, 0.35 mm pitch',
    what: 'Processes the image, encodes H.265 / H.264 video and runs Tina Linux. The NPU supports UINT8, INT8 and INT16 models.',
    why: 'The datasheet rates the chip for −20 to 75 °C ambient; how a finished camera copes with a hot dashboard also depends on its enclosure and power design. The marking follows the datasheet layout (logo, part name, lot number, date code); the lot and date shown are sample values.',
  },
  ddr: {
    id: 'ddr',
    name: '64 MB DDR2 memory, in the V851S package',
    label: '64 MB DDR2 memory (in package)',
    basis: 'datasheet',
    spec: 'SiP 64 MB DDR2 · VCC-DRAM 1.5 V here (the datasheet allows 1.8 V or 1.5 V for DDR2)',
    what: 'Working memory for video frames, packaged together with the processor.',
    why: 'No memory chip on the board means no high-speed memory routing, which keeps the board simple. The model shows the package see-through, with one block for the processor and one for the memory; their size and placement are a diagram, not a decapped chip.',
    source: 'Capacity and supply from the datasheet · the inside of the package is a diagram',
  },
  power: {
    id: 'power',
    name: 'Power section',
    label: 'Power',
    basis: 'reference',
    spec: 'MT3520B 3.3 V buck · MP2122 dual buck (1.5 V memory, 0.9 V core) · CJ6211 1.2 V / 2.8 V LDOs · 1.8 V from the chip’s own LDO',
    what: 'Turns 5 V from USB-C into five rails on the board; a sixth, 1.8 V, comes from an LDO inside the V851S.',
    why: 'The two bucks, the two LDOs and their feedback resistors match the TinyVision board, including its 1.5 V memory rail. The input protection and the switch-over to the supercaps were added for in-car use.',
    source: 'Regulators and their dividers from the reference board · input protection is a design choice',
  },
  storage: {
    id: 'storage',
    name: 'SD NAND + microSD',
    label: 'Storage',
    basis: 'reference',
    spec: 'CS CSNP1GCR01-BOW SD NAND (LGA-8, 6 × 8 mm) · MUP-M617-2 microSD socket',
    what: 'A small SD NAND chip holds the firmware; video is recorded to the microSD card.',
    why: 'Both connect to the V851S SD/MMC host controllers (SMHC). SD NAND speaks the same SD protocol as a memory card, in a chip soldered to the board.',
  },
  lens: {
    id: 'lens',
    name: 'Lens + image sensor',
    label: 'Lens + image sensor',
    basis: 'design',
    spec: 'M12 lens mount · MIPI CSI, 2 data lanes · 24-pin 0.5 mm FPC · records 1440p (2560 × 1440)',
    what: 'An M12 lens and a CMOS sensor send video to the V851S over MIPI CSI.',
    why: 'In online mode the V851S image processor (ISP) handles up to 2560 × 1440, so this design targets 1440p. The camera connector follows the reference board: 1.2 V and 2.8 V from two LDOs, 1.8 V from the chip’s own LDO.',
    source: 'Lens and sensor are design choices · interface and ISP limit from the datasheet',
  },
  board: {
    id: 'board',
    name: 'Main board',
    label: 'Main board',
    basis: 'design',
    spec: `${COMP_COUNT} components on two sides, plus the V851S · 24 MHz crystal · accelerometer · ESD protection · 0402 / 0603 passives`,
    what: 'Carries the chip, power, storage, connectors, buttons and LEDs.',
    why: 'Click any part on the board to see what it is and how it maps to the reference board.',
  },
  lcd: {
    id: 'lcd',
    name: '2-inch LCD',
    label: 'LCD',
    basis: 'design',
    spec: '2-inch panel on a 24-pin FPC · the V851S offers RGB, serial RGB, i8080 and 2-lane MIPI DSI; the panel chosen sets which one is used',
    what: 'A small screen for framing the shot, playing back clips and changing settings.',
    why: 'The V851S drives a display; the V851SE on the TinyVision reference board has no display output.',
  },
  supercap: {
    id: 'supercap',
    name: 'Supercapacitors',
    label: 'Supercapacitors',
    basis: 'design',
    spec: 'Two cells rated 2.7 V each, in series · balancing resistors R40 / R41',
    what: 'Keep the camera powered for a short time after the 5 V input is cut, so the firmware can close the current file.',
    why: 'They cope with a hot dashboard better than a lithium cell. How long they hold up depends on their capacitance and the camera’s power draw. Some budget designs use a small battery instead to save cost.',
  },
  shell: {
    id: 'shell',
    name: 'Shell',
    label: 'Shell',
    basis: 'design',
    spec: 'Two molded halves, four screws',
    what: 'Two plastic halves that hold and mount everything else.',
    why: 'Factories often reuse existing molds, so a design like this can launch without new tooling.',
  },
};

const PARTS_ZH: Record<PartId, PartText> = {
  soc: {
    name: '全志 V851S',
    label: 'V851S',
    spec: 'Cortex-A7 最高 900 MHz + RISC-V E907 最高 600 MHz · NPU 最高 0.5 TOPS · QFN-88，9 × 9 mm，0.35 mm 间距',
    what: '负责图像处理、H.265 / H.264 视频编码，同时运行 Tina Linux。NPU 支持 UINT8、INT8 和 INT16 模型。',
    why: '数据手册给出的芯片额定环境温度为 −20 至 75 °C；整机在暴晒的中控台上表现如何，还取决于外壳和供电设计。丝印按数据手册的格式排布：logo、型号、批号和日期码，模型上的批号和日期码是示例值。',
  },
  ddr: {
    name: '64 MB DDR2 内存，在 V851S 封装内',
    label: '64 MB DDR2 内存（封装内）',
    spec: 'SiP 封装 64 MB DDR2 · 本方案 VCC-DRAM 为 1.5 V（数据手册允许 DDR2 用 1.8 V 或 1.5 V）',
    what: '缓存视频帧的工作内存，和处理器封装在一起。',
    why: '板上不放内存芯片，就省掉了高速内存走线，主板布线简单得多。模型把封装画成半透明，里面一块代表处理器、一块代表内存；尺寸和摆放是示意，不是开封实拍。',
    source: '容量与供电出自数据手册 · 封装内部为示意画法',
  },
  power: {
    name: '供电电路',
    label: '电源',
    spec: 'MT3520B 3.3 V 降压 · MP2122 双路降压（1.5 V 内存、0.9 V 核心）· CJ6211 1.2 V / 2.8 V LDO · 1.8 V 由芯片内部 LDO 提供',
    what: '把 USB-C 输入的 5 V 转换成板上的五路电压；另一路 1.8 V 由 V851S 内部的 LDO 产生。',
    why: '两颗降压芯片、两颗 LDO 及其反馈电阻与 TinyVision 板一致，内存电压同样是 1.5 V。输入保护和断电后切换到超级电容的电路，是针对车载环境加上的。',
    source: '稳压器件与分压取值出自开源参考板 · 输入保护为自主设计',
  },
  storage: {
    name: 'SD NAND + microSD',
    label: '存储',
    spec: 'CS CSNP1GCR01-BOW SD NAND（LGA-8，6 × 8 mm）· MUP-M617-2 microSD 卡座',
    what: '一颗小小的 SD NAND 存放固件，视频录在 microSD 卡上。',
    why: '两者都接在 V851S 的 SD/MMC 主控制器（SMHC）上。SD NAND 和存储卡用的是同一套 SD 协议，只是做成芯片焊在板上。',
  },
  lens: {
    name: '镜头与图像传感器',
    label: '镜头与传感器',
    spec: 'M12 镜头接口 · MIPI CSI，2 对数据线 · 24 针 0.5 mm FPC · 录像 1440p（2560 × 1440）',
    what: 'M12 镜头加一颗 CMOS 传感器，通过 MIPI CSI 把画面送进 V851S。',
    why: 'V851S 的图像处理器（ISP）在线模式最高处理 2560 × 1440，所以本方案按 1440p 录像。摄像头排线沿用参考板的定义：1.2 V 和 2.8 V 来自两颗 LDO，1.8 V 来自芯片内部的 LDO。',
    source: '镜头和传感器为自主设计 · 接口与 ISP 上限出自数据手册',
  },
  board: {
    name: '主板',
    label: '主板',
    spec: `双面共 ${COMP_COUNT} 个元器件，另加 V851S · 24 MHz 晶体 · 加速度计 · ESD 防护 · 0402 / 0603 阻容`,
    what: '承载主控芯片、供电、存储、接口、按键和指示灯。',
    why: '点一下板上的任意器件，看看它是做什么的，以及和参考板怎么对应。',
  },
  lcd: {
    name: '2 英寸 LCD 屏',
    label: 'LCD',
    spec: '2 英寸屏，24 针 FPC 排线 · V851S 支持 RGB、串行 RGB、i8080 和 2-lane MIPI DSI，实际用哪种由所选屏幕决定',
    what: '用来取景、回放视频和调整设置的小屏幕。',
    why: 'V851S 能直接驱动屏幕；TinyVision 参考板用的 V851SE 没有显示输出。',
  },
  supercap: {
    name: '超级电容',
    label: '超级电容',
    spec: '两颗额定 2.7 V 的电容串联 · 均压电阻 R40 / R41',
    what: '5 V 断开后再短暂供电一会儿，让固件把当前文件写完、关好。',
    why: '比锂电池更耐中控台的高温。能撑多久，取决于电容量和整机功耗。也有低价方案为了省钱，改用一块小电池。',
  },
  shell: {
    name: '外壳',
    label: '外壳',
    spec: '两片注塑外壳，四颗螺丝',
    what: '两片塑料壳，承托并固定其余所有零件。',
    why: '工厂常沿用现成的公模，这类设计不用开新模就能上市。',
  },
};

/** Name, label and copy for a part in the current language. */
export const partText = (id: PartId): PartText => (lang === 'zh' ? PARTS_ZH[id] : PARTS[id]);

export const PART_ORDER: PartId[] = ['soc', 'ddr', 'power', 'storage', 'lens', 'board', 'lcd', 'supercap', 'shell'];

// ---------- individual components (click on the board) ----------

export interface CompInfo {
  part: string;
  pkg: string;
  role: string;
  /** The matching part on the reference board, or why there is none. */
  board: string;
  basis: Basis;
}

/** A component's text in the current language. Every designator has its own entry in bom.ts. */
export function compInfo(ref: string): CompInfo {
  const e = BOM[ref];
  if (!e) throw new Error(`No bom.ts entry for ${ref}`);
  return { ...e[lang], basis: e.basis };
}
