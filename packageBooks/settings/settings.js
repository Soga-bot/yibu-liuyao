// packageBooks/settings/settings.js — 设置：深色模式三态 / 阅读正文字号 / 背景音乐
// 深色三态与字号档位存 storage（utils/theme.js），本页切换即时生效做预览；
// 各页面 onLoad/onShow 重读覆盖类。本页不定义转发（个人设置，无分享价值）。
import {
  themeClass, fontClass, setThemeMode, setFont, sysTheme,
  themeMode as getThemeMode, fontMode as getFontMode
} from '../../utils/theme.js'
import { bgmState, bgmToggle } from '../../utils/bgm.js'

const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    themeCls: '',       // 本页即预览：切换即重算覆盖类
    fontCls: '',
    themeMode: 'auto',  // 'auto' | 'light' | 'dark'
    sysDark: false,     // 系统当前外观（「跟随系统」实时效果提示用）
    fontMode: 'std',    // 'std' | 'big' | 'huge'
    bgmOn: true,        // 背景音乐开关（首次默认开；出声须手点音符——微信规范禁自动播放）
    bgmReady: false     // 音源是否已配置（预留接口未填 = false）
  },

  onLoad() {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 20,
      themeCls: themeClass(),
      fontCls: fontClass(),
      themeMode: getThemeMode(),
      fontMode: getFontMode(),
      sysDark: sysTheme() === 'dark'
    })
  },
  onShow() {
    const b = bgmState()
    this.setData({ bgmOn: b.on, bgmReady: b.configured, sysDark: sysTheme() === 'dark' })
  },

  // 深色三态：写入后本页立即换肤；tab 页回前台 onShow 刷新，二级页进页 onLoad 刷新
  onTheme(e) {
    setThemeMode(e.currentTarget.dataset.m)
    this.setData({ themeMode: getThemeMode(), themeCls: themeClass() })
  },

  // 字号三档：预览行即时缩放
  onFont(e) {
    setFont(e.currentTarget.dataset.f)
    this.setData({ fontMode: getFontMode(), fontCls: fontClass() })
  },

  // 背景音乐音符按钮：唯一出声入口（用户手势），全局单例跨页不断播
  onBgm() {
    const r = bgmToggle()
    this.setData({ bgmOn: r.on })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mine/mine' }) })
  }
})
