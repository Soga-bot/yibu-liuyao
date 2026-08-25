// tools/gen-gua-data.mjs — 生成 64 卦知识库 data/gua.js
// 数据来源：
//   卦名/卦宫 → 本项目引擎（已 22/22 验证，避开伏羲的卦宫错误）
//   大象传/简短描述 → tools/reference/fuxi-gua.json（按卦名匹配，避开二进制 key 错误）
//   卦辞/爻辞/用九用六 → tools/reference/zhouyi.txt（《周易》原文，GB18030 已转 UTF-8）
// 运行：node tools/gen-gua-data.mjs
import fs from 'fs'
import { listAllHexagrams } from '../utils/liuyao.js'

const here = (p) => new URL(p, import.meta.url)

// 八卦 → 自然意象（"象"的规则化核心）
const BAGUA_XIANG = { 乾:'天', 坤:'地', 震:'雷', 巽:'风', 坎:'水', 离:'火', 艮:'山', 兑:'泽' }
const POS_NAME = ['初','二','三','四','五','上']
// 爻题（规则）：阳爻配"九"、阴爻配"六"；初/上 位置在前(初九/上九)，二三四五 九六在前(九二/六二…)
function yaoTi(pos, isYin) {
  const num = isYin ? '六' : '九'
  return (pos === 1 || pos === 6) ? POS_NAME[pos - 1] + num : num + POS_NAME[pos - 1]
}

// 1. 读取已抢救的伏羲知识（tools/reference/fuxi-gua.json，name -> {desc, daxiang}）
const fuxi = JSON.parse(fs.readFileSync(here('./reference/fuxi-gua.json'), 'utf8'))
console.log('伏羲知识条目数:', Object.keys(fuxi).length)

// 2. 文王序（1-64）
const SEQ_NAMES = ['乾','坤','屯','蒙','需','讼','师','比','小畜','履','泰','否',
  '同人','大有','谦','豫','随','蛊','临','观','噬嗑','贲','剥','复','无妄','大畜',
  '颐','大过','坎','离','咸','恒','遁','大壮','晋','明夷','家人','睽','蹇','解',
  '损','益','夬','姤','萃','升','困','井','革','鼎','震','艮','渐','归妹','丰',
  '旅','巽','兑','涣','节','中孚','小过','既济','未济']
const seqMap = {}
SEQ_NAMES.forEach((n, i) => seqMap[n] = i + 1)
console.log('文王序条目数:', SEQ_NAMES.length)

// 3. 解析《周易》原文经文部分（【上经】~【彖传上】之间）
//    结构：`X卦第N` 标题行 → `卦名：卦辞` 行 → `爻题：爻辞` 行（含乾用九/坤用六）
const zhouyiLines = fs.readFileSync(here('./reference/zhouyi.txt'), 'utf8').split(/\r?\n/)
const GUA_TITLE_RE = /^(\S{1,2})卦第[一二三四五六七八九十]+$/
const YAO_LINE_RE = /^(初九|初六|九二|六二|九三|六三|九四|六四|九五|六五|上九|上六|用九|用六)：(.+)$/
const GUACI = {}   // 卦名 -> 卦辞
const YAOCI = {}   // 卦名 -> { 爻题: 爻辞 }
const YONG = {}    // 卦名 -> { ti, ci }（乾用九 / 坤用六）
{
  const all = zhouyiLines.map(l => l.trim())
  const start = all.findIndex(l => l === '【上经】')
  const end = all.findIndex(l => l === '【彖传上】')
  if (start < 0 || end < 0) throw new Error('周易.txt 缺少【上经】/【彖传上】分节标记')
  let cur = null, seenYao = false
  const stray = []
  for (const line of all.slice(start + 1, end)) {
    if (!line || /^【.+】$/.test(line)) continue
    const tm = line.match(GUA_TITLE_RE)
    if (tm && seqMap[tm[1]]) { cur = tm[1]; seenYao = false; continue }
    if (!cur) continue
    const ym = line.match(YAO_LINE_RE)
    if (ym) {
      seenYao = true
      if (ym[1] === '用九' || ym[1] === '用六') YONG[cur] = { ti: ym[1], ci: ym[2] }
      else (YAOCI[cur] = YAOCI[cur] || {})[ym[1]] = ym[2]
      continue
    }
    // 卦辞行：`卦名：…`（特例：坎卦经文作「习坎」）
    if (!seenYao && (line.startsWith(cur + '：') || (cur === '坎' && line.startsWith('习坎：')))) {
      GUACI[cur] = line.replace(/^习?/, '').slice(cur.length + 1)
      continue
    }
    stray.push(line) // 兜底：可能的折行续文，打印出来人工核对
  }
  if (stray.length) console.log('⚠️ 未识别行(' + stray.length + '):', stray.slice(0, 5).join(' / '))
  let yaoCount = 0
  for (const k in YAOCI) yaoCount += Object.keys(YAOCI[k]).length
  console.log(`周易原文：卦辞 ${Object.keys(GUACI).length}/64 ｜爻辞 ${yaoCount}/384 ｜用九用六 ${Object.keys(YONG).length}/2`)
  if (Object.keys(GUACI).length !== 64 || yaoCount !== 384 || Object.keys(YONG).length !== 2) {
    throw new Error('周易原文解析不完整，请检查 zhouyi.txt 后重试')
  }
}

