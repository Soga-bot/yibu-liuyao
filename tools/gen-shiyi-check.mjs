// tools/gen-shiyi-check.mjs — 校验 data/shiyi.js 覆盖度，并生成 docs/待校对-序卦杂卦文言.txt
// 用法：node tools/gen-shiyi-check.mjs
import { writeFileSync } from 'node:fs'
import { GUA_LIST } from '../data/gua.js'
import { XUGUA, ZAGUA, WENYAN } from '../data/shiyi.js'

// 1) 覆盖度校验
let bad = 0
for (const g of GUA_LIST) {
  if (!XUGUA[g.key]) { console.error(`✗ 序卦缺：${g.name}`); bad++ }
  if (!ZAGUA[g.key]) { console.error(`✗ 杂卦缺：${g.name}`); bad++ }
}
if (Object.keys(XUGUA).length !== 64 || Object.keys(ZAGUA).length !== 64) { console.error('✗ 条数不为 64'); bad++ }
if (!WENYAN.qian?.length || !WENYAN.kun?.length) { console.error('✗ 文言传乾坤缺失'); bad++ }
if (bad) { console.error(`共 ${bad} 处问题，未生成校对文件`); process.exit(1) }

// 2) 生成校对面板（按文王序逐卦列 出，方便对照任意版本）
let t = `待校对：data/shiyi.js（序卦传 64 段 + 杂卦传 64 句 + 文言传乾坤）
====================================================================

【背景】序卦、杂卦、文言由我按通行本录入，卦名锚点 + 文王序对齐已
程序校验（64/64 无错位），但文字凭记忆录入，需对照权威本核字。

【对着什么校】阮元校刻《十三经注疏·周易正义》（ctext.org）/
上海古籍《周易译注》（黄寿祺）/ 中华书局点校本，任一。

【怎么记错】直接在本文件末尾「纠错记录」按格式记，我来改 shiyi.js：
  篇目｜卦名｜现文｜应为
例：序卦｜屯｜屯者盈也｜屯者，盈也

【体例说明】
- 序卦每卦只录该卦被引出的一句（「故受之以某」及释语），乾坤、咸为
  篇首特例段；坤条括注为说明文字，非原文，校对时忽略。
- 杂卦为对偶句，成对卦（如乾刚坤柔、比乐师忧）两卦共用整句。
- 文言传整篇录于乾、坤两卦名下，按段落校对。

====================================================================
【一】序卦传（逐卦）
`
for (const g of GUA_LIST) t += `\n【${g.name}】\n序：${XUGUA[g.key]}\n`
t += `\n====================================================================
【二】杂卦传（逐卦，成对卦共用整句）
`
for (const g of GUA_LIST) t += `\n【${g.name}】\n杂：${ZAGUA[g.key]}\n`
t += `\n====================================================================
【三】文言传（乾 ${WENYAN.qian.length} 段 / 坤 ${WENYAN.kun.length} 段）
`
t += `\n【乾·文言】\n` + WENYAN.qian.map((p, i) => `第${i + 1}段：${p}`).join('\n') + '\n'
t += `\n【坤·文言】\n` + WENYAN.kun.map((p, i) => `第${i + 1}段：${p}`).join('\n') + '\n'
t += `
====================================================================
纠错记录（格式：篇目｜卦名｜现文｜应为）
（无）
`
writeFileSync('docs/待校对-序卦杂卦文言.txt', t, 'utf8')
console.log('校验通过：序卦 64/64、杂卦 64/64、文言乾坤齐')
console.log('已生成：docs/待校对-序卦杂卦文言.txt')
