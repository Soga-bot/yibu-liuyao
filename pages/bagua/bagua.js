// pages/bagua/bagua.js — 八卦基础（通识学习页，静态内容）
// 与五行基础并立的「体」页：卦画、先后天方位、说卦取象速查。
// 取象短表从 data/shiyi.js 的 TRIGRAM_XIANG（已校对原文 + 载入断言）派生，
// 不另手录一份，两处文本不会分叉。

import { TRIGRAM_XIANG } from '../../data/shiyi.js'

// 解析失败即刻报错，宁可崩不可静默出空串
const pick = (s, re, tag) => {
  const m = s.match(re)
  if (!m) throw new Error('八卦取象短句解析失败[' + tag + ']：' + s)
  return m[1]
}

// 先天数序：乾一兑二离三震四巽五坎六艮七坤八
// lines 为卦画三行（上→下，1 阳 0 阴），渲染直接竖排；wx 为五行色点用的 ASCII 类名
const BAGUA = [
  { n: '乾', shu: '一', xiang: '天', wx: 'jin', lines: [1, 1, 1] },
  { n: '兑', shu: '二', xiang: '泽', wx: 'jin', lines: [0, 1, 1] },
  { n: '离', shu: '三', xiang: '火', wx: 'huo', lines: [1, 0, 1] },
  { n: '震', shu: '四', xiang: '雷', wx: 'mu', lines: [0, 0, 1] },
  { n: '巽', shu: '五', xiang: '风', wx: 'mu', lines: [1, 1, 0] },
  { n: '坎', shu: '六', xiang: '水', wx: 'shui', lines: [0, 1, 0] },
  { n: '艮', shu: '七', xiang: '山', wx: 'tu', lines: [1, 0, 0] },
  { n: '坤', shu: '八', xiang: '地', wx: 'tu', lines: [0, 0, 0] }
].map((b) => ({
  ...b,
  // 性情短语出自说卦第七章整句（如「乾，健也」）
  qing: pick(TRIGRAM_XIANG[b.n].xing, /，(.+?)也/, '性情')
}))

// 载入自检：自然象须对得上说卦广象原文，卦画三行结构齐全
;(function assertBg () {
  for (const b of BAGUA) {
    const sx = TRIGRAM_XIANG[b.n]
    if (!sx) throw new Error('八卦未见于说卦取象：' + b.n)
    if (!sx.guang.includes('为' + b.xiang)) throw new Error('自然象与说卦广象不符：' + b.n + '为' + b.xiang)
    if (b.lines.length !== 3 || b.lines.some((v) => v !== 0 && v !== 1)) throw new Error('卦画数据异常：' + b.n)
  }
})()

// 取象速查行（家人序：乾坤父母 + 三索六子），短表全部自原文抽出
const QU_ROWS = ['乾', '坤', '震', '巽', '坎', '离', '艮', '兑'].map((n) => {
  const x = TRIGRAM_XIANG[n]
  return {
    n,
    qing: pick(x.xing, /，(.+?)也/, '性情'),
    jia: pick(x.qin, /(?:谓之|称乎)(.+)$/, '家人'),   // 长男 / 父
    shou: pick(x.shou, /为(.+)$/, '动物'),            // 马
    shen: pick(x.shen, /为(.+)$/, '身体')             // 首
  }
})

// 先天八卦方位（伏羲）：传统图上南下北、左东右西，中为太极
const XIANTIAN = [
  [{ t: '兑', f: '东南' }, { t: '乾', f: '南' }, { t: '巽', f: '西南' }],
  [{ t: '离', f: '东' }, { t: '太极', f: '' }, { t: '坎', f: '西' }],
  [{ t: '震', f: '东北' }, { t: '坤', f: '北' }, { t: '艮', f: '西北' }]
]
// 后天八卦方位（文王）：角标为洛书九宫数，wx 为方位五行色点
const HOUTIAN = [
  [{ t: '巽', f: '东南', shu: '四', wx: 'mu' }, { t: '离', f: '南', shu: '九', wx: 'huo' }, { t: '坤', f: '西南', shu: '二', wx: 'tu' }],
  [{ t: '震', f: '东', shu: '三', wx: 'mu' }, { t: '中五', f: '', shu: '', wx: '' }, { t: '兑', f: '西', shu: '七', wx: 'jin' }],
  [{ t: '艮', f: '东北', shu: '八', wx: 'tu' }, { t: '坎', f: '北', shu: '一', wx: 'shui' }, { t: '乾', f: '西北', shu: '六', wx: 'jin' }]
]

// 方位图自检：两张图各自八卦齐全不重复
;(function assertGrid () {
  for (const g of [XIANTIAN, HOUTIAN]) {
    const names = g.flat().map((c) => c.t).filter((t) => BAGUA.some((b) => b.n === t))
    if (names.length !== 8 || new Set(names).size !== 8) throw new Error('方位图八卦不齐')
  }
})()

Page({
  data: {
    statusBarHeight: 20,
    bagua: BAGUA,
    qu: QU_ROWS,
    xiantian: XIANTIAN,
    houtian: HOUTIAN
  },

  onLoad() {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20 })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  onSuCha() {
    // 卦象速查：京房八宫六十四卦整表（点卦可入典籍详情）
    wx.navigateTo({
      url: '/pages/bagong/bagong',
      fail: (e) => {
        console.error('[八卦基础] 进卦象速查失败', e)
        wx.showToast({ title: '进入失败：' + (e.errMsg || '未知'), icon: 'none' })
      }
    })
  },

  onShareAppMessage() {
    return { title: '八卦基础 · 先天后天八卦与取象速查', path: '/pages/bagua/bagua' }
  },
  onShareTimeline() {
    return { title: '八卦基础 · 先后天八卦与取象速查' }
  }
})
