// package3d/pages/wenyi/wenyi.js — 问易（AI 解卦壳页）
// 「问易」：摇卦成卦后的解读入口。三态由 utils/wenyi-config.js 的 WENYI_MODE 决定：
//   ''      未开通——引导先读本卦/变卦卦辞，不做死胡同；
//   'mock'  本地合成——package3d/utils/wenyi-mock.js 用排盘+经文库在端上合成参考文（模拟态）；
//   'cloud' 云函数——密钥只在云端环境变量，不下发小程序端（安全与审核双重要求）；
//           云端失败自动降级本地合成。
// 入参与 result 页同：yao/dong/gz/q。解读生成即落库，「我的」历史出现「问易」标记。
import { paipan, dateToGanZhi, TIAN_GAN, DI_ZHI } from '../../../utils/liuyao.js'
import { GUA_DATA } from '../../../data/gua.js'
import { themeClass, fontClass } from '../../../utils/theme.js'
import { WENYI_MODE } from '../../../utils/wenyi-config.js'
import { synthesizeWenyi } from '../../utils/wenyi-mock.js'

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
    mode: WENYI_MODE,  // ''|'mock'|'cloud'（utils/wenyi-config.js）
    loading: false,    // 解读生成中
    qiu: '',
    gz: '',
    name: '',
    key: '',
    bianName: '',
    bianKey: '',
    aiText: '',        // 已存的问易解读（本页生成或历史回看）
    aiMeta: '',        // 摘要行：时间 + 来源标注
    ring: BAGUA_RING   // 等待动画的八卦环
  },

  onLoad(options) {
    this.setData({ themeCls: themeClass(), fontCls: fontClass() })
    const app = getApp()
    this.setData({
      statusBarHeight: (app && app.globalData.statusBarHeight) || 20
    })
    // 问易入口带全参；「我的」历史回看只带 id——从记录里取参（含已存解读）
    let yaoStr = options && options.yao && /^[01]{6}$/.test(options.yao) ? options.yao : ''
    let dongStr = /^[01]{6}$/.test((options && options.dong) || '') ? options.dong : ''
    let gzOpt = (options && options.gz) || ''
    let qiu = options && options.q ? decodeURIComponent(options.q).slice(0, 30) : ''
    this._id = (options && options.id) || ''
    this._entry = null
    // 有 id 就挂靠条目：「我的」问易标记只带 id（从记录取参）；
    // result 页带全参进也挂靠——已存解读直接回看，不再空页重新引导
    if (this._id) {
      const e = (wx.getStorageSync(HISTORY_KEY) || []).find((x) => x.id === this._id)
      if (e) {
        if (!yaoStr) {
          yaoStr = /^[01]{6}$/.test(e.yao || '') ? e.yao : ''
          dongStr = /^[01]{6}$/.test(e.dong || '') ? e.dong : ''
          gzOpt = e.gz || ''
          qiu = (e.qiu || '').slice(0, 30)
        }
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
      aiMeta: ai ? this.metaOf(ai) : ''
    })
    this._args = { yao: yaoStr, dong: dongStr, gz: jz, q: qiu }
    // 进页即自动起问（不设开始按钮）；已存解读只回看不重问——一事一占，也不重复计费
    if (this.data.mode !== '' && !ai) this.onAsk()
  },

  // 摘要行：时间 + 来源（模拟态标「本地合成」，云端/历史留白）
  metaOf(ai) {
    return '问易解读 · ' + fmtTime(ai.at) + (ai.src === 'mock' ? ' · 本地合成（模拟）' : '')
  },

  onAsk() {
    if (!this._args || this.data.loading) return
    if (this.data.mode === 'cloud') this.askCloud()
    else if (this.data.mode === 'mock') this.askMock()
  },

  // 云函数：密钥只在云端环境变量；errCode/缺 text 一律降级本地合成
  askCloud() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'wenyi',
      data: {
        yao: this._args.yao, dong: this._args.dong, gz: this._args.gz, q: this._args.q,
        name: this.data.name,
        bian: this.data.bianKey, bianName: this.data.bianName
      }
    })
      .then((res) => {
        const d = res && res.result
        const text = d && d.text ? String(d.text) : ''
        if (!text) throw new Error((d && d.errCode) || 'NO_TEXT')
        this.done(text, 'cloud')
      })
      .catch((err) => {
        console.error('[问易] 云端不可用，降级本地合成', err)
        wx.showToast({ title: '云端暂不可用，改用本地参考', icon: 'none' })
        this.askMock(true)
      })
  },

  // 本地合成：排盘+经文库规则合成，稍候片刻让等待动画走一圈
  askMock(quick) {
    this.setData({ loading: true })
    setTimeout(() => {
      let text = ''
      try {
        text = synthesizeWenyi(this._args)
      } catch (e) {
        console.error('[问易] 本地合成失败', e)
      }
      if (!text) {
        this.setData({ loading: false })
        wx.showToast({ title: '生成失败，请重试', icon: 'none' })
        return
      }
      this.done(text, 'mock')
    }, quick ? 400 : 900)
  },

  done(text, src) {
    const at = Date.now()
    this.setData({ aiText: text, aiMeta: this.metaOf({ at, src }), loading: false })
    this.saveAiText(text, at, src)   // 解读即时落库，「我的」历史出现「问易」标记
  },

  // AI 解读落库：写回对应历史条目（先按 id，老数据无 id 时按卦参兜底匹配）
  saveAiText(text, at, src) {
    if (!text) return
    const list = wx.getStorageSync(HISTORY_KEY) || []
    const a = this._args || {}
    const e = list.find((x) =>
      (this._id && x.id === this._id) ||
      (x.yao === a.yao && x.dong === a.dong && x.gz === a.gz && (x.qiu || '') === (a.q || '')))
    if (!e) return
    e.ai = { text, at, src }
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
