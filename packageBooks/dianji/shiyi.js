// packageBooks/dianji/shiyi.js — 十翼通读页：系辞上/下、文言传（乾坤）、说卦、序卦、杂卦
// （章旨提要 + 逐句白话对照；彖/象随卦详情页展示，此处即十翼全书通读）
import { getXici, SHUOGUA, getZhangzhi, WENYAN_QIAN, WENYAN_KUN, XUGUA_CH, ZAGUA_CH } from '../../data/shiyi.js'
import { getShiyiBh } from '../../data/baihua-shiyi.js'
import { annotate } from '../../utils/pinyin.js'
import { themeClass, fontClass } from '../../utils/theme.js'

// 组逐句对照：白话数据在则取句对（原句也过 annotate 括注拼音），缺数据的章
// 回退整段原文渲染（保底，正常五十七章全覆盖不触发）
function bhPairs(book, h) {
  const ps = getShiyiBh(book, h)
  return ps ? ps.map(p => ({ y: annotate(p.y), b: p.b })) : []
}

// 章标题：序卦（上/下篇）、杂卦（全篇）非「第X章」体例，ti 指定显示名
const ch = (book, c, ti) => ({ h: c.h, ti: ti || '', t: annotate(c.t), zz: getZhangzhi(book, c.h), pairs: bhPairs(book, c.h) })

Page({
  data: {
    statusBarHeight: 20,
    books: []
  },

  onLoad() {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20, themeCls: themeClass(), fontCls: fontClass() })
    const books = [
      ...getXici().map(b => ({ name: b.book, chapters: b.chapters.map(c => ch(b.book, c)) })),
      { name: '文言传·乾', chapters: WENYAN_QIAN.map(c => ch('文言传·乾', c)) },
      { name: '文言传·坤', chapters: WENYAN_KUN.map(c => ch('文言传·坤', c)) },
      { name: '说卦传', chapters: SHUOGUA.map(c => ch('说卦传', c)) },
      { name: '序卦传', chapters: XUGUA_CH.map(c => ch('序卦传', c, c.h === '上' ? '上篇' : '下篇')) },
      { name: '杂卦传', chapters: ZAGUA_CH.map(c => ch('杂卦传', c, '全篇')) }
    ]
    this.setData({ books })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/dianji/dianji' }) })
  },

  onShareAppMessage() {
    return { title: '周易十翼 · 系辞文言说序杂通读', path: '/packageBooks/dianji/shiyi' }
  },
  onShareTimeline() {
    return { title: '周易十翼 · 系辞文言说序杂通读' }
  }
})
