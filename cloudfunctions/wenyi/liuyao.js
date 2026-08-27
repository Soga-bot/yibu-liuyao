// wenyi/liuyao.js — 由 tools/gen-wenyi-cloud.mjs 自动生成，勿手改
// 源文件：utils/liuyao.js（改动请改源文件后重跑生成器）
// utils/liuyao.js — 六爻排盘引擎（纯算法，零外部依赖）
//
// 输入：6 爻（初→上）的阴阳与动爻 + 日干支
// 输出：完整六爻排盘（卦名/卦宫/世应/纳甲/六亲/六神/空亡/变卦）
//
// 算法依据：火珠林（金钱卦/京房易）标准排盘规则。
// 本模块只含「结构化排盘」，不含卦辞/爻辞原文（那属于知识库，后续拼接）。

// ============ 天干地支 ============
const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']

// 地支 → 五行
const ZHI_WUXING = {
  子: '水', 亥: '水',
  寅: '木', 卯: '木',
  巳: '火', 午: '火',
  申: '金', 酉: '金',
  辰: '土', 戌: '土', 丑: '土', 未: '土'
}

// 卦宫 → 五行（宫卦本身的五行）
const GONG_WUXING = {
  乾: '金', 兑: '金',
  震: '木', 巽: '木',
  坎: '水',
  离: '火',
  坤: '土', 艮: '土'
}

// 五行相生（key 生 value）
const SHENG = { 金: '水', 水: '木', 木: '火', 火: '土', 土: '金' }
// 五行相克（key 克 value）
const KE = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' }

// a 对 b 的五行关系（"我"=a）
function wuxingRelation(a, b) {
  if (a === b) return '比和'
  if (SHENG[a] === b) return '我生'   // a 生 b
  if (SHENG[b] === a) return '生我'   // b 生 a
  if (KE[a] === b) return '我克'      // a 克 b
  if (KE[b] === a) return '克我'      // b 克 a
  return '比和'
}

// 关系 → 六亲（以宫五行为"我"）
const REL_TO_LIUQIN = {
  '比和': '兄弟', '我生': '子孙', '生我': '父母', '我克': '妻财', '克我': '官鬼'
}

// ============ 八卦 ============
// 三爻 [初,中,上]（bottom→top），1=阳 0=阴
const BAGUA_LIST = [
  { name: '乾', yao: [1, 1, 1] }, // ☰
  { name: '兑', yao: [1, 1, 0] }, // ☱
  { name: '离', yao: [1, 0, 1] }, // ☲
  { name: '震', yao: [1, 0, 0] }, // ☳
  { name: '巽', yao: [0, 1, 1] }, // ☴
  { name: '坎', yao: [0, 1, 0] }, // ☵
  { name: '艮', yao: [0, 0, 1] }, // ☶
  { name: '坤', yao: [0, 0, 0] }  // ☷
]
// 八卦顺序（用于卦名矩阵行列索引）
const BAGUA_ORDER = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']

// 三爻字符串 → 卦名
const YAO3_TO_BAGUA = {}
BAGUA_LIST.forEach(b => { YAO3_TO_BAGUA[b.yao.join('')] = b.name })
function yao3ToBagua(yao3) { return YAO3_TO_BAGUA[yao3.join('')] }

// 八卦纳甲：内/外卦各配 天干 + 三个地支
const BAGUA_NAJIA = {
  乾: { ganNei: '甲', ganWai: '壬', nei: ['子', '寅', '辰'], wai: ['午', '申', '戌'] },
  坤: { ganNei: '乙', ganWai: '癸', nei: ['未', '巳', '卯'], wai: ['丑', '亥', '酉'] },
  震: { ganNei: '庚', ganWai: '庚', nei: ['子', '寅', '辰'], wai: ['午', '申', '戌'] },
  巽: { ganNei: '辛', ganWai: '辛', nei: ['丑', '亥', '酉'], wai: ['未', '巳', '卯'] },
  坎: { ganNei: '戊', ganWai: '戊', nei: ['寅', '辰', '午'], wai: ['申', '戌', '子'] },
  离: { ganNei: '己', ganWai: '己', nei: ['卯', '丑', '亥'], wai: ['酉', '未', '巳'] },
  艮: { ganNei: '丙', ganWai: '丙', nei: ['辰', '午', '申'], wai: ['戌', '子', '寅'] },
  兑: { ganNei: '丁', ganWai: '丁', nei: ['巳', '卯', '丑'], wai: ['亥', '酉', '未'] }
}

