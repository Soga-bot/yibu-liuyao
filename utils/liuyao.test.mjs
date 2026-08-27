import { paipan, dateToGanZhi, listAllHexagrams, TIAN_GAN, DI_ZHI } from './liuyao.js'

let pass = 0, fail = 0
function assert(cond, msg) {
  if (cond) { pass++ } else { fail++; console.error('  ✗ ' + msg) }
}
// bits 串（初→上，1=阳 0=阴）+ 动爻下标数组 → yao 输入
const Y = (bits, dongs = []) => bits.split('').map((b, i) => ({ yin: b === '0', dong: dongs.includes(i) }))

console.log('—— 乾为天 (甲子日) ——')
let r = paipan({ yao: Y('111111'), dayGan: '甲', dayZhi: '子' })
assert(r.name === '乾', '卦名应为 乾，得 ' + r.name)
assert(r.gong === '乾', '卦宫应为 乾，得 ' + r.gong)
assert(r.shi === 6 && r.ying === 3, '世应在 6/3，得 ' + r.shi + '/' + r.ying)
const L = (p) => r.lines.find(l => l.pos === p)
assert(L(6).zhi === '戌' && L(6).liuqin === '父母' && L(6).isShi, '上爻 戌土父母·世')
assert(L(5).zhi === '申' && L(5).liuqin === '兄弟', '五爻 申金兄弟')
assert(L(4).zhi === '午' && L(4).liuqin === '官鬼', '四爻 午火官鬼')
assert(L(3).zhi === '辰' && L(3).liuqin === '父母' && L(3).isYing, '三爻 辰土父母·应')
assert(L(2).zhi === '寅' && L(2).liuqin === '妻财', '二爻 寅木妻财')
assert(L(1).zhi === '子' && L(1).liuqin === '子孙', '初爻 子水子孙')
assert(L(1).liushen === '青龙' && L(6).liushen === '玄武', '六神 甲日 青龙起→玄武收')
assert(r.kongWang.includes('戌') && r.kongWang.includes('亥'), '甲子旬空 戌亥')
assert(L(6).kong, '上爻戌落空亡')

console.log('—— 坎为水 (甲子日) ——')
r = paipan({ yao: Y('010010'), dayGan: '甲', dayZhi: '子' })
assert(r.name === '坎' && r.gong === '坎', '坎/坎宫 得 ' + r.name + '/' + r.gong)
assert(r.shi === 6 && r.ying === 3, '坎世应 6/3')
assert(L(1).zhi === '寅' && L(1).liuqin === '子孙', '坎初 寅木子孙')
assert(L(6).zhi === '子' && L(6).liuqin === '兄弟' && L(6).isShi, '坎上 子水兄弟·世')
assert(L(3).zhi === '午' && L(3).liuqin === '妻财' && L(3).isYing, '坎三 午火妻财·应')

console.log('—— 地天泰 (甲子日) ——')
r = paipan({ yao: Y('111000'), dayGan: '甲', dayZhi: '子' })
assert(r.name === '泰' && r.gong === '坤', '泰/坤宫 得 ' + r.name + '/' + r.gong)
assert(r.shi === 3 && r.ying === 6, '泰 世3应6')
assert(L(3).isShi && L(6).isYing, '泰 三爻世·上爻应')

console.log('—— 六神随日干变化 (丁日) ——')
r = paipan({ yao: Y('111111'), dayGan: '丁', dayZhi: '卯' })
assert(L(1).liushen === '朱雀', '丁日初爻朱雀')

console.log('—— 变卦：乾二爻动 → 天火同人 ——')
r = paipan({ yao: Y('111111', [1]), dayGan: '甲', dayZhi: '子' })
assert(r.bian && r.bian.name === '同人', '变卦应为 同人，得 ' + (r.bian && r.bian.name))

