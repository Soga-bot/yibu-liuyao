// package3d/utils/wenyi-mock.js — 问易·本地经文合成器（模拟态）
// 随问易页居分包；排盘引擎与卦库留主包（主包页面亦用，分包引主包属正当依赖）。
//
// 纯函数、零随机、零网络：输入卦参，用排盘引擎 + 64 卦经文库在端上合成
// 一篇「本变合参」参考文（结构与红线同 docs/问易解读规格.md）。
// 用途：① 问易模拟态（WENYI_MODE='mock'）让生成→落库→回看全管线可体验；
//       ② 云函数故障时的离线降级；
//       ③ 断法口径先在此形式化，云端提示词（cloudfunctions/wenyi/prompt.js）
//          与本文件保持同一口径。
// 措辞红线：自撰文字只用「示／居／临／在／指向／传统读法认为」等分析性措辞，
// 不下吉凶断语、不给趋避指令；引文内的吉凶字样属古籍原文，不在此限。

import { paipan, ganZhiToIdx, hexagramFromKey, wuxingRelation, GONG_WUXING, ZHI_WUXING, DI_ZHI } from '../../utils/liuyao.js'
import { GUA_DATA } from '../../data/gua.js'

const POS_CN = ['初', '二', '三', '四', '五', '上']
const QIN_ORDER = ['父母', '兄弟', '子孙', '妻财', '官鬼']

// 关系 → 六亲（与 liuyao.js 内部表同构；变爻六亲按传统以本卦宫五行推）
const REL_QIN = { '比和': '兄弟', '我生': '子孙', '生我': '父母', '我克': '妻财', '克我': '官鬼' }

// —— 用神速选关键词（类目口径同 pages/paigua/paigua.js 的 YONGSHEN 组，
//    在各类目下扩同义词；页文件是 Page 模块不可 import，此处维持一份词表）——
const YONGSHEN_WORDS = [
  { qin: '父母', words: ['长辈', '老人', '父亲', '母亲', '爸妈', '文书', '合同', '证件', '房产', '房屋', '车子', '消息', '考试', '升学', '论文'] },
  { qin: '妻财', words: ['财运', '钱财', '资金', '收入', '工资', '生意', '买卖', '求财'] },
  { qin: '官鬼', words: ['事业', '工作', '求职', '升迁', '官职', '功名', '丈夫', '男友', '入职'] },
  { qin: '子孙', words: ['子女', '孩子', '健康', '身体', '平安', '出行', '旅途', '医药', '宠物'] },
  { qin: '兄弟', words: ['朋友', '兄弟', '姐妹', '同辈', '同事', '竞争', '合伙', '比赛'] }
]

// 按所问词面取用神：命中即返（速选通则，先到先得）
export function pickYongshen(q) {
  const s = (q || '').trim()
  if (!s) return null
  for (const g of YONGSHEN_WORDS) {
    for (const w of g.words) {
      if (s.indexOf(w) >= 0) return { qin: g.qin, hit: w }
    }
  }
  return null
}

// —— 敏感所问（只提示线下专业渠道，仍照常解卦）——
const SENSITIVE_WORDS = [
  { type: 'health', label: '健康', words: ['病', '医', '药', '手术', '身体', '健康', '体检', '孕', '产'] },
  { type: 'legal', label: '法律', words: ['官司', '诉讼', '仲裁', '判决', '律师'] },
  { type: 'finance', label: '财务', words: ['投资', '股票', '基金', '理财', '期货', '汇率'] }
]

export function isSensitive(q) {
  const s = (q || '').trim()
  if (!s) return null
  for (const g of SENSITIVE_WORDS) {
    for (const w of g.words) {
      if (s.indexOf(w) >= 0) return { type: g.type, label: g.label, hit: w }
    }
  }
  return null
}

// 所问回显前清洗：去引号与换行，避免用户文本截断合成文的段落结构
function cleanQ(q) {
  return (q || '').slice(0, 30).replace(/[「」『』\n\r\t]/g, '').trim()
}

