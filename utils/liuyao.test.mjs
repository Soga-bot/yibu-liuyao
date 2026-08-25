import { paipan } from './liuyao.js'

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

console.log('\n' + (fail === 0 ? '✅ 全部通过' : '❌ 有失败') + '  pass=' + pass + ' fail=' + fail)
process.exit(fail === 0 ? 0 : 1)
