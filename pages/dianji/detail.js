// pages/dianji/detail.js — 卦详情：卦辞 / 六爻爻辞 / 用九用六 / 大象传
import { getGua } from '../../data/gua.js'
import { GONG_WUXING } from '../../utils/liuyao.js'

Page({
  data: {
    statusBarHeight: 20,
    gua: null
  },

  onLoad(options) {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20 })
    const g = getGua((options && options.key) || '')
    if (!g) return
    const wx = GONG_WUXING[g.gong] || ''
    // 传统全称：上象+下象+卦名（如火水未济）；八纯卦作「乾为天」式
    const full = g.waiXiang === g.neiXiang
      ? g.name + '为' + g.waiXiang
      : g.waiXiang + g.neiXiang + g.name
    this.setData({
      gua: {
        name: g.name,
        full,
        desc: g.desc,
        guaci: g.guaci,
        daxiang: g.daxiang,
        yaoci: g.yaoci,
        yong: g.yong || null,
        meta: [
          { k: '全称', v: full },
          { k: '卦宫', v: g.gong + '宫 · ' + wx },
          { k: '上卦', v: g.wai + '（' + g.waiXiang + '）' },
          { k: '下卦', v: g.nei + '（' + g.neiXiang + '）' }
        ],
        xiang: g.key.split('').reverse().map(b => +b) // 上爻在前
      }
    })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/dianji/dianji' }) })
  }
})
