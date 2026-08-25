// pages/paipan/paipan.js — 手动排盘（输入6爻+日干支 → 排盘展示）
import { paipan, dateToGanZhi, TIAN_GAN, DI_ZHI } from '../../utils/liuyao.js'
import { GUA_DATA } from '../../data/gua.js'

const POS_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] // index0=初

// 六十甲子
const JIAZI = []
for (let n = 0; n < 60; n++) JIAZI.push(TIAN_GAN[n % 10] + DI_ZHI[n % 12])

// 摇卦历史：mine 页渲染，条目点开回看时带 from=history 防重复记录
const HISTORY_KEY = 'ly_history'
const HISTORY_MAX = 100

function saveHistory(entry) {
  let list = wx.getStorageSync(HISTORY_KEY) || []
  // 与最近一条完全相同的卦不重复入列（手动反复点「排盘」只刷新时间）；所求不同视为两条
  const top = list[0]
  if (top && top.yao === entry.yao && top.dong === entry.dong && top.gz === entry.gz &&
      (top.qiu || '') === (entry.qiu || '')) {
    top.t = entry.t
  } else {
    list.unshift(entry)
  }
  if (list.length > HISTORY_MAX) list.length = HISTORY_MAX
  wx.setStorageSync(HISTORY_KEY, list)
}

Page({
  data: {
    statusBarHeight: 20,
    // 6 爻 输入（初→上），默认全阳不动
    yao: [
      { yin: false, dong: false }, { yin: false, dong: false },
      { yin: false, dong: false }, { yin: false, dong: false },
      { yin: false, dong: false }, { yin: false, dong: false }
    ],
    posNames: POS_NAMES,
    jiazi: JIAZI,
    jiaziIndex: 0, // 日干支选择
    result: null,
    rows: null    // 排盘显示行（上→初）
  },

  onLoad(options) {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20 })
    this._from = (options && options.from) || '' // history=历史回看，不写记录
    // 所问之事（3D 问事签带入），随历史落库；手动排盘为空
    this._qiu = options && options.q ? decodeURIComponent(options.q).slice(0, 30) : ''
    const today = dateToGanZhi(new Date())
    const idx = JIAZI.indexOf(today.gan + today.zhi)
    this.setData({ jiaziIndex: idx >= 0 ? idx : 0 })

    // 带参进入（3D 摇卦 / 历史回看，yao/dong 均 6 位，初→上，1=阳/动）：直接出盘
    if (options && options.yao && /^[01]{6}$/.test(options.yao)) {
      const dong = /^[01]{6}$/.test(options.dong || '') ? options.dong : '000000'
      const patch = {
        yao: options.yao.split('').map((b, i) => ({ yin: b === '0', dong: dong[i] === '1' }))
      }
      const gzIdx = JIAZI.indexOf(options.gz || '')
      if (gzIdx >= 0) patch.jiaziIndex = gzIdx
      this.setData(patch)
      this.onPaipan()
    }
  },

  // 点阳爻/阴爻切换
  toggleYin(e) {
    const i = +e.currentTarget.dataset.i
    const yao = this.data.yao.map((y, idx) => idx === i ? { ...y, yin: !y.yin } : y)
    this.setData({ yao })
  },
  // 动/静切换
  toggleDong(e) {
    const i = +e.currentTarget.dataset.i
    const yao = this.data.yao.map((y, idx) => idx === i ? { ...y, dong: !y.dong } : y)
    this.setData({ yao })
  },
  onJiaziChange(e) {
    this.setData({ jiaziIndex: +e.detail.value })
  },

  onPaipan() {
    const jz = JIAZI[this.data.jiaziIndex]
    const r = paipan({ yao: this.data.yao, dayGan: jz[0], dayZhi: jz[1] })
    // 知识库查表：取卦象描述/大象传/爻题
    const key = this.data.yao.map(y => y.yin ? '0' : '1').join('')
    const kb = GUA_DATA[key] || {}
    // 显示行：上→初（倒序）
    const rows = r.lines.slice().reverse().map(l => ({
      posName: POS_NAMES[l.pos - 1],
      ti: kb.yaoci ? kb.yaoci[l.pos - 1].ti : '',   // 爻题(初九/六二…)，知识库已规则填好
      ci: kb.yaoci ? (kb.yaoci[l.pos - 1].ci || '') : '',  // 爻辞原文（《周易》）
      showCi: false,
      yin: l.yin,
      dong: l.dong,
      gan: l.gan,
      zhi: l.zhi,
      wuxing: l.wuxing,
      liuqin: l.liuqin,
      liushen: l.liushen,
      tag: l.isShi ? '世' : (l.isYing ? '应' : ''),
      kong: l.kong
    }))
    this.setData({
      result: Object.assign(r, {
        desc: kb.desc || '',
        daxiang: kb.daxiang || '',
        guaci: kb.guaci || ''                        // 卦辞原文（《周易》）
      }),
      rows
    })

    // 写入摇卦历史（历史回看 from=history 除外；手动/3D 均记录）
    if (this._from !== 'history') {
      saveHistory({
        t: Date.now(),
        yao: key,
        dong: this.data.yao.map(y => y.dong ? '1' : '0').join(''),
        gz: jz,
        name: r.name,
        qiu: this._qiu || ''
      })
    }
  },

  // 点爻行展开/收起爻辞
  toggleCi(e) {
    const i = +e.currentTarget.dataset.i
    this.setData({ ['rows[' + i + '].showCi']: !this.data.rows[i].showCi })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
