// package3d/pages/result/result.js — 摇卦结果页（3D 摇卦闭环终点）
// 与手动排盘(pages/paipan)同引擎同观感，但两页独立：本页只读展示摇出的卦，
// 无录入六爻/改阴阳/换日干支等任何编辑交互——「摇出来的卦」≠「手动排的盘」。
// 入参：yao/dong（6 位 0|1，初→上）、q（所问，随历史落库）；缺参显示空态。
import { paipan, dateToGanZhi, TIAN_GAN, DI_ZHI } from '../../../utils/liuyao.js'
import { GUA_DATA } from '../../../data/gua.js'

const POS_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] // index0=初

// 六十甲子（日干支按摇卦当天取，展示用）
const JIAZI = []
for (let n = 0; n < 60; n++) JIAZI.push(TIAN_GAN[n % 10] + DI_ZHI[n % 12])

// 摇卦历史：与 pages/paipan 同库同格式（mine 页渲染；点开回看走 paipan?from=history）
const HISTORY_KEY = 'ly_history'
const HISTORY_MAX = 100

function saveHistory(entry) {
  let list = wx.getStorageSync(HISTORY_KEY) || []
  // 与最近一条完全相同的卦不重复入列；所问不同视为两条
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
    qiu: '',
    gz: '',
    result: null,
    rows: null    // 排盘显示行（上→初）
  },

  onLoad(options) {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20 })
    const qiu = options && options.q ? decodeURIComponent(options.q).slice(0, 30) : ''
    const yaoStr = options && options.yao && /^[01]{6}$/.test(options.yao) ? options.yao : ''
    if (!yaoStr) {
      this.setData({ qiu })   // 缺参空态（理论不至：入口必带参）
      return
    }
    const dongStr = /^[01]{6}$/.test(options.dong || '') ? options.dong : '000000'
    const yao = yaoStr.split('').map((b, i) => ({ yin: b === '0', dong: dongStr[i] === '1' }))
    // 日干支：默认摇卦当天（可带 gz 覆盖，历史/将来回放用）
    const today = dateToGanZhi(new Date())
    let jz = today.gan + today.zhi
    if (options.gz && JIAZI.indexOf(options.gz) >= 0) jz = options.gz

    const r = paipan({ yao, dayGan: jz[0], dayZhi: jz[1] })
    const kb = GUA_DATA[yaoStr] || {}
    // 显示行：上→初（倒序）；爻题/爻辞查知识库
    const rows = r.lines.slice().reverse().map((l) => ({
      posName: POS_NAMES[l.pos - 1],
      ti: kb.yaoci ? kb.yaoci[l.pos - 1].ti : '',
      ci: kb.yaoci ? (kb.yaoci[l.pos - 1].ci || '') : '',
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
      qiu,
      gz: jz,
      result: Object.assign(r, {
        desc: kb.desc || '',
        daxiang: kb.daxiang || '',
        guaci: kb.guaci || ''
      }),
      rows
    })
    // 落摇卦历史（与手动排盘同库：mine 页统一渲染）
    saveHistory({
      t: Date.now(),
      yao: yaoStr,
      dong: dongStr,
      gz: jz,
      name: r.name,
      qiu
    })
  },

  // 点爻行展开/收起爻辞（只读页里唯一交互：查原文，非编辑）
  toggleCi(e) {
    const i = +e.currentTarget.dataset.i
    this.setData({ ['rows[' + i + '].showCi']: !this.data.rows[i].showCi })
  },

  // 重新起卦：回问事签重新默祷（新的一卦）
  goAsk() {
    wx.redirectTo({ url: '/package3d/pages/ask/ask', fail: () => {} })
  },
  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
