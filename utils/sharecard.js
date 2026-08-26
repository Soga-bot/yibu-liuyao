// utils/sharecard.js — 卦象分享卡绘制（宣纸风 5:4，600×480）
// 卡面固定浅色：分享卡对外代表品牌脸面，不随系统深色模式翻转（红/墨/金在宣纸底上才是本味）。
// 用法：页面 wxml 放隐藏画布 <canvas type="2d" id="shareCard" class="share-canvas">，
// 数据就绪后 makeShareCard(this, { name, full, xiang, dong, line })，
// 成功后 page._shareImg 为临时图路径，onShareAppMessage 里作 imageUrl 用（未生成则省略走默认截图）。
// 注意：只放无 webgl 的页面（result / dianji detail）；divination 页同层渲染教训见其页内注释。

const W = 600
const H = 480

// 一句话折行：超宽硬折，超过 maxLines 截断加省略号
function wrapText(ctx, text, maxW, maxLines) {
  const lines = []
  let line = ''
  for (const ch of String(text || '')) {
    if (ch === '\n') { lines.push(line); line = ''; continue }
    if (ctx.measureText(line + ch).width > maxW && line) {
      lines.push(line)
      line = ch
      if (lines.length === maxLines) break
    } else {
      line += ch
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && line && lines[maxLines - 1] !== line) {
    // 折行时中途截断：末行补省略号
    let last = lines[maxLines - 1]
    while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1)
    lines[maxLines - 1] = last + '…'
  }
  return lines
}

function drawCard(ctx, opts) {
  const ink = '#3E2723'
  const gold = '#8a5e15'
  const red = '#C62828'

  // 宣纸底 + 双线框（外粗内细）
  ctx.fillStyle = '#F8F3E9'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(139,105,20,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(14, 14, W - 28, H - 28)
  ctx.strokeStyle = 'rgba(139,105,20,0.18)'
  ctx.lineWidth = 1
  ctx.strokeRect(24, 24, W - 48, H - 48)

  // 顶题
  ctx.fillStyle = gold
  ctx.font = '22px "Songti SC","STSong","SimSun",serif'
  ctx.textAlign = 'center'
  ctx.fillText('周 易 · 卦 象', W / 2, 62)

  // 六爻（上→下；阳爻实、阴爻断，动爻朱红并点标记）
  const xiang = opts.xiang || []
  const dong = opts.dong || []
  const LW = 190       // 爻线总宽
  const LH = 12        // 爻线厚
  const GAP = 16       // 阴爻中断
  const SLOT = 26      // 行距
  const x0 = (W - LW) / 2
  const y0 = 96        // 首爻（上爻）中心
  for (let i = 0; i < 6; i++) {
    const cy = y0 + i * SLOT
    const isDong = +dong[i] === 1
    ctx.fillStyle = isDong ? red : ink
    if (+xiang[i] === 1) {
      ctx.fillRect(x0, cy - LH / 2, LW, LH)
    } else {
      const seg = (LW - GAP) / 2
      ctx.fillRect(x0, cy - LH / 2, seg, LH)
      ctx.fillRect(x0 + seg + GAP, cy - LH / 2, seg, LH)
    }
    if (isDong) {
      ctx.beginPath()
      ctx.arc(x0 + LW + 18, cy, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 卦名 + 全称
  ctx.fillStyle = ink
  ctx.font = '600 64px "Kaiti SC","STKaiti","KaiTi","Songti SC",serif'
  ctx.fillText(opts.name || '', W / 2, 316)
  ctx.fillStyle = '#5D4037'
  ctx.font = '24px "Songti SC","STSong","SimSun",serif'
  ctx.fillText(opts.full || '', W / 2, 350)

  // 分隔短线
  ctx.strokeStyle = 'rgba(139,105,20,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 32, 370)
  ctx.lineTo(W / 2 + 32, 370)
  ctx.stroke()

  // 一句话（白话卦辞 / 卦义，最多两行）
  ctx.fillStyle = '#6b5a48'
  ctx.font = '20px "Songti SC","STSong","SimSun",serif'
  const lines = wrapText(ctx, opts.line || '', 460, 2)
  lines.forEach((t, i) => ctx.fillText(t, W / 2, 402 + i * 28))

  // 落款
  ctx.fillStyle = '#a8916e'
  ctx.font = '16px "Songti SC","STSong","SimSun",serif'
  ctx.fillText('—— 易研六爻 · 周易文化 ——', W / 2, 456)
}

function makeShareCard(page, opts) {
  const query = wx.createSelectorQuery().in(page)
  query.select('#shareCard').fields({ node: true }).exec((res) => {
    const cv = res && res[0] && res[0].node
    if (!cv) return
    let dpr = 2
    try { dpr = wx.getWindowInfo().pixelRatio || 2 } catch (e) { /* 旧基础库降级 */ }
    cv.width = W * dpr
    cv.height = H * dpr
    const ctx = cv.getContext('2d')
    ctx.scale(dpr, dpr)
    drawCard(ctx, opts)
    wx.canvasToTempFilePath({
      canvas: cv,
      success: (r) => { page._shareImg = r.tempFilePath },
      fail: (e) => console.error('[分享卡] 导出失败', e)
    })
  })
}

export { makeShareCard }
