// Every component on the main board, keyed by its designator in this model. Nothing here is inferred
// from a package: a 0402 capacitor can be 22 pF, 1 µF or 100 nF, so each entry states its own value.
//
// Reference board = the open-source TinyVision board (YuzukiHD, schematic and BOM 2023-11-13). It is
// built on the V851SE, the display-less sibling of the V851S. Where a part here matches one there,
// `refBoard` names the designator on that board (it can differ from ours) and the value comes from
// its BOM. Parts with basis 'design' were added or chosen for this dashcam; a value is only given
// where the design fixes one.
//
// Pure data, no DOM: tools/audit/bom-check.mjs loads this file in Node to check it.

export type Basis = 'datasheet' | 'reference' | 'design';

/**
 * How the part relates to the reference board:
 * same: same part, same place in the circuit · moved: same part and value, placed elsewhere on this board
 * renumbered: same part, different designator · adapted: a part of that name exists there but serves
 * another circuit · new: nothing like it there.
 */
export type Status = 'same' | 'moved' | 'renumbered' | 'adapted' | 'new';

interface Text {
  /** Value or part number, as the card's title. */
  part: string;
  role: string;
  /** Package, plus maker and order code where they are known. */
  pkg: string;
  /** The matching part on the reference board, or why there is none. */
  board: string;
}

export interface BomEntry {
  basis: Basis;
  refBoard: string | null;
  status: Status;
  en: Text;
  zh: Text;
}

export const BOM: Record<string, BomEntry> = {};

function add(refs: string[], e: BomEntry) {
  for (const r of refs) {
    if (BOM[r]) throw new Error(`bom: ${r} defined twice`);
    BOM[r] = e;
  }
}

