// cloudfunctions/wenyi/index.js — 问易云函数入口（CommonJS）
//
// 流程：参数校验 → 服务端按 yao/dong/gz 复核排盘（不信端上富数据，防注入）
//   → 组装提示词（prompt.js，经文逐字注入【经文原文】块）
//   → 输入内容安全检查（fail-open：不可用仅记 log）
//   → 调 OpenAI 兼容 /chat/completions（环境变量配供应商，key 不进代码）
//   → 输出红线扫描（命中七禁词则纠偏重试一次）
//   → 输出内容安全检查（明确风险 fail-closed；接口不可用放行并记 log）
// 成功返回 { text }；失败返回 { errCode, errMsg }（端上一律降级本地合成）。
const cloud = require('wx-server-sdk')
const https = require('https')
const prompt = require('./prompt.js')
const { ganZhiToIdx } = require('./liuyao.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function bad(errCode, errMsg) { return { errCode, errMsg } }

function validGz(gz) {
  return typeof gz === 'string' && gz.length === 2 && ganZhiToIdx(gz[0], gz[1]) >= 0
}

// OpenAI 兼容 POST（Node 内置 https，零第三方依赖）
function postJson(baseUrl, apiKey, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u
    try { u = new URL(baseUrl) } catch (e) { reject(new Error('WENYI_BASE_URL 无法解析')); return }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') { reject(new Error('WENYI_BASE_URL 协议不支持')); return }
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: timeoutMs
    }, (res) => {
      let buf = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { buf += c })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode + ' ' + buf.slice(0, 200)))
          return
        }
        try { resolve(JSON.parse(buf)) } catch (e) { reject(new Error('响应非 JSON：' + buf.slice(0, 200))) }
      })
    })
    req.on('timeout', () => { req.destroy(new Error('请求超时')) })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function pickText(d) {
  const msg = d && d.choices && d.choices[0] && d.choices[0].message
  if (msg && typeof msg.content === 'string' && msg.content.trim()) return msg.content.trim()
  return ''
}

// 内容安全：true=通过 / false=明确风险 / null=接口不可用（处置由调用侧定）
async function secCheck(content, wxContext, tag) {
  if (!content) return true
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      openid: (wxContext && wxContext.OPENID) || '',
      scene: 2,
      version: 2,
      content: String(content).slice(0, 2500)
    })
    if (res && res.errCode === 0) {
      const sug = res.result && res.result.suggest
      return sug ? sug !== 'risky' : true
    }
    return true
  } catch (e) {
    console.error('[wenyi] msgSecCheck ' + tag + ' 不可用：', (e && e.errMsg) || e)
    return null
  }
}

exports.main = async (event) => {
  const p = event || {}
  // 1) 参数校验（q 截 30 字，服务端同样截断）
  if (!/^[01]{6}$/.test(p.yao || '')) return bad('BAD_REQ', 'yao 格式有误')
  if (!/^[01]{6}$/.test(p.dong || '')) return bad('BAD_REQ', 'dong 格式有误')
  if (!validGz(p.gz)) return bad('BAD_REQ', 'gz 格式有误')
  if (p.q != null && typeof p.q !== 'string') return bad('BAD_REQ', 'q 类型有误')

  // 2) 服务端复核排盘 + 组装消息（端上 name 不符仅记 log，以复核为准）
  let messages, qq
  try {
    const facts = prompt.buildFacts(p)
    qq = facts.qq
    messages = prompt.buildMessages(facts)
  } catch (e) {
    console.error('[wenyi] 排盘复核失败', e)
    return bad('BAD_REQ', '排盘复核失败')
  }

  // 3) 输入内容安全（fail-open：不可用仅记 log 放行）
  const wxContext = cloud.getWXContext()
  if (await secCheck(qq, wxContext, 'input') === false) {
    return bad('SEC_CHECK', '所问内容未通过安全检查')
  }

  // 4) 调模型（供应商三要素全在环境变量）
  const BASE = process.env.WENYI_BASE_URL
  const KEY = process.env.WENYI_API_KEY
  const MODEL = process.env.WENYI_MODEL
  const TIMEOUT = Number(process.env.WENYI_TIMEOUT_MS) || 45000
  if (!BASE || !KEY || !MODEL) {
    return bad('CONF', '环境变量未配置：WENYI_BASE_URL / WENYI_API_KEY / WENYI_MODEL')
  }
  const call = (msgs) => postJson(BASE, KEY, {
    model: MODEL, messages: msgs, temperature: 0.7, max_tokens: 1200, stream: false
  }, TIMEOUT).then(pickText)

  let text = ''
  try {
    text = await call(messages)
  } catch (e) {
    console.error('[wenyi] 模型调用失败', e)
    return bad('MODEL_ERR', String((e && e.message) || e))
  }
  if (!text) return bad('NO_TEXT', '模型未返回正文')

  // 5) 输出红线：命中禁词则追加纠偏消息重试一次，仍中则拒绝下发
  const hit1 = prompt.scanBan(text)
  if (hit1) {
    console.log('[wenyi] 输出红线命中，纠偏重试：', hit1)
    try {
      text = await call(messages.concat([
        { role: 'assistant', content: text },
        { role: 'user', content: '上文出现了「' + hit1 + '」一词，违反系统提示职责边界第 3 条。请重写全文：严格避开此类词与同义改写，保持既定段落结构。' }
      ]))
    } catch (e) {
      console.error('[wenyi] 纠偏重试失败', e)
      return bad('RED_LINE', '输出含违禁词且重试失败')
    }
    const hit2 = prompt.scanBan(text)
    if (!text || hit2) return bad('RED_LINE', '输出仍含违禁词' + (hit2 ? '：' + hit2 : ''))
  }

  // 6) 输出内容安全（明确风险 fail-closed；接口不可用放行并记 log）
  if (await secCheck(text, wxContext, 'output') === false) {
    return bad('SEC_CHECK', '输出未通过安全检查')
  }
  return { text }
}
