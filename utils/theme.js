// utils/theme.js — 深色模式三态 + 阅读正文字号（设置页管理，storage 持久化）
// 深色三态：auto 跟随系统（默认）/ light 手动浅 / dark 手动深。
// 原理：变量默认定义在 page{} 与 @media dark（= 跟随系统）；手动指定时
// 页面根包装 view 挂 .t-light / .t-dark 类（app.wxss）覆盖子树继承值。
// divination 3D 页例外：不挂类，整页钉死浅色。
const THEME_KEY = 'ly_theme'   // 'auto' | 'light' | 'dark'，缺省 auto
const FONT_KEY = 'ly_font'     // 'std' | 'big' | 'huge'，缺省 std

function themeMode() {
  const v = wx.getStorageSync(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'auto'
}

function sysTheme() {
  try { return wx.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light' } catch (e) { return 'light' }
}

// 生效主题：手动优先，auto 跟随系统
function effTheme() {
  const m = themeMode()
  return m === 'auto' ? sysTheme() : m
}

// 页面根包装类：auto 时不挂类（交给系统 media query），手动时挂覆盖类
function themeClass() {
  const m = themeMode()
  if (m === 'dark') return 't-dark'
  if (m === 'light' && sysTheme() === 'dark') return 't-light'
  return ''
}

// 阅读正文字号类（app.wxss .fs-big/.fs-huge 定义 --fss 缩放系数）
function fontClass() {
  const v = wx.getStorageSync(FONT_KEY)
  return v === 'big' ? 'fs-big' : (v === 'huge' ? 'fs-huge' : '')
}

function fontMode() {
  const v = wx.getStorageSync(FONT_KEY)
  return v === 'big' || v === 'huge' ? v : 'std'
}

function setThemeMode(m) {
  wx.setStorageSync(THEME_KEY, m === 'light' || m === 'dark' ? m : 'auto')
}

function setFont(f) {
  wx.setStorageSync(FONT_KEY, f === 'big' || f === 'huge' ? f : 'std')
}

export { themeMode, sysTheme, effTheme, themeClass, fontClass, fontMode, setThemeMode, setFont }
