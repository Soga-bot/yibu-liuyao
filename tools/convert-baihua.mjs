// tools/convert-baihua.mjs — 把 docs/待填充-白话翻译.txt 的填写内容并入 data/baihua.js
// 用法：node tools/convert-baihua.mjs
// 已完成的 8 试点卦（乾坤屯蒙需讼师比）以 txt 为准前不覆盖（txt 里本就没有它们）。
// txt 中某卦若与 baihua.js 重复，以 txt 为准（用户最新填写）。
import { readFileSync, writeFileSync } from 'node:fs'
import { GUA_LIST } from '../data/gua.js'
import { BAIHUA } from '../data/baihua.js'

const SLOT = /^(卦辞|初六|初九|九二|六二|九三|六三|九四|六四|九五|六五|上九|上六|用九|用六)：(.*)$/
const lines = readFileSync('docs/待填充-白话翻译.txt', 'utf8').split(/\r?\n/)

const parsed = new Map() // seq -> {n, guaci, yaoci[], yong?}
let seq = null, pendingTi = null, collecting = false, buf = []
const flush = () => {
  if (seq == null || pendingTi == null || !buf.length) { collecting = false; return }
  const val = buf.map(s => s.trim()).filter(Boolean).join('')
  const e = parsed.get(seq)
  if (pendingTi === '卦辞') e.guaci = val
  else if (pendingTi === '用九' || pendingTi === '用六') e.yong = val
  else e.yaoci.push(val)
  buf = []; collecting = false
}
for (const line of lines) {
  const h = line.match(/^【第(\d+)卦 · (.+?)】/)
  if (h) { flush(); seq = +h[1]; parsed.set(seq, { n: h[2], guaci: '', yaoci: [], yong: '' }); continue }
  if (/^-{10,}$/.test(line.trim())) { flush(); pendingTi = null; continue }
  const s = line.match(SLOT)
  if (s) { flush(); pendingTi = s[1]; continue }
  if (line.trim() === '白话＞') { collecting = true; buf = []; continue }
  if (collecting) {
    if (!line.trim()) { flush(); continue }        // 空行结束取值
    if (line.startsWith('（在此填写）')) { buf = []; flush(); continue }
    buf.push(line)
  }
}
flush()

// 合并：旧 8 试点 + txt 新填
const merged = {}
for (const g of GUA_LIST) {
  const old = BAIHUA[g.key]
  const fresh = parsed.get(g.seq)
  if (fresh && fresh.guaci && fresh.yaoci.length === 6) {
    if (fresh.n !== g.name) throw new Error(`锚点不符：第${g.seq}卦 txt=${fresh.n} gua=${g.name}`)
    merged[g.key] = { n: g.name, guaci: fresh.guaci, yaoci: fresh.yaoci }
    if (fresh.yong) merged[g.key].yong = fresh.yong
  } else if (old) {
    merged[g.key] = old
  } else {
    console.error(`✗ 第${g.seq}卦 ${g.name} 无白话（txt:${fresh ? '不完整' : '缺失'}）`)
  }
}

// 生成 data/baihua.js
const esc = v => JSON.stringify(v)
let out = `// data/baihua.js — 卦辞/爻辞白话翻译层（全 64 卦）
// 由 docs/待填充-白话翻译.txt 填写内容生成（tools/convert-baihua.mjs），
// 试点 8 卦（乾坤屯蒙需讼师比）为原手写版。
// 规范（审核红线）：
//   1. 只译字面与传统注疏共识，不作吉凶断言、不引入预测口吻
//   2. 每条 1~2 句；生僻意象先直译再点一句传统理解，用「传统认为/古人以…喻」引出
//   3. 不杜撰：以通行本经文为本，参照传统注疏的白话共识
// 字段：n 卦名锚点 / guaci 卦辞白话 / yaoci 六爻白话(初→上) / yong 用九用六白话(仅乾坤)

export const BAIHUA = {
`
for (const g of GUA_LIST) {
  const e = merged[g.key]
  if (!e) continue
  out += `  // ${g.seq} ${g.name}\n`
  out += `  ${esc(g.key)}: {\n    n: ${esc(e.n)},\n    guaci: ${esc(e.guaci)},\n    yaoci: [\n`
  for (const y of e.yaoci) out += `      ${esc(y)},\n`
  out += `    ]`
  if (e.yong) out += `,\n    yong: ${esc(e.yong)}`
  out += `\n  },\n`
}
out += `}

// 按卦 key 取白话（无则返回 null）
export const getBaihua = key => BAIHUA[key] || null
`
writeFileSync('data/baihua.js', out, 'utf8')

const total = Object.keys(merged).length
const withYong = Object.values(merged).filter(e => e.yong).length
console.log(`已生成 data/baihua.js：${total}/64 卦（含用九用六 ${withYong} 条）`)
const freshCnt = [...parsed.values()].filter(e => e.guaci && e.yaoci.length === 6).length
console.log(`本次从 txt 并入：${freshCnt} 卦`)
