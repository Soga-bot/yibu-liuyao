// tools/check-shiyi-vs-zhouyi.mjs — shiyi.js 文言/序/杂 原文层 vs zhouyi.txt 双源交叉核对
// 背景：shiyi.js 三篇为凭记忆录入（见 gen-shiyi-check.mjs 头注），zhouyi.txt 为
// 独立来源的整本录入——两源字级一致即交叉验证通过；分歧逐条裁定（真错改
// shiyi.js，版本/点校差异保留并记档）。
// 核对口径：
//   字级（硬闸）——去全部标点/空白、引号统一剥除、遯→遁（校勘约定，docs/校勘备注.md），
//   两串必须完全相等；不等则逐处分歧定位打印。
//   点级（软口径）——逗号顿号句读差异不判错（两本点校风格异，shiyi.js 从黄寿祺点校）。
// 用法：node tools/check-shiyi-vs-zhouyi.mjs
import { readFileSync } from 'node:fs'
import { WENYAN, XUGUA_CH, ZAGUA_CH } from '../data/shiyi.js'

const raw = readFileSync('tools/reference/zhouyi.txt', 'utf8')
// —— 分段：文件区序＝【文言传】乾 → 坤文言 → 系辞上/下 → 说卦 → 序卦 → 杂卦 ——
const sec = (from, to) => raw.slice(raw.indexOf(from) + from.length, to ? raw.indexOf(to) : raw.length)
// 行清洗：>接续 行去掉「接续上文截断处：」标签后并入正文；被截断的半行
// （其后紧跟 >接续 行者）整行丢弃——补记行内含完整文本
const clean = s => {
  const ls = s.split('\n')
  const out = []
  for (let i = 0; i < ls.length; i++) {
    if (ls[i + 1] && /^>接续/.test(ls[i + 1])) continue
    out.push(ls[i].replace(/^>接续上文截断处：?/, '').replace(/^>\s?/, ''))
  }
  return out.join('')
}
const xuAll = sec('【序卦传】', '\n【杂卦传】').split(/\n[ \t]*\n/).filter(p => p.trim()).map(clean)
if (xuAll.length !== 2) { console.error('✗ 序卦应两段（上/下篇），得 ' + xuAll.length); process.exit(1) }
const zhou = {
  wyQian: clean(sec('【文言传】', '\n坤文言')).replace(/^文言曰：/, ''),
  wyKun: clean(sec('\n坤文言', '\n【系辞上传】')),
  xuShang: xuAll[0],
  xuXia: xuAll[1],
  za: clean(sec('【杂卦传】', null))
}
const mine = {
  wyQian: WENYAN.qian.join(''),
  wyKun: WENYAN.kun.join(''),
  xuShang: XUGUA_CH[0].t,
  xuXia: XUGUA_CH[1].t,
  za: ZAGUA_CH[0].t
}
// —— 归一化：去空白；遯→遁（用字约定同化）；去全部标点（含中西文引号） ——
const norm = s => s.replace(/[\s　]/g, '').replace(/遯/g, '遁')
  .replace(/[，。、；：？！,.;:?!「」『』“”‘’"'《》〈〉（）()·—…\-～]/g, '')

let total = 0
const CMP = [['文言传·乾', mine.wyQian, zhou.wyQian], ['文言传·坤', mine.wyKun, zhou.wyKun],
  ['序卦传·上', mine.xuShang, zhou.xuShang], ['序卦传·下', mine.xuXia, zhou.xuXia], ['杂卦传', mine.za, zhou.za]]
for (const [name, a, b] of CMP) {
  const A = norm(a), B = norm(b)
  if (A === B) { console.log(`✅ ${name} 字级一致（${A.length} 字）`); continue }
  total++
  console.log(`✗ ${name} 字级不一致：shiyi ${A.length} 字 / zhouyi ${B.length} 字`)
  // 分歧定位：同步游走，失配处双方各示前后文；跳一字续走（容忍一版多一字）
  let i = 0, j = 0, n = 0
  const ctx = (s, p) => s.slice(Math.max(0, p - 10), p) + '【' + s.slice(p, p + 10) + '】'
  while (i < A.length && j < B.length && n < 12) {
    if (A[i] === B[j]) { i++; j++; continue }
    console.log(`   分歧${++n} @${i}: shiyi …${ctx(A, i)} / zhouyi …${ctx(B, j)}`)
    if (A[i + 1] === B[j]) i++            // shiyi 多一字
    else if (A[i] === B[j + 1]) j++       // zhouyi 多一字
    else { i++; j++ }                     // 异文替换
  }
}
console.log(total ? `\n共 ${total} 篇有字级分歧，逐条裁定（真错改 shiyi.js，版本差异记档保留）` : '\n五篇全部字级一致：双源交叉验证通过')
process.exit(total ? 1 : 0)