// ===== P3-11 扩展一：dateToGanZhi 多日期（外部锚点 + 历法边界 + 全区间逐日扫描）=====
console.log('—— dateToGanZhi 多日期 ——')
const gz = (y, m, d) => dateToGanZhi(new Date(y, m - 1, d))
// 外部锚点（通行万年历）：1949-10-01 为甲子日、2000-01-01 为戊午日——锚住 60 日循环绝对相位
let a = gz(1949, 10, 1)
assert(a.gan === '甲' && a.zhi === '子' && a.idx === 0, '1949-10-01 应甲子(idx 0)，得 ' + a.gan + a.zhi + a.idx)
a = gz(2000, 1, 1)
assert(a.gan === '戊' && a.zhi === '午' && a.idx === 54, '2000-01-01 应戊午(idx 54)，得 ' + a.gan + a.zhi + a.idx)
// 历法边界：相邻两日 idx 恒回进 1（闰日/世纪平年/跨世纪年界/小月界）
const EDGES = [
  [2024, 2, 28, 2024, 2, 29], [2023, 2, 28, 2023, 3, 1],
  [1900, 2, 28, 1900, 3, 1], [2000, 2, 28, 2000, 2, 29],
  [1999, 12, 31, 2000, 1, 1], [2100, 2, 28, 2100, 3, 1], [1980, 6, 30, 1980, 7, 1]
]
for (const [y1, m1, d1, y2, m2, d2] of EDGES) {
  const step = (gz(y2, m2, d2).idx - gz(y1, m1, d1).idx + 60) % 60
  assert(step === 1, y1 + '-' + m1 + '-' + d1 + '→' + y2 + '-' + m2 + '-' + d2 + ' 应回进1，得 ' + step)
}
// 全区间逐日扫描 1949-01-01→2050-12-31（3.7 万天）：idx 逐日 +1 (mod 60) 且干支与 idx 自洽
{
  const cur = new Date(1949, 0, 1), end = new Date(2050, 11, 31)
  let prev = dateToGanZhi(cur).idx, days = 0, brokeAt = ''
  cur.setDate(cur.getDate() + 1) // 从第二日起与前一日的 idx 比较
  for (; cur <= end; cur.setDate(cur.getDate() + 1)) {
    const x = dateToGanZhi(cur)
    if ((x.idx - prev + 60) % 60 !== 1 || x.gan !== TIAN_GAN[x.idx % 10] || x.zhi !== DI_ZHI[x.idx % 12]) { brokeAt = cur.toLocaleDateString(); break }
    prev = x.idx; days++
  }
  assert(!brokeAt && days > 37000, '1949–2050 逐日连续性在 ' + (brokeAt || '—') + ' 断裂（走了 ' + days + ' 天）')
}

// ===== P3-11 扩展二：八宫表全量 64 卦金标准对照 =====
console.log('—— 八宫表金标准对照（京房：本宫→一至五世→游魂→归魂）——')
// 金标准＝八宫卦序通行定本（独立于引擎的变卦推导算法）。
// 用字约定（docs/校勘备注.md）：程序层卦名/索引作「遁」（后世通行），
// 经传原文作「遯」（阮刻古本），两存；检索层已做 遯→遁 归一化。
const BAGONG_GOLD = {
  乾: ['乾', '姤', '遁', '否', '观', '剥', '晋', '大有'],
  坎: ['坎', '节', '屯', '既济', '革', '丰', '明夷', '师'],
  艮: ['艮', '贲', '大畜', '损', '睽', '履', '中孚', '渐'],
  震: ['震', '豫', '解', '恒', '升', '井', '大过', '随'],
  巽: ['巽', '小畜', '家人', '益', '无妄', '噬嗑', '颐', '蛊'],
  离: ['离', '旅', '鼎', '未济', '蒙', '涣', '讼', '同人'],
  坤: ['坤', '复', '临', '泰', '大壮', '夬', '需', '比'],
  兑: ['兑', '困', '萃', '咸', '蹇', '谦', '小过', '归妹']
}
const SHI_BY_POS = [6, 1, 2, 3, 4, 5, 4, 3] // 本宫/一世..五世/游魂/归魂
{
  const all = listAllHexagrams()
  assert(all.length === 64, '引擎应列 64 卦，得 ' + all.length)
  const byName = new Map(all.map(h => [h.name, h]))
  const flat = Object.values(BAGONG_GOLD).flat()
  assert(new Set(flat).size === 64, '金标准 64 卦名应无重复')
  const bad = []
  for (const [gong, names] of Object.entries(BAGONG_GOLD)) names.forEach((nm, pos) => {
    const h = byName.get(nm)
    if (!h) return bad.push(nm + ' 引擎查无')
    const shi = SHI_BY_POS[pos]
    if (h.gong !== gong) bad.push(nm + ' 宫=' + h.gong + '≠' + gong)
    if (h.shi !== shi) bad.push(nm + ' 世=' + h.shi + '≠' + shi)
    if (h.ying !== ((shi + 2) % 6) + 1) bad.push(nm + ' 应=' + h.ying)
  })
  assert(bad.length === 0, '八宫金标准 64 卦对照: ' + (bad.join('；') || '不一致'))
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : '❌ 有失败') + '  pass=' + pass + ' fail=' + fail)
process.exit(fail === 0 ? 0 : 1)
