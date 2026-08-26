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
        hasAi: !!h.ai,                                          // 已有问易解读
        id: h.id || '',
        xiang: h.yao.split('').reverse().map(b => +b),          // 卦象 上→下
        dongT: h.dong.split('').reverse().map(b => +b)          // 动爻标记 上→下
      }))
    })
  },

  // 「问易」标记：回看该卦已存的 AI 解读（catchtap 不触发行点击）
  onWen(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: '/package3d/pages/wenyi/wenyi?id=' + id,
      fail: (err) => {
        console.error('[我的] 回看问易解读失败', err)
        wx.showToast({ title: '进入失败', icon: 'none' })
      }
    })
  },

  // 回看：直达只读「卦成」结果页复原完整盘面（from=history 不重复落库；
  // id 带原记录 id，问易解读挂靠不换目标）
  openItem(e) {
    const d = e.currentTarget.dataset
    let url = '/package3d/pages/result/result?yao=' + d.yao + '&dong=' + d.dong + '&gz=' + d.gz + '&from=history'
    if (d.qiu) url += '&q=' + encodeURIComponent(d.qiu)
    if (d.id) url += '&id=' + d.id
    wx.navigateTo({
      url,
      fail: (err) => {
        console.error('[我的] 回看卦盘失败', err)
        wx.showToast({ title: '进入失败', icon: 'none' })
      }
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
