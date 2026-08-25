// pages/wuxing/wuxing.js — 五行基础（通识学习页，静态内容）
// 解卦 tab 的六亲/六神是「用」，本页是「体」：生克、干支归属、旬空的来龙去脉。
// 内容皆为传统通识，写死在此，不依赖网络与知识库。

// ---------- 生克图几何（rpx）：五行五角排布，外圈实线相生、内圈虚线相克 ----------
const CX = 240, CY = 250, R = 175          // 画布中心与半径
const NODES = [
  { w: '木', deg: 0 },                     // 顶点起顺时针：木火土金水
  { w: '火', deg: 72 },
  { w: '土', deg: 144 },
  { w: '金', deg: 216 },
  { w: '水', deg: 288 }
]

function pos(deg, scale) {
  // deg：自正上方顺时针角度；scale：距中心缩放（1=贴节点圆心，0.7=内缩画相克星）
  const rad = deg * Math.PI / 180
  return {
    x: CX + R * scale * Math.sin(rad),
    y: CY - R * scale * Math.cos(rad)
  }
}

function line(p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y
  return {
    l: Math.round(p1.x),
    t: Math.round(p1.y),
    w: Math.round(Math.sqrt(dx * dx + dy * dy)),
    r: Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
  }
}

// 相生：相邻相接（木→火→土→金→水→木）；相克：隔位相划，端点内缩成五角星
const SHENG = [0, 1, 2, 3, 4].map((i) => line(pos(NODES[i].deg, 1), pos(NODES[(i + 1) % 5].deg, 1)))
const KE = [
  [0, 2], [2, 4], [4, 1], [1, 3], [3, 0]   // 木克土、土克水、水克火、火克金、金克木
].map(([a, b]) => line(pos(NODES[a].deg, 0.7), pos(NODES[b].deg, 0.7)))

const NODE_POS = NODES.map((n) => ({ ...n, ...pos(n.deg, 1) }))

// ---------- 通识表 ----------
const SHENG_ROWS = [
  { k: '木生火', v: '木性暖而生火，火焚木而愈旺' },
  { k: '火生土', v: '火焚成灰，灰归于土' },
  { k: '土生金', v: '金藏于矿，孕育于土' },
  { k: '金生水', v: '金凝露而润，销镐为液' },
  { k: '水生木', v: '雨露滋润，草木方生' }
]
const KE_ROWS = [
  { k: '木克土', v: '草木生根，破土而据' },
  { k: '土克水', v: '土堤防水，水来土掩' },
  { k: '水克火', v: '水能灭火' },
  { k: '火克金', v: '烈火熔金' },
  { k: '金克木', v: '金刃伐木' }
]
// 五行归类（方位/季节/五色/五味，传统通识配属）
const GUILEI_HEAD = ['五行', '方位', '季节', '五色', '五味']
const GUILEI_ROWS = [
  ['木', '东', '春', '青', '酸'],
  ['火', '南', '夏', '赤', '苦'],
  ['土', '中', '长夏', '黄', '甘'],
  ['金', '西', '秋', '白', '辛'],
  ['水', '北', '冬', '黑', '咸']
]
const GAN_ROWS = [
  { k: '甲 · 乙', v: '属木（甲为阳木，乙为阴木）' },
  { k: '丙 · 丁', v: '属火（丙为阳火，丁为阴火）' },
  { k: '戊 · 己', v: '属土（戊为阳土，己为阴土）' },
  { k: '庚 · 辛', v: '属金（庚为阳金，辛为阴金）' },
  { k: '壬 · 癸', v: '属水（壬为阳水，癸为阴水）' }
]
const ZHI_ROWS = [
  { k: '寅 · 卯', v: '属木（虎 · 兔）' },
  { k: '巳 · 午', v: '属火（蛇 · 马）' },
  { k: '申 · 酉', v: '属金（猴 · 鸡）' },
  { k: '亥 · 子', v: '属水（猪 · 鼠）' },
  { k: '辰 戌 丑 未', v: '属土（龙 狗 牛 羊，又称四库土）' }
]
// 旬空表：六十甲子每旬十日，旬内缺的两支即「空亡」——排盘页所标空亡由此来
const XUN_ROWS = [
  { k: '甲子旬', v: '戌亥空' },
  { k: '甲戌旬', v: '申酉空' },
  { k: '甲申旬', v: '午未空' },
  { k: '甲午旬', v: '辰巳空' },
  { k: '甲辰旬', v: '寅卯空' },
  { k: '甲寅旬', v: '子丑空' }
]

Page({
  data: {
    statusBarHeight: 20,
    nodes: NODE_POS,
    shengLines: SHENG,
    keLines: KE,
    shengRows: SHENG_ROWS,
    keRows: KE_ROWS,
    guileiHead: GUILEI_HEAD,
    guileiRows: GUILEI_ROWS,
    ganRows: GAN_ROWS,
    zhiRows: ZHI_ROWS,
    xunRows: XUN_ROWS
  },

  onLoad() {
    const app = getApp()
    this.setData({ statusBarHeight: (app && app.globalData.statusBarHeight) || 20 })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
