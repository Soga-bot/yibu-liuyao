// utils/gua.test.mjs — 知识库完整性测试（P3-11 扩展三，纯 node 运行：node utils/gua.test.mjs）
// 覆盖：GUA_LIST 结构与爻题阴阳推导 / 与排盘引擎交叉一致性 / 经文+彖象白话全量 /
//       典故键引用合法性 / 审核禁词全库扫描
import { GUA_LIST } from '../data/gua.js'
import { BAIHUA, getBaihua } from '../data/baihua.js'
import { ZHUAN, getZhuan } from '../data/zhuan.js'
import { getZhuanBh, ZHUAN_BH_COUNT } from '../data/baihua-zhuan.js'
import { DIANGU } from '../data/diangu.js'
import { hexagramFromKey } from './liuyao.js'

let pass = 0, fail = 0
function assert(cond, msg) {
  if (cond) { pass++ } else { fail++; console.error('  ✗ ' + msg) }
}

// 爻题由爻阴阳严格推导（体例：初九/初六、九二/六二…九五/六五、上九/上六——
// 首尾两爻位次在前，中间四爻阴阳数在前）
const WEI = ['初', '二', '三', '四', '五', '上']
const tiOf = (yang, i) => i === 1 || i === 6 ? WEI[i - 1] + (yang ? '九' : '六') : (yang ? '九' : '六') + WEI[i - 1]

console.log('—— 64 卦知识库完整性 ——')
assert(GUA_LIST.length === 64, '应为 64 卦，得 ' + GUA_LIST.length)
assert(new Set(GUA_LIST.map(g => g.key)).size === 64, 'key 应无重复')
assert(new Set(GUA_LIST.map(g => g.name)).size === 64, '卦名应无重复')
assert(new Set(GUA_LIST.map(g => g.seq)).size === 64 && GUA_LIST.every(g => g.seq >= 1 && g.seq <= 64), 'seq 应为 1..64 不重')
assert(Object.keys(BAIHUA).length === 64, '经文白话库应 64 键，得 ' + Object.keys(BAIHUA).length)
assert(Object.keys(ZHUAN).length === 64, '彖传库应 64 键，得 ' + Object.keys(ZHUAN).length)
assert(ZHUAN_BH_COUNT === 64, '彖象白话应 64 键，得 ' + ZHUAN_BH_COUNT)

