// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    safeBottom: 0,
    dark: false,
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
      // 变量管不到，只能 JS 加 dark 类切换深色图标（app.json darkmode:true 才有 theme）
      try {
        const t = wx.getSystemInfoSync().theme
        if (t) this.setData({ dark: t === 'dark' })
        wx.onThemeChange((res) => this.setData({ dark: res.theme === 'dark' }))
      } catch (e) {
        // 低版本基础库无 theme 字段，保持浅色
      }
    }
  },

  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset
      wx.switchTab({ url: path })
      this.setData({ selected: index })
    }
  }
})
