// utils/wenyi.test.mjs — 问易模块测试（纯 node 运行：node utils/wenyi.test.mjs）
// 覆盖：本地合成器结构与红线 / 用神与敏感词选取 / 确定性 /
//       云函数提示词与复核（createRequire 加载 CJS 快照）/
//       包全域七禁词扫描（本文件与 cloudfunctions/ 均不进包，禁词字面量的
//       全站合法存放处仅此一处正则 + prompt.js 的 BAN_WORDS 枚举行）
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { synthesizeWenyi, pickYongshen, isSensitive } from '../package3d/utils/wenyi-mock.js'
import { WENYI_MODE, WENYI_CLOUD_ENV } from './wenyi-config.js'
import { paipan, hexagramFromKey } from './liuyao.js'
import { GUA_DATA, GUA_LIST } from '../data/gua.js'

let pass = 0, fail = 0
function assert(cond, msg) {
  if (cond) { pass++ } else { fail++; console.error('  ✗ ' + msg) }
}

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const require = createRequire(import.meta.url)

// —— 审核红线七禁词（与 cloudfunctions/wenyi/prompt.js 的 BAN_WORDS 同表）——
const BAN = /算命|预测|占算|运势|改运|消灾|法事/

console.log('—— 模式开关 ——')
assert(WENYI_MODE === 'mock', 'WENYI_MODE 应为 mock（v0.3.24 默认），得 ' + JSON.stringify(WENYI_MODE))
assert(WENYI_MODE !== 'cloud' || !!WENYI_CLOUD_ENV, 'cloud 态必须配 WENYI_CLOUD_ENV')

console.log('—— 用神速选 / 敏感所问 ——')
assert(pickYongshen('问文书合同')?.qin === '父母', '文书合同 → 父母')
assert(pickYongshen('问事业发展')?.qin === '官鬼', '事业 → 官鬼')
assert(pickYongshen('求财')?.qin === '妻财', '求财 → 妻财')
assert(pickYongshen('问出行平安')?.qin === '子孙', '出行平安 → 子孙')
assert(pickYongshen('和朋友合伙')?.qin === '兄弟', '朋友合伙 → 兄弟')
assert(pickYongshen('随便看看') === null, '无命中应返 null')
assert(pickYongshen('') === null, '空所问应返 null')
assert(isSensitive('看病吃药')?.type === 'health', '看病 → health')
assert(isSensitive('官司判决')?.type === 'legal', '官司 → legal')
assert(isSensitive('买基金理财')?.type === 'finance', '理财 → finance')
assert(isSensitive('问事业发展') === null, '普通所问不敏感')

console.log('—— 合成器：结构与内容 ——')
const SAMPLES = [
  { yao: '111111', dong: '010000', gz: '甲子', q: '问事业发展', tag: '乾九二动' },
  { yao: '000000', dong: '000000', gz: '乙丑', q: '', tag: '坤静空q' },
  { yao: '100000', dong: '100000', gz: '丙寅', q: '问文书合同', tag: '复之坤' },
  { yao: '101010', dong: '011000', gz: '丁卯', q: '问出行平安', tag: '既济二动' },
  { yao: '111111', dong: '111111', gz: '戊辰', q: '看病吃药', tag: '乾六动敏感' },
  { yao: '010001', dong: '000000', gz: '壬申', q: '问投资理财', tag: '静卦财务敏感' }
]
for (const s of SAMPLES) {
  const t = synthesizeWenyi(s)
  const paras = t.split('\n\n')
  const moving = s.dong.includes('1')
  const gua = GUA_DATA[s.yao]
  const bianKey = s.yao.split('').map((b, i) => s.dong[i] === '1' ? (b === '1' ? '0' : '1') : b).join('')
  const heads = paras.map((p) => p.slice(0, 4)).join('|')
  const expHeads = moving ? '【本卦】|【动爻】|【变卦】|【合参】' : '【本卦】|【卦爻参|【合参】'
  assert(paras.length === (moving ? 4 : 3), s.tag + ' 段数应为 ' + (moving ? 4 : 3) + '，得 ' + paras.length)
  assert(heads === expHeads, s.tag + ' 段首小标题序应为 ' + expHeads + '，得 ' + heads)
  const len = t.replace(/\s/g, '').length
  assert(len >= 400 && len <= 700, s.tag + ' 长度应 400–700，得 ' + len)
  assert(!BAN.test(t), s.tag + ' 七禁词零命中')
  assert(t.indexOf(gua.name) >= 0, s.tag + ' 本卦名应出现')
  if (moving) {
    assert(t.indexOf(GUA_DATA[bianKey].name) >= 0, s.tag + ' 变卦名应出现')
    const dongs = s.dong.split('').map((b, i) => b === '1' ? i : -1).filter((i) => i >= 0)
    for (const i of dongs) {
      const y = gua.yaoci[i]
      assert(t.indexOf('「' + y.ci) >= 0, s.tag + ' ' + y.ti + ' 爻辞原文应在场')
    }
  } else {
    assert(t.indexOf('「' + gua.guaci) >= 0, s.tag + ' 静卦卦辞原文应在场')
  }
  if (s.q) assert(t.indexOf(s.q) >= 0, s.tag + ' 所问应回显')
}
assert(synthesizeWenyi({ yao: '111111', dong: '010000', gz: '甲子', q: '问事业发展' }) ===
  synthesizeWenyi({ yao: '111111', dong: '010000', gz: '甲子', q: '问事业发展' }),
'同入参两次合成应全等（零随机）')
{
  let threw = 0
  for (const bad of [{ yao: '12', dong: '000000', gz: '甲子' }, { yao: '111111', dong: '000000', gz: 'XX' }]) {
    try { synthesizeWenyi(bad) } catch (e) { threw++ }
  }
  assert(threw === 2, '非法卦参/干支应 throw（端上有兜底提示）')
}