const range = (prefix: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

/** Board-text helpers for the common cases; anything else is written out. */
const same = (ref: string) => ({ en: `${ref} · same part, same place in the circuit`, zh: `${ref} · 同一器件，电路位置相同` });
const moved = (ref: string) => ({ en: `${ref} · same value, placed on the bottom side here`, zh: `${ref} · 取值相同，本板放在背面` });
const added = { en: 'None · added in this design', zh: '无 · 本方案新增' };

const SAMSUNG_22U = 'Samsung CL10A226MP8NUNE';
const SAMSUNG_1U = 'Samsung CL05A105KA5NQNC';
const SAMSUNG_100N = 'Samsung CL05B104KB54PNC';
const FH_22P = 'FH 0402CG220J500NT';

function ref(
  refs: string[],
  refBoard: string,
  status: Status,
  board: { en: string; zh: string },
  en: Omit<Text, 'board'>,
  zh: Omit<Text, 'board'>,
) {
  add(refs, { basis: 'reference', refBoard, status, en: { ...en, board: board.en }, zh: { ...zh, board: board.zh } });
}

function design(refs: string[], board: { en: string; zh: string }, en: Omit<Text, 'board'>, zh: Omit<Text, 'board'>, status: Status = 'new') {
  add(refs, { basis: 'design', refBoard: null, status, en: { ...en, board: board.en }, zh: { ...zh, board: board.zh } });
}

// ---------- Power: 3.3 V buck (reference U8) ----------
ref(['U8'], 'U8', 'same', same('U8'),
  { part: 'MT3520B', pkg: 'SOT-23-5 · Aerosemi', role: 'Buck converter: 5 V in, 3.3 V out' },
  { part: 'MT3520B', pkg: 'SOT-23-5 · 航天民芯', role: '降压芯片：5 V 输入，输出 3.3 V' });
ref(['L2'], 'L2', 'same', same('L2'),
  { part: '2.2 µH power inductor', pkg: '2016 · CENKER CKCS201610-2.2uH/M', role: 'Inductor for the MT3520B' },
  { part: '2.2 µH 功率电感', pkg: '2016 · 岑科 CKCS201610-2.2uH/M', role: 'MT3520B 的储能电感' });
for (const [r, en, zh] of [
  ['C35', 'MT3520B input capacitor (5 V)', 'MT3520B 输入电容（5 V）'],
  ['C17', 'MT3520B input capacitor (5 V)', 'MT3520B 输入电容（5 V）'],
  ['C21', 'MT3520B output capacitor (3.3 V)', 'MT3520B 输出电容（3.3 V）'],
] as const) {
  ref([r], r, 'same', same(r), { part: '22 µF capacitor', pkg: `0603 · ${SAMSUNG_22U}`, role: en }, { part: '22 µF 电容', pkg: `0603 · ${SAMSUNG_22U}`, role: zh });
}
ref(['R12'], 'R12', 'same', same('R12'),
  { part: '680 kΩ resistor', pkg: '0402 · YAGEO RC0402FR-07680KL', role: 'Upper half of the MT3520B feedback divider; with R14 it sets 3.3 V' },
  { part: '680 kΩ 电阻', pkg: '0402 · 国巨 RC0402FR-07680KL', role: 'MT3520B 反馈分压的上臂，和 R14 一起把输出定在 3.3 V' });
ref(['R14'], 'R14', 'same', same('R14'),
  { part: '150 kΩ resistor', pkg: '0402 · UNI-ROYAL 0402WGF1503TCE', role: 'Lower half of the MT3520B feedback divider' },
  { part: '150 kΩ 电阻', pkg: '0402 · 厚声 0402WGF1503TCE', role: 'MT3520B 反馈分压的下臂' });
ref(['C18'], 'C18', 'same', same('C18'),
  { part: '22 pF C0G capacitor', pkg: `0402 · ${FH_22P}`, role: 'Feed-forward capacitor across R12 in the MT3520B feedback loop' },
  { part: '22 pF C0G 电容', pkg: `0402 · 风华 0402CG220J500NT`, role: 'MT3520B 反馈环路的前馈电容，并在 R12 两端' });

// ---------- Power: dual buck for DRAM and core (reference U6) ----------
ref(['U6'], 'U6', 'same', same('U6'),
  { part: 'MP2122', pkg: 'TSOT23-8 · MPS', role: 'Dual synchronous buck: 1.5 V for the memory (VCC-DRAM) and 0.9 V for the core (VDD-SYS)' },
  { part: 'MP2122', pkg: 'TSOT23-8 · MPS', role: '双路同步降压：1.5 V 给内存（VCC-DRAM），0.9 V 给核心（VDD-SYS）' });
ref(['L1'], 'L1', 'same', same('L1'),
  { part: '1.5 µH power inductor', pkg: '2520 · Murata DFE252012F-1R5M', role: 'MP2122 channel 1 inductor (1.5 V)' },
  { part: '1.5 µH 功率电感', pkg: '2520 · 村田 DFE252012F-1R5M', role: 'MP2122 第一路（1.5 V）的储能电感' });
ref(['L3'], 'L3', 'same', same('L3'),
  { part: '1.5 µH power inductor', pkg: '2520 · Murata DFE252012F-1R5M', role: 'MP2122 channel 2 inductor (0.9 V)' },
  { part: '1.5 µH 功率电感', pkg: '2520 · 村田 DFE252012F-1R5M', role: 'MP2122 第二路（0.9 V）的储能电感' });
for (const [r, en, zh] of [
  ['C13', 'MP2122 output capacitor, 1.5 V memory rail', 'MP2122 输出电容，1.5 V 内存电源'],
  ['C14', 'MP2122 output capacitor, 1.5 V memory rail', 'MP2122 输出电容，1.5 V 内存电源'],
  ['C19', 'MP2122 output capacitor, 0.9 V core rail', 'MP2122 输出电容，0.9 V 核心电源'],
] as const) {
  ref([r], r, 'same', same(r), { part: '22 µF capacitor', pkg: `0603 · ${SAMSUNG_22U}`, role: en }, { part: '22 µF 电容', pkg: `0603 · ${SAMSUNG_22U}`, role: zh });
}
ref(['R10'], 'R10', 'same', same('R10'),
  { part: '150 kΩ resistor', pkg: '0402 · UNI-ROYAL 0402WGF1503TCE', role: 'Upper half of the 1.5 V feedback divider (with R11)' },
  { part: '150 kΩ 电阻', pkg: '0402 · 厚声 0402WGF1503TCE', role: '1.5 V 反馈分压的上臂（和 R11 一组）' });
ref(['R11'], 'R11', 'same', same('R11'),
  { part: '100 kΩ resistor', pkg: '0402 · YAGEO RC0402FR-07100KL', role: 'Lower half of the 1.5 V feedback divider' },
  { part: '100 kΩ 电阻', pkg: '0402 · 国巨 RC0402FR-07100KL', role: '1.5 V 反馈分压的下臂' });
ref(['R13'], 'R13', 'same', same('R13'),
  { part: '75 kΩ resistor', pkg: '0402 · RESI AECR0402F75K0K9', role: 'Upper half of the 0.9 V feedback divider (with R15)' },
  { part: '75 kΩ 电阻', pkg: '0402 · 开步睿思 AECR0402F75K0K9', role: '0.9 V 反馈分压的上臂（和 R15 一组）' });
ref(['R15'], 'R15', 'same', same('R15'),
  { part: '150 kΩ resistor', pkg: '0402 · UNI-ROYAL 0402WGF1503TCE', role: 'Lower half of the 0.9 V feedback divider' },
  { part: '150 kΩ 电阻', pkg: '0402 · 厚声 0402WGF1503TCE', role: '0.9 V 反馈分压的下臂' });

// ---------- Power: camera LDOs (reference U7, U9) ----------
ref(['U7'], 'U7', 'same', same('U7'),
  { part: 'CJ6211B12F', pkg: 'DFN 1 × 1 mm · JSCJ', role: 'LDO: 3.3 V in, 1.2 V out for the camera sensor core' },
  { part: 'CJ6211B12F', pkg: 'DFN 1 × 1 mm · 长晶', role: 'LDO：3.3 V 输入，输出 1.2 V 给摄像头传感器的核心' });
ref(['U9'], 'U9', 'same', same('U9'),
  { part: 'CJ6211B28F', pkg: 'DFN 1 × 1 mm · JSCJ', role: 'LDO: 3.3 V in, 2.8 V out for the camera sensor’s analog side' },
  { part: 'CJ6211B28F', pkg: 'DFN 1 × 1 mm · 长晶', role: 'LDO：3.3 V 输入，输出 2.8 V 给摄像头传感器的模拟部分' });
for (const [r, part, pkg, en, zh] of [
  ['C15', '1 µF', SAMSUNG_1U, 'U7 output capacitor (1.2 V)', 'U7 输出电容（1.2 V）'],
  ['C16', '100 nF', SAMSUNG_100N, 'U7 input capacitor (3.3 V)', 'U7 输入电容（3.3 V）'],
  ['C23', '1 µF', SAMSUNG_1U, 'U9 output capacitor (2.8 V)', 'U9 输出电容（2.8 V）'],
  ['C24', '100 nF', SAMSUNG_100N, 'U9 input capacitor (3.3 V)', 'U9 输入电容（3.3 V）'],
] as const) {
  ref([r], r, 'same', same(r), { part: `${part} capacitor`, pkg: `0402 · ${pkg}`, role: en }, { part: `${part} 电容`, pkg: `0402 · ${pkg}`, role: zh });
}

// ---------- Power: input protection and supercap switch-over (design) ----------
const forCar = { en: 'None · added for in-car use', zh: '无 · 为车载使用新增' };
design(['D1'], forCar,
  { part: 'TVS diode, 5 V', pkg: 'SOD-123FL', role: 'Clamps voltage spikes on the 5 V input' },
  { part: '5 V TVS 管', pkg: 'SOD-123FL', role: '吸收 5 V 输入端的电压尖峰' });
design(['D2'], forCar,
  { part: 'SS14 Schottky diode', pkg: 'SMA', role: 'Lets current flow from the 5 V input to the supercaps, never back' },
  { part: 'SS14 肖特基二极管', pkg: 'SMA', role: '电流只能从 5 V 输入流向超级电容，不会倒灌' });
design(['Q1'], forCar,
  { part: 'AO3401A P-channel MOSFET', pkg: 'SOT-23', role: 'Power-path switch: turns on when 5 V is lost, so the supercaps take over' },
  { part: 'AO3401A P 沟道 MOSFET', pkg: 'SOT-23', role: '电源路径开关：5 V 断开时导通，改由超级电容供电' });
design(['R30'], forCar,
  { part: 'Gate pull-down resistor', pkg: '0402', role: 'Pulls Q1’s gate low once 5 V is gone, so Q1 switches the supercaps in' },
  { part: '栅极下拉电阻', pkg: '0402', role: '5 V 消失后把 Q1 的栅极拉低，让 Q1 接通超级电容' });
design(['R31'], forCar,
  { part: 'Gate resistor', pkg: '0402', role: 'Ties Q1’s gate to the 5 V input, holding Q1 off while 5 V is present' },
  { part: '栅极电阻', pkg: '0402', role: '把 Q1 的栅极接到 5 V 输入，有 5 V 时让 Q1 保持关断' });

// ---------- ESD (reference D1-D9, renumbered: D1 and D2 are the TVS and Schottky here) ----------
const esdBoard = {
  en: 'D1-D9 · same part, renumbered here because D1 and D2 are the TVS and the Schottky',
  zh: 'D1-D9 · 同型号；本板的 D1、D2 已用于 TVS 和肖特基，所以重新编号',
};
ref(range('D', 10, 14), 'D1-D9', 'renumbered', esdBoard,
  { part: '0402ESDA-05N ESD diode', pkg: '0402 · BORN', role: 'ESD protection on the microSD card lines' },
  { part: '0402ESDA-05N ESD 二极管', pkg: '0402 · 伯恩半导体', role: 'microSD 卡信号线的静电防护' });
ref(range('D', 15, 18), 'D1-D9', 'renumbered', esdBoard,
  { part: '0402ESDA-05N ESD diode', pkg: '0402 · BORN', role: 'ESD protection on the USB-C lines' },
  { part: '0402ESDA-05N ESD 二极管', pkg: '0402 · 伯恩半导体', role: 'USB-C 信号线的静电防护' });

// ---------- Storage (reference U2, U10) ----------
ref(['U2'], 'U2', 'same', same('U2'),
  { part: 'CSNP1GCR01-BOW', pkg: 'LGA-8, 6 × 8 mm · CS', role: 'SD NAND on SMHC2: holds the bootloader, Tina Linux and settings' },
  { part: 'CSNP1GCR01-BOW', pkg: 'LGA-8，6 × 8 mm · 创世', role: 'SD NAND，接在 SMHC2 上：存放 bootloader、Tina Linux 和设置' });
ref(['U10'], 'U10', 'same', same('U10'),
  { part: 'MUP-M617-2', pkg: 'microSD socket · MUP', role: 'Socket for the recording card, on SMHC0' },
  { part: 'MUP-M617-2', pkg: 'microSD 卡座 · 德海威', role: '插录像用的 microSD 卡，接在 SMHC0 上' });
ref(['C5'], 'C5', 'same', same('C5'),
  { part: '100 nF capacitor', pkg: `0402 · ${SAMSUNG_100N}`, role: 'Decoupling on the SD NAND supply (3.3 V)' },
  { part: '100 nF 电容', pkg: `0402 · ${SAMSUNG_100N}`, role: 'SD NAND 电源脚的去耦电容（3.3 V）' });
ref(['C41'], 'C41', 'moved', { en: 'C41 · same part on the 3.3 V rail; placed by the SD NAND here', zh: 'C41 · 同一器件，同在 3.3 V 电源上；本板放在 SD NAND 旁边' },
  { part: '22 µF capacitor', pkg: `0603 · ${SAMSUNG_22U}`, role: 'Bulk capacitor on the 3.3 V rail' },
  { part: '22 µF 电容', pkg: `0603 · ${SAMSUNG_22U}`, role: '3.3 V 电源上的储能电容' });

// ---------- Clock ----------
ref(['X1'], 'X1', 'same', same('X1'),
  { part: '24 MHz crystal', pkg: '2016 · Epson Q22FA12800489', role: 'Passive crystal on the V851S DXIN / DXOUT pins; the oscillator circuit is inside the chip' },
  { part: '24 MHz 无源晶体', pkg: '2016 · 爱普生 Q22FA12800489', role: '接 V851S 的 DXIN / DXOUT 引脚；振荡电路在芯片内部' });
ref(['C3'], 'C3', 'same', same('C3'),
  { part: '22 pF C0G capacitor', pkg: `0402 · ${FH_22P}`, role: 'Crystal load capacitor on DXOUT' },
  { part: '22 pF C0G 电容', pkg: '0402 · 风华 0402CG220J500NT', role: '晶体负载电容，接 DXOUT' });
ref(['C4'], 'C4', 'same', same('C4'),
  { part: '22 pF C0G capacitor', pkg: `0402 · ${FH_22P}`, role: 'Crystal load capacitor on DXIN' },
  { part: '22 pF C0G 电容', pkg: '0402 · 风华 0402CG220J500NT', role: '晶体负载电容，接 DXIN' });

// ---------- Connectors ----------
ref(['J1'], 'OTG1', 'renumbered', { en: 'OTG1 · same part, named J1 here', zh: 'OTG1 · 同一器件，本板命名为 J1' },
  { part: 'TYPEC-304-BCP16', pkg: 'USB-C · XUNPU', role: '5 V input and USB data' },
  { part: 'TYPEC-304-BCP16', pkg: 'USB-C · 讯普', role: '5 V 供电输入，兼走 USB 数据' });
ref(['J2'], 'FPC2', 'renumbered', { en: 'FPC2 · same part and pinout, named J2 here', zh: 'FPC2 · 同一器件、同样的引脚定义，本板命名为 J2' },
  { part: 'AFC24-S24FIC-00', pkg: '24-pin 0.5 mm FPC', role: 'Camera connector: two MIPI CSI data lanes and a clock, I²C, reset, and the 1.2 V, 1.8 V and 2.8 V rails' },
  { part: 'AFC24-S24FIC-00', pkg: '24 针 0.5 mm FPC', role: '摄像头排线座：MIPI CSI 两对数据线和一对时钟线、I²C、复位，以及 1.2 V、1.8 V、2.8 V 三路电源' });
design(['J3'], added,
  { part: '24-pin FPC connector', pkg: '0.5 mm FPC', role: 'LCD connector; its pinout follows the panel chosen' },
  { part: '24 针 FPC 座', pkg: '0.5 mm FPC', role: 'LCD 排线座，引脚定义跟随所选屏幕' });

// ---------- Audio, sensors, buttons, LEDs (design) ----------
design(['MK1'], { en: 'None · the reference board leaves the mic input unconnected', zh: '无 · 参考板没有使用麦克风输入' },
  { part: 'Electret microphone', pkg: '4 mm', role: 'Records sound into the codec ADC through the differential MICIN1P / N input' },
  { part: '驻极体麦克风', pkg: '4 mm', role: '录音：经差分输入 MICIN1P / N 进入芯片内置音频编解码器的 ADC' });
design(['R84'], added,
  { part: 'Microphone bias resistor', pkg: '0402', role: 'Feeds the electret microphone its bias current' },
  { part: '麦克风偏置电阻', pkg: '0402', role: '给驻极体麦克风提供偏置电流' });
design(['R85'], added,
  { part: 'Microphone bias resistor', pkg: '0402', role: 'Bias on the microphone’s ground side, keeping the differential input balanced' },
  { part: '麦克风偏置电阻', pkg: '0402', role: '麦克风接地一侧的偏置，让差分输入两端对称' });
design(['U11'], added,
  { part: 'SC7A20 accelerometer', pkg: 'LGA-12, 2 × 2 mm · Silan', role: 'Measures acceleration on three axes; past a threshold, the firmware marks the current clip so loop recording won’t overwrite it' },
  { part: 'SC7A20 三轴加速度计', pkg: 'LGA-12，2 × 2 mm · 士兰微', role: '测量三轴加速度；超过阈值时，由固件把当前视频标记为保护，循环录像不会覆盖' });
design(['C90', 'C91'], added,
  { part: '100 nF capacitor', pkg: '0402', role: 'Decoupling for the accelerometer (U11)' },
  { part: '100 nF 电容', pkg: '0402', role: '加速度计（U11）的去耦电容' });
design(range('SW', 1, 3), added,
  { part: 'Side tact switch', pkg: 'SMD', role: 'One of three side buttons: power, menu and record' },
  { part: '侧面轻触按键', pkg: '贴片', role: '侧面三颗按键之一：电源、菜单、录像' });
const ledBoard = {
  en: 'None in this role · the reference board’s LED1 / LED2 are Ethernet status lights',
  zh: '无同用途器件 · 参考板的 LED1、LED2 是以太网状态灯',
};
design(['LED1'], ledBoard, { part: 'Red LED', pkg: '0603', role: 'Recording indicator' }, { part: '红色 LED', pkg: '0603', role: '录像指示灯' }, 'adapted');
design(['LED2'], ledBoard, { part: 'Blue LED', pkg: '0603', role: 'Power indicator' }, { part: '蓝色 LED', pkg: '0603', role: '电源指示灯' }, 'adapted');
const ledResBoard = {
  en: 'None in this role · the reference board’s R21 / R22 (330 Ω) drive its Ethernet lights',
  zh: '无同用途器件 · 参考板的 R21、R22（330 Ω）用于以太网状态灯',
};
design(['R21'], ledResBoard, { part: 'LED current-limit resistor', pkg: '0402', role: 'Sets the current through LED1' }, { part: 'LED 限流电阻', pkg: '0402', role: '限制 LED1 的电流' }, 'adapted');
design(['R22'], ledResBoard, { part: 'LED current-limit resistor', pkg: '0402', role: 'Sets the current through LED2' }, { part: 'LED 限流电阻', pkg: '0402', role: '限制 LED2 的电流' }, 'adapted');

// ---------- Supercaps (design) ----------
design(['R40', 'R41'], added,
  { part: 'Balancing resistor', pkg: '0402', role: 'Splits the voltage evenly across the two supercap cells, so neither goes past its 2.7 V rating' },
  { part: '均压电阻', pkg: '0402', role: '让两颗超级电容平分电压，单颗都不超过 2.7 V 的额定值' });
design(['P1'], added,
  { part: 'Supercap lead, +', pkg: 'Wire solder pad', role: 'The supercap pack’s positive lead is hand-soldered here' },
  { part: '超级电容引线（+）', pkg: '焊线焊盘', role: '超级电容组的正极引线手工焊在这里' });
design(['P2'], added,
  { part: 'Supercap lead, −', pkg: 'Wire solder pad', role: 'The supercap pack’s negative lead is hand-soldered here' },
  { part: '超级电容引线（−）', pkg: '焊线焊盘', role: '超级电容组的负极引线手工焊在这里' });

// ---------- V851S decoupling (design; values as the reference board uses for decoupling and bulk) ----------
design(range('C', 50, 68), { en: 'None one-to-one · 100 nF is the value the reference board uses for decoupling', zh: '无一一对应 · 100 nF 与参考板去耦电容的取值相同' },
  { part: '100 nF capacitor', pkg: '0402', role: 'Decoupling at a V851S supply pin' },
  { part: '100 nF 电容', pkg: '0402', role: '靠近 V851S 电源引脚的去耦电容' });
design(range('C', 70, 72), { en: 'None one-to-one · 22 µF is the value the reference board uses for bulk', zh: '无一一对应 · 22 µF 与参考板储能电容的取值相同' },
  { part: '22 µF capacitor', pkg: '0603', role: 'Bulk capacitor near the V851S supply pins' },
  { part: '22 µF 电容', pkg: '0603', role: 'V851S 电源引脚附近的储能电容' });
design(range('C', 80, 87), added,
  { part: '100 nF capacitor', pkg: '0402', role: 'Decoupling right under the V851S, the shortest path to its supply pins' },
  { part: '100 nF 电容', pkg: '0402', role: '放在 V851S 正下方的去耦电容，离电源引脚最近' });

// ---------- Bottom side: parts from the reference circuit, moved under the board ----------
ref(['R80'], 'R16', 'moved', moved('R16'),
  { part: '5.1 kΩ resistor', pkg: '0402', role: 'USB-C CC1 pull-down: tells the charger to supply 5 V' },
  { part: '5.1 kΩ 电阻', pkg: '0402', role: 'USB-C 的 CC1 下拉电阻，让充电器知道可以输出 5 V' });
ref(['R81'], 'R17', 'moved', moved('R17'),
  { part: '5.1 kΩ resistor', pkg: '0402', role: 'USB-C CC2 pull-down, for the other plug orientation' },
  { part: '5.1 kΩ 电阻', pkg: '0402', role: 'USB-C 的 CC2 下拉电阻，对应插头反插' });
design(['C88'], added,
  { part: '100 nF capacitor', pkg: '0402', role: 'Decoupling on the 5 V input, next to the connector' },
  { part: '100 nF 电容', pkg: '0402', role: '5 V 输入端的去耦电容，紧挨接口' });
ref(['R82'], 'R8', 'moved', moved('R8'),
  { part: '1 kΩ resistor', pkg: '0402 · UNI-ROYAL 0402WGF1001TCE', role: 'Series resistor on the microSD card-detect line' },
  { part: '1 kΩ 电阻', pkg: '0402 · 厚声 0402WGF1001TCE', role: 'microSD 插卡检测线上的串联电阻' });
ref(['R83'], 'R7', 'moved', moved('R7'),
  { part: '33 Ω resistor', pkg: '0402 · UNI-ROYAL 0402WGF330JTCE', role: 'Series resistor on the microSD clock line (SDC0_CLK)' },
  { part: '33 Ω 电阻', pkg: '0402 · 厚声 0402WGF330JTCE', role: 'microSD 时钟线（SDC0_CLK）上的串联电阻' });
ref(['C89'], 'C6', 'moved', moved('C6'),
  { part: '100 nF capacitor', pkg: `0402 · ${SAMSUNG_100N}`, role: 'Decoupling on the microSD socket supply (3.3 V)' },
  { part: '100 nF 电容', pkg: `0402 · ${SAMSUNG_100N}`, role: 'microSD 卡座电源的去耦电容（3.3 V）' });
