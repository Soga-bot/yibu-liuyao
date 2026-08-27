// tools/convert-baihua-shiyi.mjs — 十翼白话（系辞上/下传 + 说卦传 + 文言/序/杂）校验与生成
// 输入：docs/已校对-十翼白话.txt + docs/已校对-文言序杂白话.txt（均外审闭环归档，2026-08-27）
// 输出：data/baihua-shiyi.js（供 pages/dianji/shiyi 逐句对照渲染）
// 硬校验（不过不出文件）：
//   1) 每章所有「原｜」句拼接（剔除空白与全角空格）须与 data/shiyi.js 对应章文
//      全等 —— 机器保证逐句完整、不脱句不漏句不改字（「详细完整」的落地手段）；
//   2) 原句必配译句、译句非空；
//   3) 57 章（系辞上 12 / 系辞下 13 / 说卦 11 / 文言乾 11 / 文言坤 7 / 序卦 2 / 杂卦 1）不缺无重；
//   4) 审核红线词扫描（算命/预测/占算/运势/改运）。
// 用法：node tools/convert-baihua-shiyi.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { SHUOGUA, getXici, WENYAN_QIAN, WENYAN_KUN, XUGUA_CH, ZAGUA_CH } from '../data/shiyi.js'

const SRC = ['docs/已校对-十翼白话.txt', 'docs/已校对-文言序杂白话.txt']
const OUT = 'data/baihua-shiyi.js'
const HEAD = /^【(系辞上传|系辞下传|说卦传|文言传·乾|文言传·坤|序卦传|杂卦传)｜([一二三四五六七八九十上中下全]+)】$/
const BAN = /算命|预测|占算|运势|改运/ // 审核红线词（古籍语境允许「占筮/占问」）
const strip = s => s.replace(/[\s　]/g, '')

// —— 解析素材：章头行开新章，「原｜/译｜」必须交替成对 ——
const chapters = []
const seen = new Set()
for (const f of SRC) {
  let cur = null // 每份素材独立：文件头标题/说明区不受上一文件末章影响
  for (const raw of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^[>＞]/.test(line) || line.startsWith('#')) continue // 空行/校注/标题
    const h = line.match(HEAD)
    if (h) {
      if (cur) chapters.push(cur)
      const key = h[1] + '|' + h[2]
      if (seen.has(key)) { console.error('重复章头：' + key); process.exit(1) }
      seen.add(key)
      cur = { book: h[1], h: h[2], pairs: [], pending: null }
      continue
    }
    if (!cur) continue // 首个章头之前是文件标题/说明区，不解析
    const m = line.match(/^(原｜|译｜)(.*)$/)
    if (!m) { console.error('无法识别的行（' + f + '）：' + line); process.exit(1) }
    if (m[1] === '原｜') {
      if (cur.pending !== null) { console.error('[' + cur.book + '｜' + cur.h + '] 原句后未接译句：' + cur.pending); process.exit(1) }
      cur.pending = m[2]
    } else {
      if (cur.pending === null) { console.error('[' + cur.book + '｜' + cur.h + '] 译句缺少原句：' + m[2]); process.exit(1) }
      cur.pairs.push({ y: cur.pending, b: m[2] })
      cur.pending = null
    }
  }
  if (cur) chapters.push(cur)
}

// —— 与 data/shiyi.js 对章校验：章齐 + 原文拼接全等 ——
const want = {}
for (const b of [...getXici(),
  { book: '说卦传', chapters: SHUOGUA },
  { book: '文言传·乾', chapters: WENYAN_QIAN },
  { book: '文言传·坤', chapters: WENYAN_KUN },
  { book: '序卦传', chapters: XUGUA_CH },
  { book: '杂卦传', chapters: ZAGUA_CH }
]) {
  for (const c of b.chapters) want[b.book + '|' + c.h] = c.t
}
const miss = Object.keys(want).filter(k => !seen.has(k))
const extra = [...seen].filter(k => !want[k])
if (miss.length) { console.error('缺少章：' + miss.join('、')); process.exit(1) }
if (extra.length) { console.error('多出章：' + extra.join('、')); process.exit(1) }

let yChars = 0, bChars = 0, pairCount = 0
for (const ch of chapters) {
  if (ch.pending !== null) { console.error('[' + ch.book + '｜' + ch.h + '] 末尾原句未接译句'); process.exit(1) }
  if (!ch.pairs.length) { console.error('[' + ch.book + '｜' + ch.h + '] 无句对'); process.exit(1) }
  const got = strip(ch.pairs.map(p => p.y).join(''))
  const t = strip(want[ch.book + '|' + ch.h])
  if (got !== t) {
    let i = 0
    while (i < got.length && i < t.length && got[i] === t[i]) i++
    console.error('[' + ch.book + '｜' + ch.h + '] 原文拼接与章文不符（第 ' + (i + 1) + ' 字起）：')
    console.error('  章文：…' + t.slice(Math.max(0, i - 8), i + 12))
    console.error('  拼接：…' + got.slice(Math.max(0, i - 8), i + 12))
    process.exit(1)
  }
  for (const p of ch.pairs) {
    if (!p.b.trim()) { console.error('[' + ch.book + '｜' + ch.h + '] 译句为空：' + p.y); process.exit(1) }
    if (BAN.test(p.y) || BAN.test(p.b)) {
      console.error('[' + ch.book + '｜' + ch.h + '] 触审核红线词：' + p.y + ' / ' + p.b); process.exit(1)
    }
    yChars += p.y.length; bChars += p.b.length; pairCount++
  }
}

