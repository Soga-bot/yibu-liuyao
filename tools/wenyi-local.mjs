// tools/wenyi-local.mjs — 问易云函数本地联调（直连豆包 · 不经微信云开发）
//
// 复用云函数真身：prompt.js（复核/组装/红线）与 llm.js（请求形态）均为
// cloudfunctions/wenyi 原文件，本地跑的就是上线同一套逻辑，只省去
// wx-server-sdk 与 msgSecCheck（云端专属）。纠偏重试与 index.js 第 5 步同构。
//
// 用法：
//   node tools/wenyi-local.mjs --dry        只组装提示词并离线检查（不需要 key）
//   node tools/wenyi-local.mjs              固定 6 例（覆盖四段/静卦/用神/敏感/多动）
//   node tools/wenyi-local.mjs --fuzz 8     追加 8 例随机卦参（种子固定可复现）
//   node tools/wenyi-local.mjs --only 乾    只跑名字含「乾」的用例
//   node tools/wenyi-local.mjs --thinking   不关思考（对照组；默认关，见 llm.js 头注）
//
// 配置：local/wenyi.local.json（git 忽略、不进包），环境变量 WENYI_* 可覆盖。
// 输出：逐例全文与检查结果写 local/本地测试输出.md，控制台打摘要；有失败 exit 1。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(join(ROOT, 'package.json'))
const prompt = req('./cloudfunctions/wenyi/prompt.js')
const llm = req('./cloudfunctions/wenyi/llm.js')
const { GUA_DATA } = req('./cloudfunctions/wenyi/data.js')

// —— 参数 ——
const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const THINK = argv.includes('--thinking')
const only = (argv.indexOf('--only') >= 0 && argv[argv.indexOf('--only') + 1]) || ''
const fuzzN = (() => {
  const i = argv.indexOf('--fuzz')
  if (i < 0) return 0
  return Math.max(0, Math.min(20, Number(argv[i + 1]) || 0))
})()

// —— 配置（local 文件 ← 环境变量覆盖）——
function loadCfg() {
  let c = {}
  try { c = JSON.parse(readFileSync(join(ROOT, 'local/wenyi.local.json'), 'utf8')) } catch (e) {}
  return {
    baseUrl: process.env.WENYI_BASE_URL || c.baseUrl || '',
    apiKey: process.env.WENYI_API_KEY || c.apiKey || '',
    model: process.env.WENYI_MODEL || c.model || '',
    timeoutMs: Number(process.env.WENYI_TIMEOUT_MS) || c.timeoutMs || 45000,
    thinkingOff: !THINK && c.thinkingOff !== false
  }
}

// —— 固定样本（覆盖：四段/静卦空问/用神命中/词表未中/敏感导流/五动极简）——
const CASES = [
  { name: '乾之姤·问事业', yao: '111111', dong: '100000', gz: '甲子', q: '事业发展方向' },
  { name: '坤静·空问', yao: '000000', dong: '000000', gz: '乙丑', q: '' },
  { name: '复之颐·问文书', yao: '100000', dong: '000001', gz: '丙寅', q: '合同文书办理' },
  { name: '既济之夬·问感情', yao: '101010', dong: '010100', gz: '丁卯', q: '两人感情走向' },
  { name: '临之复·问就医', yao: '110000', dong: '010000', gz: '戊辰', q: '近期身体不适要不要去医院' },
  { name: '乾五动·问合伙', yao: '111111', dong: '111101', gz: '庚午', q: '与朋友合伙做生意' }
]

const FUZZ_Q = ['考试升学', '换工作', '买房安家', '求财', '孩子学业', '出行平安', '打官司结果', '股票投资', '面试结果', '相亲见面', '宠物健康', '竞争上岗']

// 固定种子 PRNG（可复现；仅测试用，与合成器「零随机」约束无关）
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const GAN = '甲乙丙丁戊己庚辛壬癸'
const ZHI = '子丑寅卯辰巳午未申酉戌亥'

function buildFuzz(n) {
  const rnd = mulberry32(20260827)
  const out = []
  for (let i = 0; i < n; i++) {
    const yI = Math.floor(rnd() * 64)
    const dI = Math.floor(rnd() * 64)
    const g = Math.floor(rnd() * 60)
    out.push({
      name: '随机' + (i + 1),
      yao: yI.toString(2).padStart(6, '0'),
      dong: dI.toString(2).padStart(6, '0'),
      gz: GAN[g % 10] + ZHI[g % 12],
      q: FUZZ_Q[Math.floor(rnd() * FUZZ_Q.length)]
    })
  }
  return out
}

