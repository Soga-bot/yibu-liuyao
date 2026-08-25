// tools/convert-diangu.mjs — 把 docs/待填充-卦爻典故.txt 的条目生成 data/diangu.js
// 用法：node tools/convert-diangu.mjs
// 规范（审核红线）：只收录有典可查的条目并注明来源；不引入吉凶判断、不与现代占断挂钩。
import { readFileSync, writeFileSync } from 'node:fs'
import { GUA_LIST } from '../data/gua.js'

const byName = new Map(GUA_LIST.map(g => [g.name, g]))
const HEAD = /^(.+?)｜(卦辞|彖传|初六|初九|九二|六二|九三|六三|九四|六四|九五|六五|上九|上六)｜(.+)$/
const lines = readFileSync('docs/待填充-卦爻典故.txt', 'utf8').split(/\r?\n/)

const map = new Map() // 卦名+爻题 -> {ti, gu, lai}
let cur = null, field = null, buf = []
const flush = () => {
  if (!cur || !field || !buf.length) return
  cur[field] += (cur[field] ? '' : '') + buf.map(s => s.trim()).join('')
  buf = []
}
for (const line of lines) {
  const h = line.match(HEAD)
  if (h) {
    flush()
    const gname = h[1] === '遯' ? '遁' : h[1]
    cur = { name: gname, ti: h[2], gu: '', lai: '' }
    map.set(gname + '|' + h[2], cur)
    field = null
    continue
  }
  const d = line.match(/^＞典故：(.*)$/)
  if (d) { flush(); field = 'gu'; buf = [d[1]]; continue }
  const l = line.match(/^＞来源：(.*)$/)
  if (l) { flush(); field = 'lai'; buf = [l[1]]; continue }
  if (/^(=|-){5,}/.test(line.trim()) || line.startsWith('#') || line.startsWith('【')) { flush(); field = null; cur && (cur = cur); continue }
  if (field && line.trim() && /^\s{0,4}\S/.test(line)) { buf.push(line); continue }
  if (!line.trim()) { flush(); field = null }
}
flush()

// 校验 + 生成
const out = []
let dropped = 0
for (const [k, e] of map) {
  const g = byName.get(e.name)
  if (!g) { console.error(`✗ 无此卦：${e.name}`); dropped++; continue }
  if (!e.gu || !e.lai) { console.error(`✗ 缺典故/来源：${e.name}｜${e.ti}`); dropped++; continue }
  if (e.ti !== '卦辞' && e.ti !== '彖传' && !g.yaoci.some(y => y.ti === e.ti)) { console.error(`✗ 无此爻：${e.name}｜${e.ti}`); dropped++; continue }
  out.push({ key: g.key, ti: e.ti, gu: e.gu, lai: e.lai })
}
const rank = ti => ti === '卦辞' ? 0 : ti === '彖传' ? 1 : 2
out.sort((a, b) => GUA_LIST.findIndex(g => g.key === a.key) - GUA_LIST.findIndex(g => g.key === b.key) || rank(a.ti) - rank(b.ti))

const esc = v => JSON.stringify(v)
let js = `// data/diangu.js — 卦爻典故注释卡（由 docs/待填充-卦爻典故.txt 生成，tools/convert-diangu.mjs）
// 定位：说明爻辞背后的史事掌故与出处，帮助阅读理解；不用于断卦（审核红线）。
// 键：卦key:爻题（爻题为「卦辞」或初九…上六）。

export const DIANGU = {
`
for (const e of out) js += `  ${esc(e.key + ':' + e.ti)}: { ti: ${esc(e.ti)}, gu: ${esc(e.gu)}, lai: ${esc(e.lai)} },\n`
js += `}

// 取某卦某爻的典故（无则 null）
export const getDiangu = (key, ti) => DIANGU[key + ':' + ti] || null
`
writeFileSync('data/diangu.js', js, 'utf8')
console.log(`已生成 data/diangu.js：${out.length} 条（丢弃 ${dropped} 条无效条目）`)
