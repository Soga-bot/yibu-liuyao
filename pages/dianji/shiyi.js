// pages/dianji/shiyi.js — 十翼通读页：系辞上/下、说卦传全篇
import { getXici, SHUOGUA } from '../../data/shiyi.js'
import { annotate } from '../../utils/pinyin.js'

Page({
  data: {
    statusBarHeight: 20,
    books: []
  },

  onLoad() {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20 })
    const books = [
      ...getXici().map(b => ({
        name: b.book,
        chapters: b.chapters.map(c => ({ h: c.h, t: annotate(c.t) }))
      })),
      { name: '说卦传', chapters: SHUOGUA.map(c => ({ h: c.h, t: annotate(c.t) })) }
    ]
    this.setData({ books })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/dianji/dianji' }) })
  }
})
