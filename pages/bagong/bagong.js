// pages/bagong/bagong.js — 卦象速查（京房八宫六十四卦）
// 整表不手录：从 data/gua.js 的八个纯卦按京房变卦规则生成，
// 生成结果逐条回查断言（key 能找到卦、宫名相符、上下卦与 nei/wai 相符、
// 全名与文末八宫锚点逐字一致）——规则错或数据错，载入即刻报错。
// 点任一卦可跳典籍库详情页。

import { GUA_LIST, GUA_DATA } from '../../data/gua.js'
import { themeClass, fontClass } from '../../utils/theme.js'

// 八宫（先天数序，同八卦基础页）：纯卦名 + 宫阴阳（说卦十男阳女阴）+ 宫五行
const PALACES = [
  { gong: '乾', yy: '阳', wx: '金' },
  { gong: '兑', yy: '阴', wx: '金' },
  { gong: '离', yy: '阴', wx: '火' },
  { gong: '震', yy: '阳', wx: '木' },
  { gong: '巽', yy: '阴', wx: '木' },
  { gong: '坎', yy: '阳', wx: '水' },
  { gong: '艮', yy: '阳', wx: '土' },
  { gong: '坤', yy: '阴', wx: '土' }
]

// 京房变卦：自本宫起依次变初、二、三、四、五爻；游魂四爻复，归魂下卦复（只变五爻）。
// flip 为所变爻位（0=初爻，自下而上）；红标即这些爻。
const SHIHUN = [
  { tag: '本宫', flip: '' },
  { tag: '一世', flip: '0' },
  { tag: '二世', flip: '01' },
  { tag: '三世', flip: '012' },
  { tag: '四世', flip: '0123' },
  { tag: '五世', flip: '01234' },
  { tag: '游魂', flip: '0124' },
  { tag: '归魂', flip: '4' }
]

// 三爻（下→上）→ [卦名, 自然象]：全名「天风姤」「乾为天」由此拼出
const TRI = {
  '111': ['乾', '天'], '110': ['兑', '泽'], '101': ['离', '火'], '100': ['震', '雷'],
  '011': ['巽', '风'], '010': ['坎', '水'], '001': ['艮', '山'], '000': ['坤', '地']
}

const byName = {}
GUA_LIST.forEach((g) => { byName[g.name] = g })

const GROUPS = PALACES.map((p) => {
  const pure = byName[p.gong]                       // 纯卦：卦名即宫名
  if (!pure) throw new Error('八宫找不到纯卦：' + p.gong)
  const cells = SHIHUN.map((s) => {
    const bits = pure.key.split('')
    ;[...s.flip].forEach((i) => { bits[+i] = bits[+i] === '1' ? '0' : '1' })
    const key = bits.join('')
    const g = GUA_DATA[key]
    if (!g) throw new Error(p.gong + '宫' + s.tag + '变出的卦不在六十四卦中：' + key)
    if (g.gong !== p.gong) throw new Error(p.gong + '宫' + s.tag + '宫名不符：得 ' + g.gong)
    const xia = TRI[key.slice(0, 3)]
    const shang = TRI[key.slice(3)]
    if (!xia || !shang) throw new Error('上下卦解析失败：' + key)
    if (xia[0] !== g.nei || shang[0] !== g.wai) {
      throw new Error(p.gong + '宫' + s.tag + '上下卦与卦数据不符：' + xia[0] + '/' + shang[0])
    }
    const full = key.slice(0, 3) === key.slice(3) ? g.name + '为' + shang[1] : shang[1] + xia[1] + g.name
    return {
      key,
      tag: s.tag,
      full,
      // lines 上→下渲染；chg 标相对本宫的变爻（红）
      lines: key.split('').reverse().map((b, i) => ({
        v: +b,
        chg: s.flip.includes(String(5 - i))
      }))
    }
  })
  return { gong: p.gong, yy: p.yy, wx: p.wx, cells }
})

// 八宫全序锚点（通行八宫表逐宫逐字核对；gua 卦名用「遁」字，与库一致）
const ANCHORS = {
  乾: ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'],
  兑: ['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹'],
  离: ['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人'],
  震: ['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随'],
  巽: ['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊'],
  坎: ['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师'],
  艮: ['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐'],
  坤: ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比']
}
;(function assertGong () {
  if (GROUPS.length !== 8) throw new Error('八宫数不对')
  for (const gp of GROUPS) {
    const want = ANCHORS[gp.gong]
    const got = gp.cells.map((c) => c.full)
    if (!want || want.length !== 8 || got.length !== 8) throw new Error('宫内卦数不对：' + gp.gong)
    want.forEach((w, i) => {
      if (w !== got[i]) throw new Error(gp.gong + '宫第' + (i + 1) + '卦不符：应为 ' + w + '，得 ' + got[i])
    })
  }
  const all = GROUPS.flatMap((gp) => gp.cells.map((c) => c.key))
  if (new Set(all).size !== 64) throw new Error('八宫合计非 64 卦（有重复或缺失）')
})()

Page({
  data: {
    statusBarHeight: 20,
    groups: GROUPS
  },

  onLoad() {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20, themeCls: themeClass(), fontCls: fontClass() })
  },

  onCell(e) {
    wx.navigateTo({
      url: '/pages/dianji/detail?key=' + e.currentTarget.dataset.key,
      fail: (err) => {
        console.error('[卦象速查] 进详情失败', err)
        wx.showToast({ title: '进入失败：' + (err.errMsg || '未知'), icon: 'none' })
      }
    })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  onShareAppMessage() {
    return { title: '卦象速查 · 京房八宫六十四卦表', path: '/pages/bagong/bagong' }
  },
  onShareTimeline() {
    return { title: '卦象速查 · 京房八宫六十四卦表' }
  }
})