const bad = []
for (const g of GUA_LIST) {
  const tag = g.name + '(' + g.key + ')'
  const isQK = g.key === '111111' || g.key === '000000' // 乾/坤独有用九用六
  if (!/^[01]{6}$/.test(g.key)) bad.push(tag + ' key 非法')
  if (!g.neiXiang || !g.waiXiang) bad.push(tag + ' 取象缺')

  // —— 与引擎交叉：名/宫/内外卦由同一 key 独立推导，应一致 ——
  const e = hexagramFromKey(g.key)
  if (e.name !== g.name) bad.push(tag + ' 引擎名=' + e.name)
  if (e.gong !== g.gong) bad.push(tag + ' 引擎宫=' + e.gong + '≠' + g.gong)
  if (e.nei !== g.nei || e.wai !== g.wai) bad.push(tag + ' 内外卦不一致')

  // —— 经文原文三层 + 爻题阴阳对应 ——
  if (!g.guaci) bad.push(tag + ' 卦辞缺')
  if (!g.daxiang) bad.push(tag + ' 大象缺')
  if (!g.desc) bad.push(tag + ' desc 缺')
  if (!Array.isArray(g.yaoci) || g.yaoci.length !== 6) bad.push(tag + ' 爻辞非6条')
  else g.yaoci.forEach((y, i) => {
    const exp = tiOf(g.key[i] === '1', i + 1)
    if (y.ti !== exp) bad.push(tag + ' 第' + (i + 1) + '爻题=' + y.ti + '≠' + exp)
    if (!y.ci) bad.push(tag + ' ' + y.ti + ' 辞缺')
  })
  if (isQK && (!g.yong || !g.yong.ci || g.yong.ti !== (g.key === '111111' ? '用九' : '用六'))) bad.push(tag + ' 用九/用六缺失或题错')
  if (!isQK && g.yong) bad.push(tag + ' 不应有 yong')

  // —— 经文白话层 ——
  const bh = getBaihua(g.key)
  if (!bh) bad.push(tag + ' 卦辞白话缺')
  else {
    if (bh.n !== g.name) bad.push(tag + ' 白话锚点名=' + bh.n)
    if (!bh.guaci) bad.push(tag + ' 卦辞白话空')
    if (!Array.isArray(bh.yaoci) || bh.yaoci.length !== 6 || bh.yaoci.some(s => !s)) bad.push(tag + ' 爻辞白话非6条全')
    if (isQK && !bh.yong) bad.push(tag + ' 用九/用六白话缺')
    if (!isQK && bh.yong) bad.push(tag + ' 白话不应有 yong')
  }

  // —— 彖传/小象原文 + 白话 ——
  const zh = getZhuan(g.key)
  if (!zh) bad.push(tag + ' 彖传缺')
  else {
    if (zh.n !== g.name) bad.push(tag + ' 彖锚点名=' + zh.n)
    if (!zh.tuan) bad.push(tag + ' 彖空')
    if (!Array.isArray(zh.xiao) || zh.xiao.length !== 6 || zh.xiao.some(s => !s)) bad.push(tag + ' 小象非6条全')
    if (isQK && !zh.xyong) bad.push(tag + ' 用九/用六小象缺')
    if (!isQK && zh.xyong) bad.push(tag + ' 彖不应有 xyong')
  }
  const zb = getZhuanBh(g.key)
  if (!zb) bad.push(tag + ' 彖象白话缺')
  else {
    if (zb.n !== g.name) bad.push(tag + ' 彖象白话锚点=' + zb.n)
    if (!zb.tuan || !zb.xiang) bad.push(tag + ' 彖/大象白话空')
    if (!Array.isArray(zb.xiao) || zb.xiao.length !== 6 || zb.xiao.some(s => !s)) bad.push(tag + ' 小象白话非6条全')
  }
}
assert(bad.length === 0, '64 卦全字段核查 ' + bad.length + ' 处: ' + bad.slice(0, 8).join('；') + (bad.length > 8 ? ' …' : ''))

console.log('—— 典故键引用合法性 ——')
{
  const byKey = new Map(GUA_LIST.map(g => [g.key, g]))
  const bad2 = []
  for (const k of Object.keys(DIANGU)) {
    const [key, ti] = k.split(':')
    const g = byKey.get(key)
    if (!g) { bad2.push(k + ' 卦key非法'); continue }
    const validTi = new Set(['卦辞', '彖传', ...g.yaoci.map(y => y.ti)])
    if (!validTi.has(ti)) bad2.push(k + ' 爻题不在该卦条目中')
    const c = DIANGU[k]
    if (!c.ti || !c.gu || !c.lai) bad2.push(k + ' 字段缺失')
    else if (!c.lai.includes('《')) bad2.push(k + ' lai 无出处书名号')
  }
  assert(bad2.length === 0, '典故 ' + Object.keys(DIANGU).length + ' 条核查: ' + bad2.join('；'))
}

console.log('—— 审核禁词全库扫描 ——')
{
  const BAN = /算命|预测|占算|运势|改运/
  const leaves = o => Object.values(o).flatMap(v => typeof v === 'string' ? [v] : (v && typeof v === 'object' ? leaves(v) : []))
  const texts = [
    ...GUA_LIST.flatMap(leaves),
    ...Object.values(BAIHUA).flatMap(leaves),
    ...Object.values(ZHUAN).flatMap(leaves),
    ...GUA_LIST.map(g => getZhuanBh(g.key)).flatMap(leaves),
    ...Object.values(DIANGU).flatMap(leaves)
  ]
  const hit = texts.filter(t => BAN.test(t))
  assert(hit.length === 0, '禁词命中 ' + hit.length + ' 条，首条: ' + (hit[0] || '').slice(0, 30))
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : '❌ 有失败') + '  pass=' + pass + ' fail=' + fail)
process.exit(fail === 0 ? 0 : 1)
