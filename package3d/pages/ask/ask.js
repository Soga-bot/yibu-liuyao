// package3d/pages/ask/ask.js
// 问事签：起卦前默祷所求（可不填）。独立普通页面（无 canvas，浮层永不被 3D 画布压住），
// 确认后 redirectTo 3D 起卦页，所求经 q 参数带去排盘/历史。
Page({
  data: { qiu: '' },

  onLoad(options) {
    console.log('[流程] 问事签页进入')
    // 预填场景：暂无（每次起卦都是新问）；留参数口子不杜撰
    const q = options && options.q ? decodeURIComponent(options.q).slice(0, 30) : ''
    if (q) this.setData({ qiu: q })
  },

  onReady() {
    this._readyAt = Date.now()
  },

  onQiuInput(e) { this.setData({ qiu: e.detail.value }) },

  // 防幽灵确认（3D 页同款教训）：页面展示满 600ms 才接受按钮——
  // 上页导航进来的残留点击落在本页按钮上时直接忽略
  gateOk() {
    if (!this._readyAt || Date.now() - this._readyAt < 600) {
      console.log('[问事签] 忽略过快点击（疑似导航残留）')
      return false
    }
    return true
  },

  // 跳 3D 起卦页（redirectTo：回退直接回首页/来源 tab，不经过本页）
  go(q) {
    wx.redirectTo({
      url: '/package3d/pages/divination/divination' + (q ? '?q=' + encodeURIComponent(q) : ''),
      fail: (e) => console.error('[问事签] 跳转失败', e)
    })
  },
  onQiuConfirm() {
    if (!this.gateOk()) return
    console.log('[问事签] 确认', this.data.qiu || '(未填)')
    this.go((this.data.qiu || '').trim())
  },
  onQiuSkip() {
    if (!this.gateOk()) return
    console.log('[问事签] 直接起卦')
    this.go('')
  },

  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
