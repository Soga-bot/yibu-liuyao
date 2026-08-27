// tools/qa-baihua-shiyi.mjs — 文言/序/杂白话素材机器复核（外审前辅助 + 归档后回归）
// 定位：对 docs/已校对-文言序杂白话.txt（2026-08-27 终审闭环归档）的扫描——
//   硬闸（失败退出）：章头集合齐全无重、原/译交替成对、译句非空、审核红线词；
//   软报告（不判死，供外审聚焦）：繁体字标注（允许出现，仅提示）、术语译例偏离、译文/原文长度比异常。
// 注：原文与 data/shiyi.js 的字级全等由 tools/convert-baihua-shiyi.mjs 生成时硬校验，此处不重复。
// 用法：node tools/qa-baihua-shiyi.mjs
import { readFileSync } from 'node:fs'

const SRC = 'docs/已校对-文言序杂白话.txt'
const HEAD = /^【(文言传·乾|文言传·坤|序卦传|杂卦传)｜([一二三四五六七八九十上中下全]+)】$/
const BAN = /算命|预测|占算|运势|改运/ // 审核红线词（古籍语境允许「占筮/占问」）
// 简体文本不应出现的常见繁体形（「遯」为校勘约定保留字，原/译两层皆合法，不在扫描列）
const TRAD = /[於為後無龍聖賢禮樂氣陰陽淵將隨臨觀剝復]/

const chapters = []
let cur = null
for (const raw of readFileSync(SRC, 'utf8').split(/\r?\n/)) {
  const line = raw.trim()
  if (!line || /^[>＞]/.test(line) || line.startsWith('#')) continue
  const h = line.match(HEAD)
  if (h) { if (cur) chapters.push(cur); cur = { key: h[1] + '|' + h[2], pairs: [], pending: null }; continue }
  if (!cur) continue
  const m = line.match(/^(原｜|译｜)(.*)$/)
  if (!m) { console.error('无法识别的行：' + line); process.exit(1) }
  if (m[1] === '原｜') { if (cur.pending !== null) { console.error('[' + cur.key + '] 原句后未接译句'); process.exit(1) }; cur.pending = m[2] }
  else { if (cur.pending === null) { console.error('[' + cur.key + '] 译句缺少原句'); process.exit(1) }; cur.pairs.push({ y: cur.pending, b: m[2] }); cur.pending = null }
}
if (cur) chapters.push(cur)

// —— 硬闸 1：章头集合（文言乾 11 / 坤 7 / 序卦 2 / 杂卦 1，共 21 章）——
const WANT = ['文言传·乾|一', '文言传·乾|二', '文言传·乾|三', '文言传·乾|四', '文言传·乾|五', '文言传·乾|六', '文言传·乾|七', '文言传·乾|八', '文言传·乾|九', '文言传·乾|十', '文言传·乾|十一',
  '文言传·坤|一', '文言传·坤|二', '文言传·坤|三', '文言传·坤|四', '文言传·坤|五', '文言传·坤|六', '文言传·坤|七',
  '序卦传|上', '序卦传|下', '杂卦传|全']
const got = chapters.map(c => c.key)
const miss = WANT.filter(k => !got.includes(k)), extra = got.filter(k => !WANT.includes(k))
if (miss.length || extra.length || got.length !== new Set(got).size) {
  console.error('✗ 章头异常：缺[' + miss.join('、') + '] 多[' + extra.join('、') + ']'); process.exit(1)
}
console.log('✅ 章头齐全无重：21 章（文言乾 11 / 坤 7 / 序卦 2 / 杂卦 1）')

// —— 硬闸 2 + 红线：成对完整、译句非空、违禁词 ——
let pairs = 0, yChars = 0, bChars = 0, hard = false
for (const ch of chapters) {
  if (ch.pending !== null) { console.error('✗ [' + ch.key + '] 末尾原句未接译句'); hard = true }
  for (const p of ch.pairs) {
    pairs++
    yChars += p.y.length; bChars += p.b.length
    if (!p.b.trim()) { console.error('✗ [' + ch.key + '] 译句为空：' + p.y); hard = true }
    if (BAN.test(p.y) || BAN.test(p.b)) { console.error('✗ [' + ch.key + '] 触审核红线词：' + p.y); hard = true }
  }
}
if (hard) process.exit(1)
console.log('✅ ' + pairs + ' 句对成对完整、译句非空、无审核红线词（原文 ' + yChars + ' 字 / 白话 ' + bChars + ' 字）')

// —— 软报告：外审聚焦清单（不判死）——
const focus = []
for (const ch of chapters) {
  for (const p of ch.pairs) {
    const t = p.y.match(TRAD)
    if (t) focus.push('繁体「' + t[0] + '」（允许，仅标注）：' + p.y.slice(0, 24))
    if (/贞/.test(p.y) && !/守正|正固|固守|贞|征/.test(p.b)) focus.push('术语「贞」未见对应译语：' + p.y.slice(0, 24))
    const r = p.b.length / Math.max(1, p.y.replace(/[，。、；：？！「」]/g, '').length)
    if (!/一说|或说/.test(p.b) && (r > 3 || r < 0.5)) focus.push('译/原长度比 ' + r.toFixed(1) + ' 异常：' + p.y.slice(0, 24))
  }
}
if (focus.length) {
  console.log('\n▶ 外审建议聚焦 ' + focus.length + ' 处（不判死）：')
  focus.forEach(f => console.log('  · ' + f))
} else {
  console.log('\n▶ 软扫描零命中：无繁体标注项、术语与长度比均正常')
}
console.log('\n机器复核毕：档案健康（义理终审已于 2026-08-27 闭环）')
