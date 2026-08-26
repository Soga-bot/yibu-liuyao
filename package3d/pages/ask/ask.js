// package3d/pages/ask/ask.js
// 问事签：起卦前默祷所求（可不填）。独立普通页面（无 canvas，浮层永不被 3D 画布压住），
// 确认后 redirectTo 3D 起卦页，所求经 q 参数带去排盘/历史。
import { themeClass, fontClass } from '../../../utils/theme.js'

const HISTORY_KEY = 'ly_history' // 与 result/paipan/mine 同库

Page({
  data: { qiu: '' },

  onLoad(options) {
    this.setData({ themeCls: themeClass(), fontCls: fontClass() })
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
  // 一事一占：同一所问当日已占（摇卦或手动排盘皆入历史），再占前温和确认。
  // 出典《蒙》卦辞「初筮告，再三渎，渎则不告」——提示传统，不挡人；
  // 未署所问无从比对，不弹。
  askedToday(qiu) {
    const q = (qiu || '').trim()
    if (!q) return false
    const now = new Date()
    return (wx.getStorageSync(HISTORY_KEY) || []).some((h) => {
      if (!h || !h.t || (h.qiu || '').trim() !== q) return false
      const d = new Date(h.t)
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate()
    })
  },

  onQiuConfirm() {
    if (!this.gateOk()) return
    const q = (this.data.qiu || '').trim()
    console.log('[问事签] 确认', q || '(未填)')
    if (this.askedToday(q)) {
      wx.showModal({
        title: '一事一占',
        content: '《蒙》卦辞：「初筮告，再三渎，渎则不告。」\n同一所问今日已占过，传统以一占为诚。仍要再摇吗？',
        confirmText: '心诚再摇',
        cancelText: '返回',
        confirmColor: '#C62828',
        success: (res) => { if (res.confirm) this.go(q) }
      })
      return
    }
    this.go(q)
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
