// app.js — 全局逻辑：缓存状态栏高度与底部安全区，供自定义导航栏 / TabBar 使用
App({
  globalData: {
    statusBarHeight: 20, // 状态栏高度（px）
    navBarHeight: 44,    // 自定义导航栏内容高度（px）
    safeBottom: 0        // 底部安全区（iPhone X 系列 Home 指示条）
  },

  onLaunch() {
    try {
      const win = wx.getWindowInfo()
      this.globalData.statusBarHeight = win.statusBarHeight || 20
      const bottom = win.safeArea ? win.safeArea.bottom : win.screenHeight
      this.globalData.safeBottom = Math.max(0, win.screenHeight - bottom)
    } catch (e) {
      // 降级：保留默认值
    }
  }
})