function tiOf(gua, pos) {
  const y = (gua.yaoci || [])[pos - 1] || {}
  return { ti: y.ti || (POS_CN[pos - 1] + '爻'), ci: (y.ci || '').trim() }
}

// 世应五行的生克表述（事实性：谁生谁、谁克谁，不下吉凶）
function shiYingWuxing(r) {
  const shiL = r.lines[r.shi - 1]
  const yingL = r.lines[r.ying - 1]
  const rel = wuxingRelation(shiL.wuxing, yingL.wuxing)
  const txt = {
    '比和': '彼此比和',
    '我生': '世爻生应爻',
    '生我': '应爻生世爻',
    '我克': '世爻克应爻',
    '克我': '应爻克世爻'
  }[rel] || '彼此比和'
  return '就五行观之，世爻之' + shiL.wuxing + '与应爻之' + yingL.wuxing + '，为' + txt + '之象。'
}

// 六亲布局普查（规格第三节「宫与六亲布局」的机器化）：谁临何爻、谁不上卦
function liuqinCensus(r) {
  const by = {}
  for (const l of r.lines) {
    (by[l.liuqin] = by[l.liuqin] || []).push(POS_CN[l.pos - 1])
  }
  const present = []
  const absent = []
  for (const qin of QIN_ORDER) {
    if (by[qin]) present.push(qin + '临' + by[qin].join('、') + '爻')
    else absent.push(qin)
  }
  let s = '六亲之布：' + present.join('；')
  if (absent.length) s += '；不上卦者：' + absent.join('、')
  return s + '。'
}

// —— 第一段：本卦现状 ——
function paraBen(r, gua, qq) {
  const shiL = r.lines[r.shi - 1]
  const yingL = r.lines[r.ying - 1]
  // desc 后半若已含于大象，则不重复引大象（如坤「厚德载物」与「地势坤…」重出）
  const descTail = (gua.desc.split('，')[1] || '').trim()
  const dupDaxiang = gua.daxiang && descTail && gua.daxiang.indexOf(descTail) >= 0
  let s = '【本卦】起得' + r.name + '卦（' + gua.desc + '）。' +
    '上卦为' + r.wai + '（' + gua.waiXiang + '），下卦为' + r.nei + '（' + gua.neiXiang + '）' +
    (gua.daxiang && !dupDaxiang ? '，大象曰「' + gua.daxiang + '」' : '') + '。' +
    '卦宫为' + r.gong + '，五行属' + r.gongWuxing + '：世居' + POS_CN[r.shi - 1] + '爻，' +
    shiL.liuqin + '持世（' + shiL.zhi + '，' + shiL.wuxing + '）；' +
    '应在' + POS_CN[r.ying - 1] + '爻，' + yingL.liuqin + '临应（' + yingL.zhi + '，' + yingL.wuxing + '）。' +
    shiYingWuxing(r) +
    '日辰' + r.dayGan + r.dayZhi + '（' + ZHI_WUXING[r.dayZhi] + '）' +
    (r.kongWang.length ? '，旬空' + r.kongWang.join('、') : '') + '。' +
    liuqinCensus(r)
  // 用神句（有具体所问才取用）
  const y = pickYongshen(qq)
  if (y) {
    const hits = r.lines.filter((l) => l.liuqin === y.qin)
    if (!hits.length) {
      s += '按所问取' + y.qin + '为用神；卦中不见' + y.qin + '，传统读法再于本宫首卦寻伏神参看。'
    } else if (hits.length >= 2) {
      s += '按所问取' + y.qin + '为用神；' + y.qin + '两现（' +
        hits.map((h) => POS_CN[h.pos - 1] + '爻').join('、') +
        '），传统舍其空破、取其动静分明者。'
    } else {
      const h = hits[0]
      const pos = h.isShi ? '持世' : h.isYing ? '临应' : '居' + POS_CN[h.pos - 1] + '爻'
      let tail = ''
      if (h.kong) tail = '，正值旬空，传统视此事悬而未定、力量未聚，待出空之时或有变化'
      else if (h.dong) tail = '，且发动在卦，为用神自动之象'
      s += '按所问取' + y.qin + '为用神；' + y.qin + '临' + h.zhi + '（' + h.wuxing + '）' + pos + tail + '。'
    }
  }
  return s
}

