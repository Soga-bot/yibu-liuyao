// package3d/pages/result/result.js — 摇卦结果页（3D 摇卦闭环终点）
// 与手动排盘(pages/paipan)同引擎同观感，但两页独立：本页只读展示摇出的卦，
// 无录入六爻/改阴阳/换日干支等任何编辑交互——「摇出来的卦」≠「手动排的盘」。
// 入参：yao/dong（6 位 0|1，初→上）、q（所问，随历史落库）；缺参显示空态。
import { paipan, dateToGanZhi, TIAN_GAN, DI_ZHI } from '../../../utils/liuyao.js'
import { GUA_DATA } from '../../../data/gua.js'
import { getZhuan } from '../../../data/zhuan.js'
import { getBaihua } from '../../../data/baihua.js'
import { annotate, namePinyin } from '../../../utils/pinyin.js'
import { makeShareCard } from '../../../utils/sharecard.js'
import { themeClass, fontClass } from '../../../utils/theme.js'

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
  let eff = entry
  const top = list[0]
  if (top && top.yao === entry.yao && top.dong === entry.dong && top.gz === entry.gz &&
      (top.qiu || '') === (entry.qiu || '')) {
    top.t = entry.t
    eff = top                     // 合并进旧条目：id 沿用旧的（问易解读挂靠不换目标）
  } else {
    list.unshift(entry)
  }
  if (list.length > HISTORY_MAX) list.length = HISTORY_MAX
  wx.setStorageSync(HISTORY_KEY, list)
  return eff
}

