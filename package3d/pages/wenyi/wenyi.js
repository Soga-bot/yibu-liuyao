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

Page({
  data: {
    statusBarHeight: 20,
    ready: false,      // 是否取得有效卦参
    open: false,       // 问易服务是否已开通（AI_API 已配置）
    qiu: '',
    gz: '',
    name: '',
    key: '',
    bianName: '',
    bianKey: ''
  },

  onLoad(options) {
    const app = getApp()
    this.setData({
      statusBarHeight: (app && app.globalData.statusBarHeight) || 20,
      open: !!AI_API
    })
    const qiu = options && options.q ? decodeURIComponent(options.q).slice(0, 30) : ''
    const yaoStr = options && options.yao && /^[01]{6}$/.test(options.yao) ? options.yao : ''
    if (!yaoStr) {
      this.setData({ qiu, ready: false })   // 缺参空态（理论不至：入口必带参）
      return
    }
    const dongStr = /^[01]{6}$/.test(options.dong || '') ? options.dong : '000000'
    const today = dateToGanZhi(new Date())
    let jz = today.gan + today.zhi
    if (options.gz && JIAZI.indexOf(options.gz) >= 0) jz = options.gz

    const yao = yaoStr.split('').map((b, i) => ({ yin: b === '0', dong: dongStr[i] === '1' }))
    const r = paipan({ yao, dayGan: jz[0], dayZhi: jz[1] })
    let bianName = ''
    let bianKey = ''
    if (yao.some((l) => l.dong)) {
      bianKey = yao.map((l) => (l.dong ? (l.yin ? '1' : '0') : (l.yin ? '0' : '1'))).join('')
      bianName = (GUA_DATA[bianKey] || {}).name || ''
    }
    this.setData({ ready: true, qiu, gz: jz, name: r.name, key: yaoStr, bianName, bianKey })
  },

  // 未开通态的引导：先读原文（本卦/变卦），典籍详情里有卦辞白话与取象
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
