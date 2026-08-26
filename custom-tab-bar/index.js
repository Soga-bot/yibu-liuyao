// custom-tab-bar/index.js
import { themeMode, sysTheme } from '../utils/theme.js'

Component({
  data: {
    selected: 0,
    safeBottom: 0,
    dark: false,   // 生效深色（图标用）：手动指定优先，auto 跟随系统
    light: false,  // 手动浅色而系统深色：变量需强制回浅（底色/文字）
    list: [
      { pagePath: '/pages/index/index', text: '首页' },
      { pagePath: '/pages/paigua/paigua', text: '解卦' },
      { pagePath: '/pages/dianji/dianji', text: '典籍库' },
      { pagePath: '/pages/mine/mine', text: '我的' }
    ]
  },

  lifetimes: {
    attached() {
      const app = getApp()
      this.setData({ safeBottom: app.globalData.safeBottom || 0 })
      // 深色模式：底色/文字走 CSS 变量自动翻转；图标描边色编在 SVG data-URI 里，
      // 变量管不到，只能 JS 加 dark 类切换深色图标。设置页可手动指定主题
      // （ly_theme），在此按「生效主题」计算，pageLifetimes.show 时刷新
      this._applyTheme()
      try {
        wx.onThemeChange(() => this._applyTheme())
      } catch (e) {
        // 低版本基础库无 theme 字段，保持浅色
      }
    }
  },

  pageLifetimes: {
    // 从设置页改完主题返回：重新读 ly_theme 刷新图标与强制类
    show() {
      this._applyTheme()
    }
  },

  methods: {
    _applyTheme() {
      const m = themeMode()
      const s = sysTheme()
      const eff = m === 'auto' ? s : m
      this.setData({
        dark: eff === 'dark',
        light: m === 'light' && s === 'dark'
      })
    },
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset
      wx.switchTab({ url: path })
      this.setData({ selected: index })
    }
  }
})
