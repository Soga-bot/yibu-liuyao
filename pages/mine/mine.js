// pages/mine/mine.js — 我的：摇卦历史 + 关于
const app = getApp()

const HISTORY_KEY = 'ly_history' // 与 paipan.js 保持一致
const VERSION = '0.1.0'

function pad(n) { return n < 10 ? '0' + n : '' + n }
function fmtTime(t) {
  const d = new Date(t)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

Page({
  data: {
    statusBarHeight: 20,
    items: [],
    count: 0,
    version: VERSION
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 })
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.reload()
  },

  reload() {
    const list = wx.getStorageSync(HISTORY_KEY) || []
    this.setData({
      count: list.length,
      items: list.map((h, i) => ({
        i,
        timeStr: fmtTime(h.t),
        yao: h.yao,
        dong: h.dong,
        gz: h.gz,
        name: h.name,
        qiu: h.qiu || '',
        xiang: h.yao.split('').reverse().map(b => +b),          // 卦象 上→下
        dongT: h.dong.split('').reverse().map(b => +b)          // 动爻标记 上→下
      }))
    })
  },

  // 回看：带参进排盘页，自动复原完整卦盘（from=history 不写回记录）
  openItem(e) {
    const d = e.currentTarget.dataset
    wx.navigateTo({
      url: '/pages/paipan/paipan?yao=' + d.yao + '&dong=' + d.dong + '&gz=' + d.gz + '&from=history'
    })
  },

  // 长按删除单条
  delItem(e) {
    const i = +e.currentTarget.dataset.i
    const item = this.data.items[i]
    if (!item) return
    wx.showModal({
      title: '删除记录',
      content: '删除「' + item.name + '」这条起卦记录？',
      confirmColor: '#C62828',
      success: (res) => {
        if (!res.confirm) return
        const list = wx.getStorageSync(HISTORY_KEY) || []
        list.splice(i, 1)
        wx.setStorageSync(HISTORY_KEY, list)
        this.reload()
      }
    })
  },

  clearAll() {
    if (!this.data.count) return
    wx.showModal({
      title: '清空历史',
      content: '将删除全部 ' + this.data.count + ' 条起卦记录，不可恢复',
      confirmColor: '#C62828',
      success: (res) => {
        if (!res.confirm) return
        wx.removeStorageSync(HISTORY_KEY)
        this.reload()
      }
    })
  }
})