// 4. 合并
const data = {}
const list = []
const missingFuxi = []
const missingYuanwen = []
for (const h of listAllHexagrams()) {
  const f = fuxi[h.name]
  if (!f) missingFuxi.push(h.name)
  const bits = h.key.split('').map(Number) // 初→上，1=阳 0=阴
  const zy = YAOCI[h.name] || {}
  const yaoci = bits.map((b, i) => {
    const ti = yaoTi(i + 1, b === 0)        // 规则爻题（初九/六二…）
    return { ti, ci: zy[ti] || '' }          // 爻题对不上原文时 ci 为空，下方校验兜底
  })
  if (!GUACI[h.name] || yaoci.some(y => !y.ci)) missingYuanwen.push(h.name)
  const entry = {
    seq: seqMap[h.name] || 0,
    key: h.key,
    name: h.name,
    gong: h.gong,
    nei: h.nei,                     // 下卦(内卦)八卦名
    wai: h.wai,                     // 上卦(外卦)八卦名
    neiXiang: BAGUA_XIANG[h.nei],   // 下卦自然象（规则推导）
    waiXiang: BAGUA_XIANG[h.wai],   // 上卦自然象（规则推导）
    daxiang: f ? f.daxiang : '',    // 大象传(源自伏羲，部分仅"象")
    desc: f ? f.desc : '',
    guaci: GUACI[h.name] || '',     // 卦辞原文（《周易》）
    yaoci,                          // 六爻爻题(规则)+爻辞(《周易》原文)，初→上
    ...(YONG[h.name] ? { yong: YONG[h.name] } : {})  // 乾用九/坤用六
  }
  data[h.key] = entry
  list.push(entry)
}
list.sort((a, b) => a.seq - b.seq)
console.log('总卦数:', list.length,
  '｜缺伏羲数据:', missingFuxi.length ? missingFuxi.join(',') : '无',
  '｜缺周易原文:', missingYuanwen.length ? missingYuanwen.join(',') : '无')

// 5. 输出 data/gua.js
const out = `// data/gua.js — 64卦知识库（由 tools/gen-gua-data.mjs 自动生成，勿手改）
// 重新生成：node tools/gen-gua-data.mjs
//
// 字段：
//   key      6 位二进制(初→上，1=阳0=阴)，排盘查表主键
//   seq      文王序(1-64)
//   name     卦名
//   gong     卦宫
//   nei/wai  下卦/上卦(八卦名)
//   neiXiang/waiXiang  下卦/上卦自然象(规则推导：天地雷风水火山泽)
//   daxiang  大象传（源自伏羲，部分仅"象"缺"君子以…"，待校补）
//   desc     简短描述（卦象组合+概括，导语）
//   guaci    卦辞原文（源自《周易》tools/reference/zhouyi.txt）
//   yaoci    六爻 [{ti:爻题(规则), ci:爻辞原文(《周易》)}] 初→上
//   yong     仅乾坤有：{ti:用九/用六, ci:原文}

export const GUA_DATA = ${JSON.stringify(data, null, 2)}

// 按文王序排列的数组（典籍库浏览用）
export const GUA_LIST = ${JSON.stringify(list, null, 2)}

// 排盘查表：传入 6 位 key → 卦条目
export function getGua(key) { return GUA_DATA[key] }
`
fs.mkdirSync(here('../data'), { recursive: true })
fs.writeFileSync(here('../data/gua.js'), out)
console.log('已生成 data/gua.js')
