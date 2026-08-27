// tools/gen-wenyi-cloud.mjs — 生成云函数侧的 CJS 快照（data.js / liuyao.js）
//
// 云函数（cloudfunctions/wenyi）是 CommonJS 环境，且与小程序包隔离
// （packOptions ignore cloudfunctions/，提示词与禁词字面量只在云端）。
// 本工具把 utils/liuyao.js 与 data/gua.js 机械转换为 CJS 快照并自校验：
//   · 全部 64 卦 GUA_DATA 与 ESM 源逐卦 deep-equal；
//   · 排盘 paipan/hexagramFromKey 与 ESM 源多组样例输出一致。
// 任一校验失败 exit 1，云端快照不可用旧版。
// 重新生成：node tools/gen-wenyi-cloud.mjs（改 liuyao.js / gua.js 后重跑）。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'cloudfunctions', 'wenyi')
const HEAD = (src, note) =>
  '// ' + path.basename(OUT_DIR) + '/' + path.basename(String(src)) +
  ' — 由 tools/gen-wenyi-cloud.mjs 自动生成，勿手改\n' +
  '// 源文件：' + note + '（改动请改源文件后重跑生成器）\n'

// —— 通用 ESM → CJS（机械替换导出语句，不动任何逻辑；动态收集导出名）——
function toCjs(src) {
  const names = []
  let out = src
    .replace(/^export const (\w+)/gm, (m, n) => { names.push(n); return 'const ' + n })
    .replace(/^export function (\w+)/gm, (m, n) => { names.push(n); return 'function ' + n })
    .replace(/^export default \{[^\n]*\}\n/m, '')
  // 安全网：正文若还有未处理的 export 形式，宁可失败也不产出坏快照
  const bodyOnly = out.replace(/^(\/\/|#).*$/gm, '')
  if (/\bexport\b/.test(bodyOnly)) {
    throw new Error('gen-wenyi-cloud: 源文件含未处理的 export 形式，转换中止')
  }
  return out + '\nmodule.exports = { ' + names.join(', ') + ' }\n'
}

// —— 生成 + 自校验 ——
mkdirSync(OUT_DIR, { recursive: true })

const liuyaoSrc = readFileSync(path.join(ROOT, 'utils', 'liuyao.js'), 'utf8')
const guaSrc = readFileSync(path.join(ROOT, 'data', 'gua.js'), 'utf8')
const outL = path.join(OUT_DIR, 'liuyao.js')
const outD = path.join(OUT_DIR, 'data.js')
writeFileSync(outL, HEAD(outL, 'utils/liuyao.js') + toCjs(liuyaoSrc))
writeFileSync(outD, HEAD(outD, 'data/gua.js') + toCjs(guaSrc))

// 自校验：CJS 快照 vs ESM 源
const require = createRequire(import.meta.url)
const CJS = require(outL)
const CJS_DATA = require(outD).GUA_DATA
const fileUrl = (p) => new URL('file:///' + p.replace(/\\/g, '/')).href
const [liu, guaMod] = await Promise.all([
  import(fileUrl(path.join(ROOT, 'utils', 'liuyao.js'))),
  import(fileUrl(path.join(ROOT, 'data', 'gua.js')))
])
const { paipan, hexagramFromKey } = liu
const { GUA_DATA } = guaMod

let fail = 0
const ok = (cond, msg) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg)
  if (!cond) fail++
}

console.log('—— 快照自校验 ——')
{
  const keys = Object.keys(GUA_DATA)
  ok(keys.length === 64, '源库 64 卦，得 ' + keys.length)
  const diff = keys.filter((k) => JSON.stringify(GUA_DATA[k]) !== JSON.stringify(CJS_DATA[k]))
  ok(diff.length === 0, 'GUA_DATA 逐卦一致' + (diff.length ? '，异卦: ' + diff.join(',') : '（64/64）'))
}
{
  const SAMPLES = [
    ['111111', '010000', '甲子'], ['000000', '000000', '乙丑'], ['100000', '100000', '丙寅'],
    ['101010', '011000', '丁卯'], ['010001', '000000', '壬申'], ['111111', '111111', '戊辰'],
    ['011010', '000100', '庚午'], ['100110', '001010', '癸亥']
  ]
  let bad = []
  for (const [yao, dong, gz] of SAMPLES) {
    const arg = { yao: yao.split('').map((b, i) => ({ yin: b === '0', dong: dong[i] === '1' })), dayGan: gz[0], dayZhi: gz[1] }
    if (JSON.stringify(paipan(arg)) !== JSON.stringify(CJS.paipan(arg))) bad.push('paipan ' + yao + '/' + dong)
    if (JSON.stringify(hexagramFromKey(yao)) !== JSON.stringify(CJS.hexagramFromKey(yao))) bad.push('hex ' + yao)
  }
  ok(bad.length === 0, 'paipan/hexagramFromKey ' + SAMPLES.length * 2 + ' 组一致' + (bad.length ? '，异: ' + bad.join('；') : ''))
}
{
  const names = Object.keys(GUA_DATA).map((k) => CJS.hexagramFromKey(k).name)
  ok(new Set(names).size === 64, 'CJS 快照卦名 64 卦全覆盖（得 ' + new Set(names).size + '）')
}

console.log(fail === 0 ? '✅ 云函数快照生成并通过自校验：' + outL + ' / ' + outD
  : '❌ 自校验失败，云端快照不可用')
process.exit(fail === 0 ? 0 : 1)
