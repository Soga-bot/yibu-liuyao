// pages/index/index.js
import { dateToGanZhi, kongWangByGanZhiIdx } from '../../utils/liuyao.js'
import { themeClass, fontClass } from '../../utils/theme.js'

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
    this.setData({ themeCls: themeClass(), fontCls: fontClass() })
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

  onWuxing() {
    // 典籍库入口已由底部 TabBar 承载（首页不再重复）；五行基础为独立学习页
    wx.navigateTo({
      url: '/pages/wuxing/wuxing',
      fail: (e) => {
        console.error('[首页] 进五行基础失败', e)
        wx.showToast({ title: '进入失败：' + (e.errMsg || '未知'), icon: 'none' })
      }
    })
  },

  onBagua() {
    // 八卦基础：与五行基础并立的通识学习页
    wx.navigateTo({
      url: '/pages/bagua/bagua',
      fail: (e) => {
        console.error('[首页] 进八卦基础失败', e)
        wx.showToast({ title: '进入失败：' + (e.errMsg || '未知'), icon: 'none' })
      }
    })
  },

  // 转发（文化演示口径，不涉占断措辞）
  onShareAppMessage() {
    return { title: '易卜六爻 · 《周易》卦象典籍与排盘演示', path: '/pages/index/index' }
  }
})
