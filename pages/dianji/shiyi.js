// pages/dianji/shiyi.js — 十翼通读页：系辞上/下、说卦传全篇（各章附章旨提要）
import { getXici, SHUOGUA, getZhangzhi } from '../../data/shiyi.js'
import { annotate } from '../../utils/pinyin.js'
import { themeClass, fontClass } from '../../utils/theme.js'

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
        chapters: b.chapters.map(c => ({ h: c.h, t: annotate(c.t), zz: getZhangzhi(b.book, c.h) }))
      })),
      { name: '说卦传', chapters: SHUOGUA.map(c => ({ h: c.h, t: annotate(c.t), zz: getZhangzhi('说卦传', c.h) })) }
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
