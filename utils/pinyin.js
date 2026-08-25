// utils/pinyin.js — 原文生僻字注音层
// 原则：知识库（gua.js/zhuan.js）保持原文用字不改；显示时由 annotate() 在
// 生僻字后括注拼音（每字每段只注首次），卦名用 namePinyin() 整名注音。

// 单字注音表（《周易》经传常见生僻/易误读字）
const RARE = {
  '遯': 'dùn', '屯': 'zhūn', '虩': 'xì', '咥': 'dié', '眚': 'shěng',
  '輹': 'fù', '簋': 'guǐ', '褫': 'chǐ', '逋': 'bū', '掇': 'duō',
  '鞶': 'pán', '隍': 'huáng', '盱': 'xū', '撝': 'huī', '邅': 'zhān',
  '皙': 'xī', '蔀': 'bù', '愬': 'sù', '劓': 'yì', '刖': 'yuè',
  '藟': 'lěi', '赍': 'jī', '洟': 'tì', '餗': 'sù', '铉': 'xuàn',
  '遄': 'chuán', '蒺': 'jí', '藜': 'lí', '咷': 'táo', '祗': 'zhī',
  '渫': 'xiè', '甃': 'zhòu', '汔': 'qì', '繘': 'yù', '羸': 'léi',
  '昃': 'zè', '嗃': 'hè', '憧': 'chōng', '脢': 'méi', '柅': 'nǐ',
  '隼': 'sǔn', '藉': 'jiè', '桡': 'ráo', '眇': 'miǎo', '跛': 'bǒ',
  '渎': 'dú', '蹢': 'zhí', '躅': 'zhú',
  '噬': 'shì', '嗑': 'hé', '颐': 'yí', '睽': 'kuí', '蹇': 'jiǎn',
  '夬': 'guài', '姤': 'gòu', '蛊': 'gǔ', '艮': 'gèn', '涣': 'huàn',
  '孚': 'fú', '袂': 'mèi', '衢': 'qú',
  // 序卦/杂卦/文言新增
  '饬': 'chì', '蕃': 'fán', '弑': 'shì', '粹': 'cuì', '诛': 'zhū',
  '睹': 'dǔ', '稚': 'zhì', '亢': 'kàng', '辩': 'biàn', '巿': 'fú'
}

// 卦名整名注音（仅收易误读卦名，常见字不注）
const NAME_PINYIN = {
  '屯': 'zhūn', '小畜': 'xiǎo xù', '大畜': 'dà xù', '比': 'bǐ',
  '否': 'pǐ', '蛊': 'gǔ', '贲': 'bì', '剥': 'bō', '颐': 'yí',
  '观': 'guàn', '遁': 'dùn', '睽': 'kuí', '蹇': 'jiǎn', '夬': 'guài',
  '姤': 'gòu', '萃': 'cuì', '艮': 'gèn', '巽': 'xùn', '涣': 'huàn',
  '噬嗑': 'shì hé', '中孚': 'zhōng fú'
}

// 正文中生僻字首次出现处括注拼音：遯亨 → 遯（dùn）亨
export function annotate(text) {
  if (!text) return text
  let s = String(text)
  for (const ch in RARE) {
    const i = s.indexOf(ch)
    if (i >= 0) s = s.slice(0, i + 1) + '（' + RARE[ch] + '）' + s.slice(i + 1)
  }
  return s
}

// 卦名注音：噬嗑 → 噬嗑（shì hé）；无注音卦名原样返回
export function namePinyin(name) {
  const p = NAME_PINYIN[name]
  return p ? name + '（' + p + '）' : name
}
