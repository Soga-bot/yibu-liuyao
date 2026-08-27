// pages/dianji/dianji.js — 典籍库：64 卦列表 + 搜索
import { GUA_LIST } from '../../data/gua.js'
import { GONG_WUXING } from '../../utils/liuyao.js'
import { themeClass, fontClass } from '../../utils/theme.js'

const app = getApp()

// 预处理：卦象爻线（上→下）、宫五行、传统全名，供列表与搜索使用
// 全名规则：上卦象+下卦象+卦名（如火水未济）；八纯卦作「乾为天」式
const ALL = GUA_LIST.map(g => {
  const pure = g.waiXiang === g.neiXiang
  const full = pure ? g.name + '为' + g.waiXiang : g.waiXiang + g.neiXiang + g.name
  return {
    key: g.key,
    name: g.name,
    full,                                             // 火水未济 / 乾为天
    alias: pure ? '' : g.neiXiang + g.waiXiang + g.name, // 象序记反（水火未济）也能搜到
    desc: g.desc,
    gong: g.gong,
    gongLabel: g.gong + '宫',                       // 搜「离」和「离宫」都能命中
    wx: GONG_WUXING[g.gong] || '',
    xiang: g.key.split('').reverse().map(b => +b) // key 为初→上，展示需上爻在前
  }
})

Page({
  data: {
    statusBarHeight: 20,
    themeCls: '',   // 手动主题覆盖类（t-dark/t-light，auto 为空）
    fontCls: '',    // 阅读字号类（fs-big/fs-huge，标准为空）
    keyword: '',
    list: ALL,
    total: ALL.length
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 })
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.setData({ themeCls: themeClass(), fontCls: fontClass() })
  },

  // 按卦名 / 卦宫 / 传统全名（含象序写反的容错）过滤
  // 校勘约定（docs/校勘备注.md）：经传原文作「遯」、程序卦名作「遁」——
  // 关键词归一化后古字「遯」同样命中（搜「天山遯」→ 天山遁）
  onSearch(e) {
    const raw = (e.detail.value || '').trim()
    const k = raw.replace(/遯/g, '遁')
    const list = !raw ? ALL : ALL.filter(g =>
      g.name.indexOf(k) >= 0 || g.gongLabel.indexOf(k) >= 0 ||
      g.full.indexOf(k) >= 0 || (g.alias && g.alias.indexOf(k) >= 0)
    )
    this.setData({ keyword: raw, list })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/dianji/detail?key=' + e.currentTarget.dataset.key })
  },

  goShiyi() {
    wx.navigateTo({ url: '/pages/dianji/shiyi' })
  },

  onShareAppMessage() {
    return { title: '《周易》六十四卦 · 卦爻辞白话与彖象典故', path: '/pages/dianji/dianji' }
  }
})