Page({
  data: {
    statusBarHeight: 20,
    qiu: '',
    gz: '',
    replay: false,      // 回放态（历史回看 / 好友分享）：不落库
    replayLabel: '三钱摇卦',
    wenyiDone: false,   // 该卦已有问易解读 → 主按钮改「回看」态（直达已存文字）
    result: null,
    rows: null    // 排盘显示行（上→初）
  },

  onLoad(options) {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20 })
    // from=history：历史回看；from=share：好友分享进入。皆为回放态（不重复落库，起卦行改标）
    const fromHist = !!(options && (options.from === 'history' || options.from === 'share'))
    const replayLabel = options && options.from === 'share' ? '好友分享'
      : (options && options.from === 'history' ? '历史回看' : '三钱摇卦')
    this._histId = (options && options.id) || ''
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
    const zh = getZhuan(yaoStr) || {}
    const bh = getBaihua(yaoStr) || {}
    // 显示行：上→初（倒序）；爻题/爻辞查知识库；小象逐爻、白话试点卦才有
    const rows = r.lines.slice().reverse().map((l) => ({
      posName: POS_NAMES[l.pos - 1],
      ti: kb.yaoci ? kb.yaoci[l.pos - 1].ti : '',
      ci: kb.yaoci ? annotate(kb.yaoci[l.pos - 1].ci || '') : '',
      xiao: zh.xiao ? annotate(zh.xiao[l.pos - 1] || '') : '',
      ciB: bh.yaoci ? (bh.yaoci[l.pos - 1] || '') : '',
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
    // 有动爻：变卦并排展示用视图模型（名/宫/五行 + 卦象爻 + 古文讲解）
    let bian = null
    if (yao.some((l) => l.dong)) {
      const bianKey = yao.map((l) => (l.dong ? (l.yin ? '1' : '0') : (l.yin ? '0' : '1'))).join('')
      const kb2 = GUA_DATA[bianKey] || {}
      const zh2 = getZhuan(bianKey) || {}
      const bh2 = getBaihua(bianKey) || {}
      const r2 = paipan({
        yao: bianKey.split('').map((b) => ({ yin: b === '0', dong: false })),
        dayGan: jz[0], dayZhi: jz[1]
      })
      bian = {
        name: r2.name,
        nameP: namePinyin(r2.name),
        gong: r2.gong,
        gongWuxing: r2.gongWuxing,
        desc: kb2.desc || '',
        daxiang: annotate(kb2.daxiang || ''),
        guaci: annotate(kb2.guaci || ''),
        guaciB: bh2.guaci || '',
        tuan: zh2.tuan ? annotate(zh2.tuan) : '',
        yao: bianKey.split('').map((b) => ({ yin: b === '0' })).reverse()   // 上→初
      }
    }
    this.setData({
      qiu,
      gz: jz,
      replay: fromHist,
      replayLabel,
      result: Object.assign(r, {
        desc: kb.desc || '',
        daxiang: annotate(kb.daxiang || ''),
        guaci: annotate(kb.guaci || ''),
        guaciB: bh.guaci || '',
        tuan: zh.tuan ? annotate(zh.tuan) : '',
        nameP: namePinyin(r.name)
      }),
      ben: { yao: rows.map((w) => ({ yin: w.yin, dong: w.dong })) },   // 上→初
      bian,
      rows
    })
    // 问易入口带参用（与 result 同参：yao/dong/gz/q）
    this._args = { yao: yaoStr, dong: dongStr, gz: jz, q: qiu }
    // 分享卡（宣纸风卦象卡）：全称沿用传统「上象+下象+卦名」，八纯作「X为Y」
    this._full = kb.waiXiang === kb.neiXiang
      ? r.name + '为' + kb.waiXiang
      : kb.waiXiang + kb.neiXiang + r.name
    makeShareCard(this, {
      name: r.name,
      full: this._full,
      xiang: yaoStr.split('').reverse().map((b) => +b),   // 上→下
      dong: dongStr.split('').reverse().map((b) => +b),
      line: bh.guaci || kb.desc || ''
    })
    // 落摇卦历史（与手动排盘同库：mine 页统一渲染）；历史回看跳过
    if (!fromHist) {
      const eff = saveHistory({
        id: String(Date.now()),   // 唯一标识：问易解读等回写挂靠（与 paipan.js 同格式）
        t: Date.now(),
        yao: yaoStr,
        dong: dongStr,
        gz: jz,
        name: r.name,
        qiu
      })
      if (eff && eff.id) this._histId = eff.id
    }
    this._refreshWenyiBtn()
  },

  onShow() {
    // 手动主题/字号类刷新 + 从问易页返回时按钮切「回看」态
    this.setData({ themeCls: themeClass(), fontCls: fontClass() })
    this._refreshWenyiBtn()
  },

  // 主按钮分态：挂靠的历史条目已有问易解读（含去重合并进旧条目的情形）→「回看」
  _refreshWenyiBtn() {
    if (!this._histId) return
    const e = (wx.getStorageSync(HISTORY_KEY) || []).find((x) => x.id === this._histId)
    this.setData({ wenyiDone: !!(e && e.ai && e.ai.text) })
  },

  // 点爻行展开/收起爻辞（只读页里唯一交互：查原文，非编辑）
  toggleCi(e) {
    const i = +e.currentTarget.dataset.i
    this.setData({ ['rows[' + i + '].showCi']: !this.data.rows[i].showCi })
  },

  // 问易（AI 解卦）：带同一卦参数进解读页（AI 经自有服务器中转，密钥不下发端上）
  goWenyi() {
    const a = this._args
    if (!a || !a.yao) {
      wx.showToast({ title: '未取得卦象', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/package3d/pages/wenyi/wenyi?yao=' + a.yao + '&dong=' + a.dong +
           '&gz=' + a.gz + '&q=' + encodeURIComponent(a.q || '') +
           '&id=' + (this._histId || ''),
      fail: (e) => {
        console.error('[结果页] 进问易失败', e)
        wx.showToast({ title: '进入失败：' + (e.errMsg || '未知'), icon: 'none' })
      }
    })
  },

  // 重新起卦：回问事签重新默祷（新的一卦）
  goAsk() {
    wx.redirectTo({ url: '/package3d/pages/ask/ask', fail: () => {} })
  },
  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  // 转发：对方从分享进入即回放态（from=share，不落其历史）；标题不带所问之事（隐私）
  onShareAppMessage() {
    const a = this._args
    if (!a || !a.yao) {
      return { title: '易卜六爻 · 《周易》卦象典籍与排盘演示', path: '/pages/index/index' }
    }
    let path = '/package3d/pages/result/result?yao=' + a.yao + '&dong=' + a.dong + '&gz=' + a.gz + '&from=share'
    if (a.q) path += '&q=' + encodeURIComponent(a.q)
    const msg = { title: '《周易》· ' + (this._full || ''), path }
    if (this._shareImg) msg.imageUrl = this._shareImg
    return msg
  }
})