// —— 第二段：动爻之几（静卦则作卦爻参读）——
// rB：变卦的排盘（变爻纳支/六亲查表用；变爻六亲按传统以本卦宫五行推）
function paraDong(r, gua, rB) {
  const dongs = r.lines.filter((l) => l.dong)
  if (!dongs.length) {
    const shiL = r.lines[r.shi - 1]
    const yingL = r.lines[r.ying - 1]
    return '【卦爻参读】六爻安静，无动爻，传统以卦辞与世应为主参读。' +
      '卦辞曰「' + gua.guaci + '」' +
      (gua.daxiang ? '大象曰「' + gua.daxiang + '」。' : '。') +
      '内卦' + r.nei + '（' + gua.neiXiang + '）主内事之基，外卦' + r.wai + '（' + gua.waiXiang + '）主外境之应。' +
      '世居' + POS_CN[r.shi - 1] + '爻，' + shiL.liuqin + '（' + shiL.zhi + '，' + shiL.wuxing + '）持世' +
      (shiL.kong ? '，世爻值旬空，自处之力未聚' : '') +
      '；应居' + POS_CN[r.ying - 1] + '爻，' + yingL.liuqin + '（' + yingL.zhi + '，' + yingL.wuxing + '）与世相望。' +
      '世应相隔两位，一为自处、一为所对。' +
      '卦辞陈其大体，世应定其人我，此静卦之通读也。卦以静成，其观也以渐。'
  }
  // 动爻多则句子收短，控制整篇长度
  const tier = dongs.length >= 5 ? 2 : dongs.length >= 3 ? 1 : 0
  const parts = dongs.map((l) => {
    const y = tiOf(gua, l.pos)
    if (tier === 2) return y.ti + '动：「' + (y.ci || '爻辞阙') + '」。'
    if (tier === 1) {
      let s = y.ti + '发动：「' + (y.ci || '爻辞阙') + '」——为' + l.liuqin + '临' + l.zhi + '之爻'
      if (l.isShi) s += '、持世'
      if (l.kong) s += '、值旬空'
      return s + '，亦动象之枢机。'
    }
    let s = y.ti + '发动，爻辞曰「' + (y.ci || '爻辞阙') + '」——此爻为' + l.liuqin + '、临' +
      l.zhi + '（' + l.wuxing + '）、上配' + l.liushen
    if (l.isShi) s += '、持世'
    else if (l.isYing) s += '、居应位'
    if (l.kong) s += '、值旬空'
    // 动而化出：变爻纳支（进神/退神口径同 paigua 速查「进神·退神」组）
    if (rB) {
      const l2 = rB.lines[l.pos - 1]
      const qin2 = REL_QIN[wuxingRelation(r.gongWuxing, l2.wuxing)]
      s += '，动而化' + l2.zhi + '（' + qin2 + '）'
      const z1 = DI_ZHI.indexOf(l.zhi), z2 = DI_ZHI.indexOf(l2.zhi)
      if ((z1 + 1) % 12 === z2) s += '，属进神之象'
      else if ((z1 + 11) % 12 === z2) s += '，属退神之象'
    }
    return s + '，是当下事态变化之枢机。'
  })
  let s = '【动爻】' + parts.join('')
  if (dongs.length === 1) {
    s += '一爻独发，事有所专。'
  } else if (dongs.length > 1) {
    const top = dongs[dongs.length - 1]
    s += dongs.length + '爻齐动，传统读法以' + tiOf(gua, top.pos).ti +
      '为先' + (dongs.some((l) => l.isShi) ? '，兼看世爻自动之应' : '') + '。'
  }
  return s
}

