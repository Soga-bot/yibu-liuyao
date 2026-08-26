// pages/paigua/paigua.js — 解卦：术语速查 + 起卦入口
import { themeClass, fontClass } from '../../utils/theme.js'

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

// —— 断法概念（进阶速查）：均为通识概念与传统意象，不作吉凶断语 ——

// 月建 · 日辰：爻之旺衰动静的两把标尺
const YUEJIAN = [
  { k: '月建', v: '起卦当月的月支（如寅月、卯月）。传统以月建衡量卦中各爻的强弱，称「月建乃万卜之提纲」。' },
  { k: '日辰', v: '起卦当日的日支。传统称「日辰为六爻之主宰」——日辰能生、克、冲、合卦中之爻，与月建共定各爻旺衰动静。' },
  { k: '旺相休囚', v: '以月建论爻之五行强弱：与月建同行者为旺，月建所生者为相，生月建者为休，克月建者为囚，月建所克者为死。' },
  { k: '月破', v: '被月建所冲之爻称月破（如寅月冲申，申爻即破）。传统视月破之爻当月受制无力，出月之后不复为破。' }
]

// 飞神 · 伏神：用神不上卦时的取用之法
const FEIFU = [
  { k: '伏神', v: '卦中缺少某一六亲（用神不上卦）时，从本宫首卦相同爻位取来的那支，隐于该爻之下备用。' },
  { k: '飞神', v: '伏神所藏爻位之上、卦中现实可见的那一爻。传统再看飞神对伏神的生克关系。' }
]

// 进神 · 退神：动爻化出的顺逆之势
const JINTUI = [
  { k: '进神', v: '动爻化出的地支顺行而进（如寅化卯、巳化午），传统意象为渐进、向前。' },
  { k: '退神', v: '动爻化出的地支逆行而退（如卯化寅、午化巳），传统意象为退缓、回落。' }
]

// 六合 · 六冲：卦的整体合冲格局（卦例均按纳支逐位核对）
const HECHONG = [
  { k: '六冲卦', v: '上下卦对应爻位彼此相冲，共十卦：乾、坤、震、巽、坎、离、艮、兑八纯卦，及天雷无妄、雷天大壮。' },
  { k: '六合卦', v: '上下卦对应爻位彼此相合，共八卦：地天泰、天地否、雷地豫、地雷复、水泽节、泽水困、山火贲、火山旅。' }
]

// 反吟 · 伏吟：卦变前后的吟变之象
const FANYIN = [
  { k: '伏吟', v: '卦变前后纳支相同（如乾变震，两卦纳支全同），或动爻化出之支与本支相同（如寅化寅），传统意象为呻吟反复、忧郁迟滞。' },
  { k: '反吟', v: '变卦纳支与主卦相冲（如坤变巽，六位之支皆冲），或动爻化出之支与本支相冲（如寅化申），传统意象为往返反复、事有转折。' }
]

// 用神两现：同一六亲出现两爻的择取通则
const LIANGXIAN = [
  { k: '用神两现', v: '同一六亲在卦中出现两爻（如两爻皆父母），取用须择其一：舍其旬空月破，取其不空不破；舍其安静，取其发动；临世应、临日辰者优先（《卜筮正宗·用神两现章》）。' }
]

Page({
  data: {
    statusBarHeight: 20,
    themeCls: '',   // 手动主题覆盖类（t-dark/t-light，auto 为空）
    fontCls: '',    // 阅读字号类（fs-big/fs-huge，标准为空）
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
      { id: 'zhushi', title: '空亡 · 世应', rows: ZHUSHI, open: false },
      {
        id: 'yuejian', title: '月建 · 日辰', rows: YUEJIAN, open: false,
        note: '月建、日辰合称「月日」，是纳甲法判断爻之旺衰、动静、冲合的两把标尺。'
      },
      {
        id: 'feifu', title: '飞神 · 伏神', rows: FEIFU, open: false,
        note: '用神不上卦时先寻伏神；「飞来生伏」「伏去生飞」等生克名目，此处仅存概念，不作展开。'
      },
      { id: 'jintui', title: '进神 · 退神', rows: JINTUI, open: false },
      {
        id: 'hechong', title: '六合 · 六冲', rows: HECHONG, open: false,
        note: '传统意象：冲主快而散，合主缓而聚；卦变之后，合冲格局亦随之转化。'
      },
      {
        id: 'fanyin', title: '反吟 · 伏吟', rows: FANYIN, open: false,
        note: '反吟、伏吟皆自动爻变卦中来，无变卦则不论吟。'
      },
      { id: 'liangxian', title: '用神两现', rows: LIANGXIAN, open: false }
    ]
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 })
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.setData({ themeCls: themeClass(), fontCls: fontClass() })
  },

  // 折叠/展开知识组
  toggleGroup(e) {
    const i = +e.currentTarget.dataset.i
    this.setData({ ['groups[' + i + '].open']: !this.data.groups[i].open })
  },

  goShake() {
    wx.navigateTo({
      url: '/package3d/pages/ask/ask',
      fail: (e) => {
        console.error('[解卦页] 进问事签失败', e)
        wx.showToast({ title: '进入失败：' + (e.errMsg || '未知'), icon: 'none' })
      }
    })
  },
  goManual() {
    wx.navigateTo({ url: '/pages/paipan/paipan' })
  },

  onShareAppMessage() {
    return { title: '周易解卦知识 · 六亲六神与用神速查', path: '/pages/paigua/paigua' }
  }
})
