// app.js — 全局逻辑：缓存状态栏高度与底部安全区，供自定义导航栏 / TabBar 使用
import { WENYI_MODE, WENYI_CLOUD_ENV } from './utils/wenyi-config.js'

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
    // 云开发仅问易走云函数时初始化（mock/未开通态不引入云依赖）
    if (WENYI_MODE === 'cloud' && WENYI_CLOUD_ENV && wx.cloud) {
      try {
        wx.cloud.init({ env: WENYI_CLOUD_ENV, traceUser: true })
      } catch (e) {
        console.error('[app] 云开发初始化失败', e)
      }
    }
  }
})
