// pages/index/index.js
import { dateToGanZhi, kongWangByGanZhiIdx } from '../../utils/liuyao.js'

const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    dayGanZhi: '', // 今日日干支，如「丙戌」
    kongWang: ''   // 今日旬空，如「午未」
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 })
  },

  onShow() {
    // 今日干支 + 旬空（onShow 重算：跨天停留首页也能刷新）
    const d = dateToGanZhi(new Date())
    this.setData({
      dayGanZhi: d.gan + d.zhi,
      kongWang: kongWangByGanZhiIdx(d.idx).join('')
    })
    // 同步自定义 TabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  onShake() {
    // 先进问事签（独立页），确认所求后 redirect 进 3D 起卦页。
    // fail 露出错误（分包未编译/加载失败时静默无反应，最难排查）
    wx.navigateTo({
      url: '/package3d/pages/ask/ask',
      fail: (e) => {
        console.error('[首页] 进问事签失败', e)
        wx.showToast({ title: '进入失败：' + (e.errMsg || '未知'), icon: 'none' })
      }
    })
  },

  onManual() {
    wx.navigateTo({ url: '/pages/paipan/paipan' })
  },

  onDic() {
    wx.switchTab({ url: '/pages/dianji/dianji' })
  },

  onWuxing() {
    wx.showToast({ title: '五行基础', icon: 'none' })
  }
})