// ============ 64 卦名矩阵（行=上卦，列=下卦，序：乾兑离震巽坎艮坤）============
const GUA_NAME = [
  ['乾', '履', '同人', '无妄', '姤', '讼', '遁', '否'],     // 上乾
  ['夬', '兑', '革', '随', '大过', '困', '咸', '萃'],       // 上兑
  ['大有', '睽', '离', '噬嗑', '鼎', '未济', '旅', '晋'],   // 上离
  ['大壮', '归妹', '丰', '震', '恒', '解', '小过', '豫'],   // 上震
  ['小畜', '中孚', '家人', '益', '巽', '涣', '渐', '观'],   // 上巽
  ['需', '节', '既济', '屯', '井', '坎', '蹇', '比'],       // 上坎
  ['大畜', '损', '贲', '颐', '蛊', '蒙', '艮', '剥'],       // 上艮
  ['泰', '临', '明夷', '复', '升', '师', '谦', '坤']        // 上坤
]
function guaName(neiBagua, waiBagua) {
  const r = BAGUA_ORDER.indexOf(waiBagua) // 上卦=行
  const c = BAGUA_ORDER.indexOf(neiBagua) // 下卦=列
  return GUA_NAME[r][c]
}

// ============ 八宫表（京房变卦法）============
// 每个 6 爻串 → { gong(宫), shi(世爻位1-6), ying(应爻位) }
function buildPalaceTable() {
  const table = {}
  BAGUA_LIST.forEach(gong => {
    // 本宫纯卦：内外卦都是该宫
    const base = gong.yao.concat(gong.yao) // [内0,内1,内2,外0,外1,外2]
    const add = (yao6, shi) => {
      table[yao6.join('')] = { gong: gong.name, shi, ying: ((shi + 2) % 6) + 1 }
    }
    // 本宫(世在6) → 一世..五世(世在1..5) → 游魂(世4) → 归魂(世3)
    let cur = base.slice()
    add(cur, 6)
    for (let i = 1; i <= 5; i++) {
      cur = cur.slice(); cur[i - 1] ^= 1
      add(cur, i)
    }
    // 游魂：从五世把第4爻变回
    cur = cur.slice(); cur[3] ^= 1
    add(cur, 4)
    // 归魂：内卦恢复成本宫
    cur = cur.slice()
    cur[0] = gong.yao[0]; cur[1] = gong.yao[1]; cur[2] = gong.yao[2]
    add(cur, 3)
  })
  return table
}
const PALACE_TABLE = buildPalaceTable()

// ============ 六神 ============
// 顺序（初→上）：青龙→朱雀→勾陈→螣蛇→白虎→玄武
const LIU_SHEN_ORDER = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武']
// 日干 → 起初爻的神序号
function shenStartByGan(gan) {
  switch (gan) {
    case '甲': case '乙': return 0
    case '丙': case '丁': return 1
    case '戊': return 2
    case '己': return 3
    case '庚': case '辛': return 4
    case '壬': case '癸': return 5
    default: return 0
  }
}

// ============ 空亡（旬空）============
// 输入日干支序号 idx(0-59, 0=甲子)，返回两个空亡地支
function kongWangByGanZhiIdx(idx) {
  const xunHead = idx - (idx % 10)          // 旬头序号(0,10,20,30,40,50)
  const zhiIdx = xunHead % 12               // 旬头地支序号
  return [DI_ZHI[(zhiIdx - 2 + 12) % 12], DI_ZHI[(zhiIdx - 1 + 12) % 12]]
}

// 干支字符串 → 序号(0-59)。如 '甲子'→0, '乙丑'→1 ...
function ganZhiToIdx(gan, zhi) {
  const gi = TIAN_GAN.indexOf(gan)
  const zi = DI_ZHI.indexOf(zhi)
  // 干支同进，序号 n 满足 n%10=gi 且 n%12=zi
  for (let n = 0; n < 60; n++) if (n % 10 === gi && n % 12 === zi) return n
  return -1
}

// ============ 公历日期 → 日干支（用于"今日"默认值，可手动核对）============
function dateToGanZhi(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
    Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
  const idx = ((jdn + 49) % 60 + 60) % 60 // 0=甲子（公历 proleptic，建议用万年历核对）
  return { gan: TIAN_GAN[idx % 10], zhi: DI_ZHI[idx % 12], idx }
}