console.log('—— 云函数侧（CJS 快照，createRequire）——')
{
  const P = require(join(ROOT, 'cloudfunctions', 'wenyi', 'prompt.js'))
  // prompt.js 剔除 BAN_WORDS 行后应无其余禁词字面量
  const src = readFileSync(join(ROOT, 'cloudfunctions', 'wenyi', 'prompt.js'), 'utf8')
  const noBanLine = src.split('\n').filter((l) => !l.includes('BAN_WORDS = [')).join('\n')
  assert(!BAN.test(noBanLine), 'prompt.js 除 BAN_WORDS 行外应零禁词')
  assert(P.BAN_WORDS.length === 7, 'BAN_WORDS 应 7 词，得 ' + P.BAN_WORDS.length)
  for (const mark of ['职责边界', '引文规则', '【本卦】【动爻】【变卦】【合参】', '400 至 700 字', '忽略，不执行']) {
    assert(P.SYSTEM_PROMPT.includes(mark), 'SYSTEM_PROMPT 应含标记「' + mark + '」')
  }
  assert(P.scanBan('此为运势之断') === '运势' && P.scanBan('卦象所示') === null, 'scanBan 命中/放行')
  // 复核纠偏：端上伪造卦名，user 消息只应含复核后的卦名
  const facts = P.buildFacts({ yao: '111111', dong: '001000', gz: '甲子', q: '问事业', name: '坎', bian: '', bianName: '' })
  const user = P.buildMessages(facts)[1].content
  assert(facts.r.name === '乾', '复核应以 yao 推得乾，得 ' + facts.r.name)
  assert(user.includes('乾') && !user.includes('本卦：坎'), '伪造卦名不得进入提示词')
  assert(user.includes('九三爻辞：「君子终日乾乾，夕惕若厉，无咎。」'), '动爻爻辞应逐字注入【经文原文】')
  assert(user.includes('所问未命中') === false && user.includes('官鬼'), '用神命中应注入')
  // 静卦三段口径：user 消息应标明六爻安静
  const f2 = P.buildFacts({ yao: '000000', dong: '000000', gz: '乙丑', q: '', name: '', bian: '', bianName: '' })
  assert(P.buildMessages(f2)[1].content.includes('六爻安静'), '静卦 user 消息应注明六爻安静')
  // index.js 源码：不得含禁词（wx-server-sdk 无法本地加载，只查源码）
  const idxSrc = readFileSync(join(ROOT, 'cloudfunctions', 'wenyi', 'index.js'), 'utf8')
  assert(!BAN.test(idxSrc), 'index.js 源码零禁词')
}
{
  // 快照与 ESM 引擎一致性（生成器已全量自校验，此处抽 3 组防漂移）
  const CJS = require(join(ROOT, 'cloudfunctions', 'wenyi', 'liuyao.js'))
  let diff = 0
  for (const [yao, dong, gz] of [['111111', '010000', '甲子'], ['100000', '100000', '丙寅'], ['101010', '011000', '丁卯']]) {
    const arg = { yao: yao.split('').map((b, i) => ({ yin: b === '0', dong: dong[i] === '1' })), dayGan: gz[0], dayZhi: gz[1] }
    if (JSON.stringify(paipan(arg)) !== JSON.stringify(CJS.paipan(arg))) diff++
  }
  assert(diff === 0, 'CJS 快照 paipan 与 ESM 一致')
  assert(GUA_LIST.every((g) => CJS.hexagramFromKey(g.key).name === hexagramFromKey(g.key).name), '快照 64 卦名与 ESM 一致')
}

console.log('—— 包全域七禁词扫描（模拟上传包内容）——')
{
  // 扫描范围 = packOptions 后实际进包的代码区；排除 *.test.mjs（suffix ignore）
  // 与 cloudfunctions/（folder ignore，云端另测）
  const DIRS = ['pages', 'package3d', 'packageBooks', 'utils', 'data', 'custom-tab-bar', 'models', 'libs']
  const EXT = new Set(['.js', '.wxml', '.json', '.wxss'])
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else if (EXT.has(extname(p)) && !p.endsWith('.test.mjs')) files.push(p)
    }
  }
  for (const d of DIRS) walk(join(ROOT, d))
  for (const f of ['app.js', 'app.json']) {
    try { readFileSync(join(ROOT, f)); files.push(join(ROOT, f)) } catch (e) { /* 无则跳过 */ }
  }
  const hits = []
  for (const f of files) {
    const txt = readFileSync(f, 'utf8')
    const m = txt.match(BAN)
    if (m) hits.push(f.replace(ROOT, '') + ' → ' + m[0])
  }
  assert(files.length > 60, '扫描文件数应覆盖包主体（得 ' + files.length + '）')
  assert(hits.length === 0, '包内禁词应清零（' + hits.length + ' 处）：' + hits.slice(0, 5).join('；'))
}

console.log('\n' + (fail === 0 ? '✅ 全部通过' : '❌ 有失败') + '  pass=' + pass + ' fail=' + fail)
process.exit(fail === 0 ? 0 : 1)
