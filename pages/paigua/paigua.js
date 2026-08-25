// pages/paigua/paigua.js — 解卦：术语速查 + 起卦入口
const app = getApp()

// 六亲（各爻地支五行与卦宫五行的生克关系）：含义 + 传统所主的人事
const LIUQIN = [
  { k: '父母', v: '生我者。主长辈、父母、师长，亦主文书、合同、证件、房屋、车船、消息。' },
  { k: '兄弟', v: '比和者（与卦宫五行相同）。主兄弟、朋友、同辈、竞争者，亦主阻隔、破耗。' },
  { k: '子孙', v: '我生者。主子女、晚辈、学生、下属，亦主福德、医药、解忧。' },
  { k: '妻财', v: '我克者。主妻子、财物、买卖、饮食。' },
  { k: '官鬼', v: '克我者。主丈夫、官职、工作、功名，亦主疾病、忧疑。' }
]

// 六神（按日干起于初爻，逐爻上行：甲乙青龙、丙丁朱雀、戊勾陈、己螣蛇、庚辛白虎、壬癸玄武）
const LIUSHEN = [
  { k: '青龙', v: '传统寓意喜庆、酒宴、生气、新事。' },
  { k: '朱雀', v: '传统寓意口舌、是非、文书、言语。' },
  { k: '勾陈', v: '传统寓意田土、迟滞、牵连、旧事。' },
  { k: '螣蛇', v: '传统寓意怪异、惊恐、纠缠、梦寐。' },
  { k: '白虎', v: '传统寓意凶险、血光、疾病、丧事。' },
  { k: '玄武', v: '传统寓意盗贼、暗昧、欺骗、阴私。' }
]

// 用神速选：问何事取何爻（入门通则）
const YONGSHEN = [
  { k: '问长辈 · 文书 · 房产', v: '取父母爻' },
  { k: '问财运 · 买卖 · 男占婚', v: '取妻财爻' },
  { k: '问事业 · 官职 · 女占婚', v: '取官鬼爻' },
  { k: '问子女 · 健康 · 出行平安', v: '取子孙爻' },
  { k: '问朋友 · 同辈 · 竞争', v: '取兄弟爻' }
]

// 空亡 · 世应
const ZHUSHI = [
  { k: '世爻', v: '代表求测人自身，即排盘中标「世」的爻位。' },
  { k: '应爻', v: '代表对方与所问之事，与世爻相隔两位，即标「应」的爻位。' },
  { k: '空亡', v: '旬内所缺的两支。爻临空亡，传统视为此事悬而未定、力量未聚，待出空之时或有变化。排盘中以红字「空」标出。' }
]

Page({
  data: {
    statusBarHeight: 20,
    groups: [
      {
        id: 'liuqin', title: '六亲', rows: LIUQIN, open: true,
        note: '六亲由各爻地支五行与卦宫五行的生克关系定：生我父母、我生子孙、克我官鬼、我克妻财、比和兄弟。'
      },
      {
        id: 'liushen', title: '六神', rows: LIUSHEN, open: false,
        note: '起法：甲乙日初爻起青龙，丙丁起朱雀，戊日勾陈，己日螣蛇，庚辛白虎，壬癸玄武；此后逐爻依次上行。'
      },
      { id: 'yongshen', title: '用神选取', rows: YONGSHEN, open: false },
      { id: 'zhushi', title: '空亡 · 世应', rows: ZHUSHI, open: false }
    ]
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 })
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  // 折叠/展开知识组
  toggleGroup(e) {
    const i = +e.currentTarget.dataset.i
    this.setData({ ['groups[' + i + '].open']: !this.data.groups[i].open })
  },

  goShake() {
    wx.navigateTo({ url: '/package3d/pages/ask/ask' })
  },
  goManual() {
    wx.navigateTo({ url: '/pages/paipan/paipan' })
  }
})
