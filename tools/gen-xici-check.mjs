// tools/gen-xici-check.mjs — 校验系辞/说卦章数，生成 docs/待校对-系辞说卦.txt
// ⚠️ 该校对文件 2026-08-25 已全闭环并含用户报告+裁决归档，运行本工具会整文件
// 重生成、抹掉归档记录——除非数据大改需重开校对，否则勿再执行。
// 注意：只生成「系辞说卦」文件；待校对-序卦杂卦文言.txt 由 gen-shiyi-check.mjs
// 生成，用户正在编辑，勿在本工具里触碰。
// 用法：node tools/gen-xici-check.mjs
import { writeFileSync } from 'node:fs'
import { XICI_SHANG, XICI_XIA, SHUOGUA } from '../data/shiyi.js'

// 1) 结构校验：章号为汉字序数「一..十二」连续、每章有正文
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三']
let bad = 0
const check = (arr, name, expect) => {
  if (arr.length !== expect) { console.error(`✗ ${name} 章数 ${arr.length} ≠ ${expect}`); bad++ }
  arr.forEach((c, i) => {
    if (c.h !== CN[i]) { console.error(`✗ ${name} 第${CN[i]}章章号异常：${c.h}`); bad++ }
    if (!c.t || c.t.length < 20) { console.error(`✗ ${name} 第${c.h}章正文缺失或过短`); bad++ }
  })
}
check(XICI_SHANG, '系辞上传', 12)
check(XICI_XIA, '系辞下传', 13)
check(SHUOGUA, '说卦传', 11)
if (bad) { console.error(`共 ${bad} 处问题，未生成校对文件`); process.exit(1) }

// 2) 生成校对面板
const secs = [
  ['一', '系辞上传', XICI_SHANG],
  ['二', '系辞下传', XICI_XIA],
  ['三', '说卦传', SHUOGUA]
]
let t = `待校对：data/shiyi.js（系辞上传 12 章 + 系辞下传 13 章 + 说卦传 11 章）
====================================================================

【背景】系辞、说卦由我按通行本录入，章号连续、无空章已程序校验，
但文字凭记忆录入，需对照权威本核字。这是十翼最后一批原文。

【对着什么校】阮元校刻《十三经注疏·周易正义》（ctext.org）/
上海古籍《周易译注》（黄寿祺）/ 中华书局点校本，任一。

【怎么记错】直接在本文件末尾「纠错记录」按格式记，我来改 shiyi.js：
  篇目｜章｜现文｜应为
例：系辞上｜3｜圣人小以成小｜圣人成能（示意）

【体例说明】
- 分章依通行本，各家分章略有出入（有作 13/12 章者），不影响文字
  校对；若某本合章导致段落边界不同，按文字对照即可。
- 说卦第 11 章为八纯卦「广象」全章（乾为天为圜…兑为羊），篇幅最长。
- 生僻字在 App 内随文括注拼音，校对时只核原文用字，不用管拼音。

====================================================================
`
for (const [idx, name, arr] of secs) {
  t += `\n【${idx}】${name}（${arr.length} 章）\n`
  for (const c of arr) t += `\n第${c.h}章：${c.t}\n`
}
t += `
====================================================================
纠错记录（格式：篇目｜章｜现文｜应为）
（无）
`
writeFileSync('docs/待校对-系辞说卦.txt', t, 'utf8')
console.log('校验通过：系辞上 12 / 系辞下 11 / 说卦 11，章号连续')
console.log('已生成：docs/待校对-系辞说卦.txt')