// 敏感所问速判（与 utils/wenyi-mock.js isSensitive 同口径的简化版，仅测试用）
function isSensitiveQ(q) {
  return /[病医药孕产]|官司|诉讼|判决|投资|股票|基金|理财/.test(q || '')
}

// —— 输出检查（对齐 docs/问易解读规格.md）——
function checkOut(c, text) {
  const issues = []
  const plain = (text || '').replace(/\s+/g, '')
  const len = plain.length
  if (!text) return { issues: ['空正文（finish_reason 见日志，可能被 max_tokens 截断）'], len }
  if (len < 400 || len > 700) issues.push('长度 ' + len + ' 出带（400–700）')
  const dongCount = c.dong.split('').filter((b) => b === '1').length
  const want = dongCount ? ['【本卦】', '【动爻】', '【变卦】', '【合参】'] : ['【本卦】', '【卦爻参读】', '【合参】']
  const pos = want.map((t) => text.indexOf(t))
  if (pos.some((i) => i < 0)) {
    issues.push('缺段：' + want.filter((t) => text.indexOf(t) < 0).join(''))
  } else {
    const seq = want.map((t, i) => ({ t, i: pos[i] })).sort((a, b) => a.i - b.i)
    if (seq.some((s, i) => s.t !== want[i])) issues.push('段序错乱：' + seq.map((s) => s.t).join('→'))
  }
  const gua = GUA_DATA[c.yao] || {}
  c.dong.split('').forEach((b, i) => {
    if (b !== '1') return
    const ci = (((gua.yaoci || [])[i]) || {}).ci || ''
    // 库内爻辞自带句号，模型常把句号置于引号外——比对前去尾标点
    const ciN = ci.replace(/\s+/g, '').replace(/[。，；、！？]$/, '')
    if (ciN && plain.indexOf(ciN) < 0) issues.push('第' + (i + 1) + '爻爻辞未逐字出现')
  })
  const ban = prompt.scanBan(text)
  if (ban) issues.push('禁词：' + ban)
  // 导流句措辞容变体（如「线下专业医疗机构意见为准」）
  if (isSensitiveQ(c.q) && !/线下.{0,12}为准/.test(plain)) issues.push('敏感所问缺线下导流句')
  if (/不构成|决策依据|仅供.{0,8}参考/.test(text)) issues.push('出现免责式表述（应由端上页面声明）')
  if (/\*\*|^#{1,6}\s|^\s*[-*]\s/m.test(text)) issues.push('含 Markdown 标记')
  return { issues, len }
}

// 开通态在方舟侧偶发传播不一致（同 key 交替 ModelNotOpen/成功），仅本地联调层重试抹平
async function chatRetry(cfg, messages, opts) {
  for (let a = 1; ; a++) {
    try {
      return await llm.chat(cfg, messages, opts)
    } catch (e) {
      if (a < 3 && /ModelNotOpen|HTTP 429/.test(String(e && e.message))) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
}

// —— 跑单例（含与 index.js 第 5 步同构的纠偏重试）——
async function runCase(cfg, c) {
  const t0 = Date.now()
  const facts = prompt.buildFacts({ yao: c.yao, dong: c.dong, gz: c.gz, q: c.q })
  const messages = prompt.buildMessages(facts)
  const opts = { temperature: 0.7, maxTokens: 1200, thinkingOff: cfg.thinkingOff }

  let res = await chatRetry(cfg, messages, opts)
  let text = llm.pickText(res)
  let retried = null
  const hit = prompt.scanBan(text)
  if (hit) {
    retried = hit
    res = await chatRetry(cfg, messages.concat([
      { role: 'assistant', content: text },
      { role: 'user', content: '上文出现了「' + hit + '」一词，违反系统提示职责边界第 3 条。请重写全文：严格避开此类词与同义改写，保持既定段落结构。' }
    ]), opts)
    text = llm.pickText(res)
  }
  const ms = Date.now() - t0
  const u = (res && res.usage) || {}
  return {
    c, facts, ms, text, retried,
    finish: (res && res.choices && res.choices[0] && res.choices[0].finish_reason) || '?',
    tokens: { in: u.prompt_tokens || 0, out: u.completion_tokens || 0, total: u.total_tokens || 0 },
    check: checkOut(c, text)
  }
}

// —— main ——
let cases = CASES.concat(buildFuzz(fuzzN))
if (only) cases = cases.filter((c) => c.name.indexOf(only) >= 0)
if (!cases.length) { console.error('没有匹配的用例'); process.exit(1) }

if (DRY) {
  let fail = 0
  for (const c of cases) {
    const facts = prompt.buildFacts({ yao: c.yao, dong: c.dong, gz: c.gz, q: c.q })
    const messages = prompt.buildMessages(facts)
    const user = messages[1].content
    const okRole = messages.length === 2 && messages[0].role === 'system' && messages[1].role === 'user'
    const okJing = user.indexOf('【经文原文】') >= 0 && user.indexOf('卦辞：「') >= 0
    const guaMing = facts.r.name + (facts.r.bian ? ' 之 ' + facts.r.bian.name : '（静）')
    const yong = facts.yong ? facts.yong.qin + '（' + facts.yong.hit + '）' : '未命中'
    console.log('[' + c.name + '] ' + guaMing + ' | 用神:' + yong + ' | user ' + user.length + ' 字 | ' +
      (okRole && okJing ? 'OK' : '结构异常'))
    console.log('  ' + user.split('\n').slice(0, 4).join(' / ').slice(0, 160))
    if (!okRole || !okJing) fail++
  }
  console.log(fail ? '❌ dry 检查未过 ' + fail + ' 例' : '✅ dry 全部 ' + cases.length + ' 例组装正常')
  process.exit(fail ? 1 : 0)
}

const cfg = loadCfg()
if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
  console.error('缺配置：请在 local/wenyi.local.json 填 apiKey（baseUrl/model 已预填豆包），')
  console.error('或设环境变量 WENYI_BASE_URL / WENYI_API_KEY / WENYI_MODEL。')
  process.exit(1)
}
console.log('模型 ' + cfg.model + ' | thinkingOff=' + cfg.thinkingOff + ' | timeout=' + cfg.timeoutMs + 'ms | 用例 ' + cases.length + ' 个\n')

const results = []
for (const c of cases) {
  process.stdout.write('[' + c.name + '] 请求中…')
  try {
    const r = await runCase(cfg, c)
    results.push(r)
    const st = r.check.issues.length ? '❌ ' + r.check.issues.join('；') : '✅'
    console.log(' ' + st + ' | ' + r.check.len + '字 ' + (r.ms / 1000).toFixed(1) + 's tokens ' + r.tokens.total +
      (r.retried ? ' | 纠偏重试过（' + r.retried + '）' : '') + ' | finish=' + r.finish)
  } catch (e) {
    results.push({ c, error: String((e && e.message) || e) })
    console.log(' ❌ 调用失败：' + String((e && e.message) || e).slice(0, 300))
  }
}

// —— 汇总 + 落盘 ——
const okN = results.filter((r) => !r.error && !r.check.issues.length).length
const errN = results.filter((r) => r.error).length
const tok = results.reduce((s, r) => s + (r.tokens ? r.tokens.total : 0), 0)
const msAll = results.reduce((s, r) => s + (r.ms || 0), 0)
console.log('\n通过 ' + okN + '/' + results.length + '（失败 ' + (results.length - okN - errN) + '，调用错误 ' + errN + '）' +
  ' | 合计 tokens ' + tok + '，耗时 ' + (msAll / 1000).toFixed(1) + 's')

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
const md = [
  '# 问易云函数本地直连测试 · ' + cfg.model + ' · ' + stamp,
  '',
  '> thinkingOff=' + cfg.thinkingOff + ' / timeout=' + cfg.timeoutMs + 'ms / ' +
  '固定 ' + CASES.length + ' 例' + (fuzzN ? ' + fuzz ' + fuzzN + ' 例' : '') +
  ' | 通过 ' + okN + '/' + results.length + ' | tokens ' + tok,
  '',
  ...results.flatMap((r, i) => {
    const head = '## ' + (i + 1) + '. ' + r.c.name + '（' + r.c.yao + ' / ' + r.c.dong + ' / ' + r.c.gz + ' / q=' + (r.c.q || '空') + '）'
    if (r.error) return [head, '', '- ❌ 调用失败：' + r.error, '', '---', '']
    const st = r.check.issues.length ? '- ❌ ' + r.check.issues.join('；') : '- ✅ 检查全过'
    const meta = '- 复核：' + r.facts.r.name + (r.facts.r.bian ? ' 之 ' + r.facts.r.bian.name : '（静）') +
      ' | ' + r.check.len + '字 ' + (r.ms / 1000).toFixed(1) + 's | tokens ' + r.tokens.total +
      '（in ' + r.tokens.in + ' / out ' + r.tokens.out + '）| finish=' + r.finish +
      (r.retried ? ' | 纠偏重试过（' + r.retried + '）' : '')
    return [head, '', st, meta, '', '```text', r.text || '（空正文）', '```', '', '---', '']
  })
].join('\n')
mkdirSync(join(ROOT, 'local'), { recursive: true })
writeFileSync(join(ROOT, 'local/本地测试输出.md'), md, 'utf8')
console.log('全文已写入 local/本地测试输出.md')
process.exit(okN === results.length ? 0 : 1)