// —— 生成 data/baihua-shiyi.js ——
const order = ['系辞上传', '系辞下传', '文言传·乾', '文言传·坤', '说卦传', '序卦传', '杂卦传']
const byBook = new Map(order.map(bk => [bk, []]))
for (const ch of chapters) byBook.get(ch.book).push(ch)
const body = []
for (const bk of order) {
  for (const ch of byBook.get(bk)) {
    body.push('  ' + JSON.stringify(bk + '|' + ch.h) + ': [')
    for (const p of ch.pairs) body.push('    { y: ' + JSON.stringify(p.y) + ', b: ' + JSON.stringify(p.b) + ' },')
    body.push('  ],')
  }
}
const out = `// data/baihua-shiyi.js — 十翼通读白话（系辞上下/说卦/文言乾坤/序卦/杂卦逐句对照）
// 由 docs/已校对-十翼白话.txt 与 docs/已校对-文言序杂白话.txt 生成，tools/convert-baihua-shiyi.mjs
// （生成时已机器校验：每章原句拼接与 data/shiyi.js 章文全等，不脱不漏）
// 定位：帮助阅读的白话参考译文（依通行译注传统直译，非学术定本，原文为准）
// 末尾 getWenyanBh/getXuguaBh/getZaguaBh 为卦详情页节选白话映射（改须改转换器模板，勿直改本文件）
import { WENYAN, getXugua, getZagua } from './shiyi.js'

export const BH_SHIYI = {
${body.join('\n')}
}

// 取某章句对（book 为「系辞上传/系辞下传/说卦传/文言传·乾/文言传·坤/序卦传/杂卦传」，h 为中文章号）
export function getShiyiBh(book, h) {
  return BH_SHIYI[book + '|' + h] || null
}

// —— 卦详情页节选白话映射（文言乾坤逐段 / 序卦 / 杂卦） ——
// 归一化口径与 tools/check-shiyi-vs-zhouyi.mjs 一致：去编者括注与空白、去全部
// 标点（中西文引号），遯→遁（校勘约定，docs/校勘备注.md）。以归一化文本在句对
// 中定位连续原文区间，取对应译句拼接——与 data/shiyi.js 节选（getXugua 等）同源，
// 机器保证对齐：节选或句对任一侧变更，此处即失配返回空串，由测试兜底报警。
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一']
const BH_NORM = s => s
  .replace(/（[^）]*）/g, '')
  .replace(/[\\s　]/g, '')
  .replace(/遯/g, '遁')
  .replace(/[，。、；：？！,.;:?!「」『』“”‘’"'《》〈〉（）()·—…\\-～]/g, '')

// 在指定章句对中找连续区间：原文归一化拼接全等于 frag 时返回译句拼接
const bhRun = (frag, keys) => {
  const target = BH_NORM(frag)
  for (const k of keys) {
    const pairs = BH_SHIYI[k] || []
    for (let i = 0; i < pairs.length; i++) {
      let acc = ''
      for (let j = i; j < pairs.length; j++) {
        acc += BH_NORM(pairs[j].y)
        if (acc === target) return pairs.slice(i, j + 1).map(p => p.b).join('')
        if (acc.length >= target.length) break
      }
    }
  }
  return ''
}

// 文言（仅乾坤）：逐段白话，段序与 getWenyan() 一致（章号即段序，十一段封顶）
export function getWenyanBh(key) {
  const qian = key === '111111', kun = key === '000000'
  if (!qian && !kun) return null
  const segs = qian ? WENYAN.qian : WENYAN.kun
  const book = qian ? '文言传·乾' : '文言传·坤'
  return segs.map((t, i) => bhRun(t, [book + '|' + CN_NUM[i]]))
}

// 序卦：本卦序卦句白话（坤条复用乾起首语并含编者括注、咸条复用下篇起首长句，
// 均由归一化剔除括注后按原文区间命中）
export function getXuguaBh(key) {
  const frag = getXugua(key)
  return frag ? bhRun(frag, ['序卦传|上', '序卦传|下']) : ''
}

// 杂卦：本卦杂卦句白话（相邻两卦共用一句，如大壮/遯）
export function getZaguaBh(key) {
  const frag = getZagua(key)
  return frag ? bhRun(frag, ['杂卦传|全']) : ''
}
`
writeFileSync(OUT, out)
console.log('OK ' + OUT + '：' + chapters.length + ' 章 / ' + pairCount + ' 句对 / 原文 ' + yChars + ' 字 / 白话 ' + bChars + ' 字')