// —— 第三段：变卦趋向 ——
function paraBian(r, gua, bgua) {
  if (!bgua) return ''
  const bhex = hexagramFromKey(bgua.key)
  const firstSentence = (bgua.guaci.split('。')[0] || bgua.guaci) + '。'
  // 内外卦之象孰变（乾之姤＝上卦变；复之坤＝上下皆变）
  const changes = []
  if (bhex.nei !== r.nei) changes.push('内卦之象由' + r.nei + '而易为' + bhex.nei)
  if (bhex.wai !== r.wai) changes.push('外卦之象由' + r.wai + '而易为' + bhex.wai)
  return '【变卦】动而之' + bgua.name + '（' + bgua.desc + '）' +
    (bgua.daxiang ? '，大象曰「' + bgua.daxiang + '」' : '') +
    '，卦宫' + bhex.gong + '属' + GONG_WUXING[bhex.gong] + '。' +
    (changes.length ? '相较本卦，' + changes.join('，') + '。' : '') +
    '由' + r.name + '「' + gua.desc + '」之局，渐转' + bgua.name + '「' + bgua.desc + '」之向；' +
    '变卦卦辞起句「' + firstSentence + '」可为趋向之参照。'
}

// —— 第四段：合参所问 ——
function paraHe(r, gua, bgua, qq) {
  const dongs = r.lines.filter((l) => l.dong)
  let body = ''
  const sens = isSensitive(qq)
  if (sens) body += '所问之事涉' + sens.label + '领域，请以线下专业机构意见为准；'
  if (qq) body += '就所问「' + qq + '」合观：'
  else body += '就卦论卦，不系具体所问：'
  body += r.name + '示当下之格局'
  if (dongs.length === 1) body += '，' + tiOf(gua, dongs[0].pos).ti + '之动为枢机'
  else if (dongs.length > 1) body += '，' + dongs.length + '爻之动为枢机'
  if (bgua) body += '，' + bgua.name + '指其后之趋向'
  body += '，合而参之，以事态分析为限，供传统文化研读参照。' +
    (dongs.length ? '' : '静卦无变，本卦之格局即始终之局；动未见其几，变未形其向，读辞观象，以俟其渐。') +
    '卦爻之辞皆古人取象之喻，参玩文义而已。'
  return '【合参】' + body
}

// 主入口：{ yao, dong, gz, q } → 四段（静卦三段）纯文本，段间 \n\n
export function synthesizeWenyi({ yao, dong, gz, q }) {
  if (!/^[01]{6}$/.test(yao || '') || !/^[01]{6}$/.test(dong || '')) {
    throw new Error('mock: 卦参格式有误')
  }
  if (ganZhiToIdx((gz || '')[0], (gz || '')[1]) < 0) {
    throw new Error('mock: 日干支有误')
  }
  const qq = cleanQ(q)
  const yaoArr = yao.split('').map((b, i) => ({ yin: b === '0', dong: dong[i] === '1' }))
  const r = paipan({ yao: yaoArr, dayGan: gz[0], dayZhi: gz[1] })
  const gua = GUA_DATA[yao]
  if (!gua) throw new Error('mock: 卦库缺卦')
  const bgua = r.bian ? GUA_DATA[r.bian.key] : null
  const rB = r.bian
    ? paipan({ yao: r.bian.key.split('').map((b) => ({ yin: b === '0', dong: false })), dayGan: r.dayGan, dayZhi: r.dayZhi })
    : null

  const paras = [paraBen(r, gua, qq), paraDong(r, gua, rB)]
  if (bgua) paras.push(paraBian(r, gua, bgua))
  paras.push(paraHe(r, gua, bgua, qq))
  return paras.join('\n\n')
}

export default { pickYongshen, isSensitive, synthesizeWenyi }
