// cloudfunctions/wenyi/llm.js — OpenAI 兼容模型调用（CommonJS）
//
// 从 index.js 抽出，供云函数与本地联调（tools/wenyi-local.mjs）共用同一请求形态：
//   postJson  原始 POST（Node 内置 https，零第三方依赖）
//   pickText  取 choices[0].message.content
//   chat      统一请求体组装（model/messages/temperature/max_tokens/stream）
// thinkingOff：注入 thinking:{type:'disabled'} 关闭深度思考（seed 系默认）。
// 实测开思考单次 >60s 必超云函数超时，且思考耗 token 可能吃满 max_tokens 致
// 正文截断——云函数默认关（WENYI_THINKING_OFF=0 显式放开）。
const https = require('https')

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

// cfg: { baseUrl, apiKey, model, timeoutMs }
// opts: { temperature=0.7, maxTokens=1200, thinkingOff }
function chat(cfg, messages, opts) {
  opts = opts || {}
  const body = {
    model: cfg.model,
    messages,
    temperature: opts.temperature != null ? opts.temperature : 0.7,
    max_tokens: opts.maxTokens != null ? opts.maxTokens : 1200,
    stream: false
  }
  if (opts.thinkingOff) body.thinking = { type: 'disabled' }
  return postJson(cfg.baseUrl, cfg.apiKey, body, cfg.timeoutMs || 45000)
}

module.exports = { postJson, pickText, chat }
