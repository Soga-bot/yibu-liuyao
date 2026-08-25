// pages/dianji/detail.js — 卦详情：卦辞/白话、彖传、六爻爻辞/小象、用九用六、大象传、文言(乾坤)、序卦、杂卦、典故
import { getGua } from '../../data/gua.js'
import { GONG_WUXING } from '../../utils/liuyao.js'
import { getZhuan } from '../../data/zhuan.js'
import { getBaihua } from '../../data/baihua.js'
import { getDiangu } from '../../data/diangu.js'
import { getWenyan, getXugua, getZagua } from '../../data/shiyi.js'
import { annotate, namePinyin } from '../../utils/pinyin.js'

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
    const zh = getZhuan(g.key) || {}
    const bh = getBaihua(g.key) || {}
    // 传统全称：上象+下象+卦名（如火水未济）；八纯卦作「乾为天」式
    const full = g.waiXiang === g.neiXiang
      ? g.name + '为' + g.waiXiang
      : g.waiXiang + g.neiXiang + g.name
    this.setData({
      gua: {
        name: g.name,
        nameP: namePinyin(g.name),
        full,
        desc: g.desc,
        guaci: annotate(g.guaci),
        guaciB: bh.guaci || '',
        dg: getDiangu(g.key, '卦辞'),
        tuan: zh.tuan ? annotate(zh.tuan) : '',
        tuanDg: getDiangu(g.key, '彖传'),
        daxiang: annotate(g.daxiang),
        yaoci: g.yaoci.map((y, i) => ({
          ti: y.ti,
          ci: annotate(y.ci),
          xiao: zh.xiao ? annotate(zh.xiao[i] || '') : '',
          ciB: bh.yaoci ? (bh.yaoci[i] || '') : '',
          dg: getDiangu(g.key, y.ti)
        })),
        yong: g.yong ? {
          ti: g.yong.ti,
          ci: annotate(g.yong.ci),
          xyong: zh.xyong ? annotate(zh.xyong) : '',
          yongB: bh.yong || ''
        } : null,
        wy: (getWenyan(g.key) || []).map(annotate),
        xu: annotate(getXugua(g.key)),
        za: annotate(getZagua(g.key)),
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
