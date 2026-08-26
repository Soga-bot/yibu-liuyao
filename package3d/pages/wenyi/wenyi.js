// package3d/pages/wenyi/wenyi.js — 问易（AI 解卦壳页）
// 「问易」：摇卦成卦后的 AI 解读入口。AI 接口必须走自有服务器中转，
// 密钥不下发小程序端（安全与审核双重要求）；AI_API 为空即「未开通」态，
// 页面引导先读本卦/变卦卦辞，不做死胡同。入参与 result 页同：yao/dong/gz/q。
import { paipan, dateToGanZhi, TIAN_GAN, DI_ZHI } from '../../../utils/liuyao.js'
import { GUA_DATA } from '../../../data/gua.js'

// 服务器中转地址：接入时只改此处（POST { yao, dong, gz, q }，返回 { text }）
const AI_API = ''

// 后续接入的请求骨架：现在留着不调用，接后端时补渲染逻辑即可
function askAI(payload) {
  return new Promise((resolve, reject) => {
    if (!AI_API) { reject(new Error('问易服务未配置')); return }
    wx.request({
      url: AI_API, method: 'POST', data: payload,
      success: (res) => resolve(res.data),
      fail: reject
    })
  })
}

const JIAZI = []
for (let n = 0; n < 60; n++) JIAZI.push(TIAN_GAN[n % 10] + DI_ZHI[n % 12])

// 摇卦历史（与 result/paipan 同库）：按 id 回看已存解读
const HISTORY_KEY = 'ly_history'

function pad(n) { return n < 10 ? '0' + n : '' + n }
function fmtTime(t) {
  const d = new Date(t)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// 等待动画的八卦环：先天序卦画（上→下，1 阳 0 阴），与八卦基础页同数据
const BAGUA_RING = [
  { n: '乾', l: [1, 1, 1] },
  { n: '兑', l: [0, 1, 1] },
  { n: '离', l: [1, 0, 1] },
  { n: '震', l: [0, 0, 1] },
  { n: '巽', l: [1, 1, 0] },
  { n: '坎', l: [0, 1, 0] },
  { n: '艮', l: [1, 0, 0] },
  { n: '坤', l: [0, 0, 0] }
]

Page({
  data: {
    statusBarHeight: 20,
    ready: false,      // 是否取得有效卦参
    open: false,       // 问易服务是否已开通（AI_API 已配置）
    loading: false,    // 解读生成中（服务开通后用）
    qiu: '',
    gz: '',
    name: '',
    key: '',
    bianName: '',
    bianKey: '',
    aiText: '',        // 已存的问易解读（本页生成或历史回看）
    aiAtStr: '',
    ring: BAGUA_RING   // 等待动画的八卦环
  },

  onLoad(options) {
    const app = getApp()
    this.setData({
      statusBarHeight: (app && app.globalData.statusBarHeight) || 20,
      open: !!AI_API
    })
    // 问易入口带全参；「我的」历史回看只带 id——从记录里取参（含已存解读）
    let yaoStr = options && options.yao && /^[01]{6}$/.test(options.yao) ? options.yao : ''
    let dongStr = /^[01]{6}$/.test((options && options.dong) || '') ? options.dong : ''
    let gzOpt = (options && options.gz) || ''
    let qiu = options && options.q ? decodeURIComponent(options.q).slice(0, 30) : ''
    this._id = (options && options.id) || ''
    this._entry = null
    if (!yaoStr && this._id) {
      const e = (wx.getStorageSync(HISTORY_KEY) || []).find((x) => x.id === this._id)
      if (e) {
        yaoStr = /^[01]{6}$/.test(e.yao || '') ? e.yao : ''
        dongStr = /^[01]{6}$/.test(e.dong || '') ? e.dong : ''
        gzOpt = e.gz || ''
        qiu = (e.qiu || '').slice(0, 30)
        this._entry = e
      }
    }
    if (!yaoStr) {
      this.setData({ qiu, ready: false })   // 缺参空态（理论不至：入口必带参）
      return
    }
    if (!dongStr) dongStr = '000000'
    const today = dateToGanZhi(new Date())
    let jz = today.gan + today.zhi
    if (gzOpt && JIAZI.indexOf(gzOpt) >= 0) jz = gzOpt

    const yao = yaoStr.split('').map((b, i) => ({ yin: b === '0', dong: dongStr[i] === '1' }))
    const r = paipan({ yao, dayGan: jz[0], dayZhi: jz[1] })
    let bianName = ''
    let bianKey = ''
    if (yao.some((l) => l.dong)) {
      bianKey = yao.map((l) => (l.dong ? (l.yin ? '1' : '0') : (l.yin ? '0' : '1'))).join('')
      bianName = (GUA_DATA[bianKey] || {}).name || ''
    }
    const ai = this._entry && this._entry.ai
    this.setData({
      ready: true,
      qiu, gz: jz, name: r.name, key: yaoStr, bianName, bianKey,
      aiText: ai ? ai.text : '',
      aiAtStr: ai ? fmtTime(ai.at) : ''
    })
    this._args = { yao: yaoStr, dong: dongStr, gz: jz, q: qiu }
  },

  // 未开通态的引导：先读原文（本卦/变卦），典籍详情里有卦辞白话与取象
  // 服务开通后的取读入口（AI_API 配置后 wxml 切换出按钮）
  onAsk() {
    if (!AI_API || !this._args) return
    this.setData({ loading: true })
    askAI({ yao: this._args.yao, dong: this._args.dong, gz: this._args.gz, q: this._args.q })
      .then((d) => {
        const text = d && d.text ? String(d.text) : ''
        this.setData({ aiText: text, aiAtStr: fmtTime(Date.now()), loading: false })
        this.saveAiText(text)   // 解读即时落库，「我的」历史出现「问易」标记
      })
      .catch(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '问易服务暂不可用', icon: 'none' })
      })
  },

  // AI 解读落库：写回对应历史条目（先按 id，老数据无 id 时按卦参兜底匹配）
  saveAiText(text) {
    if (!text) return
    const list = wx.getStorageSync(HISTORY_KEY) || []
    const a = this._args || {}
    const e = list.find((x) =>
      (this._id && x.id === this._id) ||
      (x.yao === a.yao && x.dong === a.dong && x.gz === a.gz && (x.qiu || '') === (a.q || '')))
    if (!e) return
    e.ai = { text, at: Date.now() }
    wx.setStorageSync(HISTORY_KEY, list)
  },

  onGuaci() {
    if (!this.data.key) return
    wx.navigateTo({
      url: '/pages/dianji/detail?key=' + this.data.key,
      fail: (e) => {
        console.error('[问易] 进本卦详情失败', e)
        wx.showToast({ title: '进入失败', icon: 'none' })
      }
    })
  },
  onBianGuaci() {
    if (!this.data.bianKey) return
    wx.navigateTo({
      url: '/pages/dianji/detail?key=' + this.data.bianKey,
      fail: (e) => {
        console.error('[问易] 进变卦详情失败', e)
        wx.showToast({ title: '进入失败', icon: 'none' })
      }
    })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
