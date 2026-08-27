// pages/dianji/shiyi.js — 十翼通读页：系辞上/下、说卦传全篇（章旨提要 + 逐句白话对照）
import { getXici, SHUOGUA, getZhangzhi } from '../../data/shiyi.js'
import { getShiyiBh } from '../../data/baihua-shiyi.js'
import { annotate } from '../../utils/pinyin.js'
import { themeClass, fontClass } from '../../utils/theme.js'

// 组逐句对照：白话数据在则取句对（原句也过 annotate 括注拼音），缺数据的章
// 回退整段原文渲染（保底，正常三十六章全覆盖不触发）
function bhPairs(book, h) {
  const ps = getShiyiBh(book, h)
  return ps ? ps.map(p => ({ y: annotate(p.y), b: p.b })) : []
}

Page({
  data: {
    statusBarHeight: 20,
    books: []
  },

  onLoad() {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20, themeCls: themeClass(), fontCls: fontClass() })
    const books = [
      ...getXici().map(b => ({
        name: b.book,
        chapters: b.chapters.map(c => ({ h: c.h, t: annotate(c.t), zz: getZhangzhi(b.book, c.h), pairs: bhPairs(b.book, c.h) }))
      })),
      { name: '说卦传', chapters: SHUOGUA.map(c => ({ h: c.h, t: annotate(c.t), zz: getZhangzhi('说卦传', c.h), pairs: bhPairs('说卦传', c.h) })) }
    ]
    this.setData({ books })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/dianji/dianji' }) })
  },

  onShareAppMessage() {
    return { title: '周易十翼 · 系辞传与说卦传通读', path: '/pages/dianji/shiyi' }
  },
  onShareTimeline() {
    return { title: '周易十翼 · 系辞传与说卦传通读' }
  }
})
