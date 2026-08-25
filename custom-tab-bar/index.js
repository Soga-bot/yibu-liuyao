// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    safeBottom: 0,
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