// ============ 排盘主函数 ============
// 输入：
//   yao: 6 个对象 { yin:bool, dong:bool }，从 初爻(index0) 到 上爻(index5)
//        yin=false→阳爻, yin=true→阴爻；dong=true→动爻
//   dayGan: 日干（'甲'..'癸'），用于六神
//   dayZhi: 日支（'子'..'亥'），与日干合用算空亡
// 返回：完整排盘对象
function paipan({ yao, dayGan, dayZhi }) {
  if (!yao || yao.length !== 6) throw new Error('paipan: 需 6 爻')

  // 阴阳 → 0/1（初→上）
  const bits = yao.map(y => (y.yin ? 0 : 1))
  const key = bits.join('')

  // 内外卦
  const neiName = yao3ToBagua(bits.slice(0, 3))
  const waiName = yao3ToBagua(bits.slice(3, 6))
  const neiNa = BAGUA_NAJIA[neiName]
  const waiNa = BAGUA_NAJIA[waiName]

  // 卦名 / 卦宫 / 世应
  const name = guaName(neiName, waiName)
  const pal = PALACE_TABLE[key] || { gong: neiName, shi: 6, ying: 3 }
  const gong = pal.gong
  const gongWx = GONG_WUXING[gong]
  const shiPos = pal.shi
  const yingPos = pal.ying

  // 六神起点
  const shenStart = shenStartByGan(dayGan)

  // 空亡
  const gzIdx = ganZhiToIdx(dayGan, dayZhi)
  const kongSet = gzIdx >= 0 ? new Set(kongWangByGanZhiIdx(gzIdx)) : new Set()

  // 逐爻（pos 1=初..6=上）
  const lines = []
  for (let i = 0; i < 6; i++) {
    const pos = i + 1
    const isNei = pos <= 3
    const na = isNei ? neiNa : waiNa
    const zhi = isNei ? na.nei[pos - 1] : na.wai[pos - 4]
    const gan = isNei ? na.ganNei : na.ganWai
    const wx = ZHI_WUXING[zhi]
    const rel = wuxingRelation(gongWx, wx) // "我"=宫
    const qin = REL_TO_LIUQIN[rel]
    lines.push({
      pos,
      yin: !!yao[i].yin,
      dong: !!yao[i].dong,
      gan, zhi, wuxing: wx,
      liuqin: qin,                 // 六亲
      liushen: LIU_SHEN_ORDER[(shenStart + i) % 6], // 六神
      isShi: pos === shiPos,
      isYing: pos === yingPos,
      kong: kongSet.has(zhi)       // 空亡
    })
  }

  // 变卦（有动爻时）
  let bian = null
  if (yao.some(y => y.dong)) {
    const bianBits = bits.map((b, i) => yao[i].dong ? (b ^ 1) : b)
    const bNei = yao3ToBagua(bianBits.slice(0, 3))
    const bWai = yao3ToBagua(bianBits.slice(3, 6))
    const bName = guaName(bNei, bWai)
    bian = { name: bName, key: bianBits.join('') }
  }

  return {
    name,           // 本卦名
    gong,           // 卦宫
    gongWuxing: gongWx,
    nei: neiName,   // 下卦(内)
    wai: waiName,   // 上卦(外)
    shi: shiPos,    // 世爻位(1-6)
    ying: yingPos,  // 应爻位
    dayGan, dayZhi,
    kongWang: kongSet.size ? Array.from(kongSet) : [],
    lines,          // 初→上 6 爻
    bian            // 变卦 {name,key} 或 null
  }
}


// ============ 64 卦查询/列举（供知识库生成与查表）============
// 由 6 位 key(初→上，'1'=阳'0'=阴) 得到卦信息
function hexagramFromKey(key) {
  const bits = key.split('').map(Number)
  const neiName = yao3ToBagua(bits.slice(0, 3))
  const waiName = yao3ToBagua(bits.slice(3, 6))
  const pal = PALACE_TABLE[key] || { gong: neiName, shi: 6, ying: 3 }
  return {
    key, name: guaName(neiName, waiName), gong: pal.gong,
    nei: neiName, wai: waiName, shi: pal.shi, ying: pal.ying
  }
}

// 列出全部 64 卦（顺序为内部 PALACE_TABLE 的构建序）
function listAllHexagrams() {
  return Object.keys(PALACE_TABLE).map(hexagramFromKey)
}

module.exports = { TIAN_GAN, DI_ZHI, ZHI_WUXING, GONG_WUXING, BAGUA_LIST, BAGUA_ORDER, BAGUA_NAJIA, wuxingRelation, kongWangByGanZhiIdx, ganZhiToIdx, dateToGanZhi, paipan, hexagramFromKey, listAllHexagrams }
