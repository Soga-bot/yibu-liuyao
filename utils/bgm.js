// utils/bgm.js — 背景音乐全局管理（跨页不断播，全局静音开关）
// 预留接口：BGM_SRC 为空 = 音源未配置，点按钮仅提示，不播任何假音频——
// 与 wenyi 三态开关（WENYI_MODE）同款「常量即开关」范式，配好地址即整链生效。
// 微信规范（不可违）：音频必须由用户手势开启，本模块只在 bgmToggle() 被点按时才 play，
// 绝不做进入页面自动响音乐。
const BGM_SRC = ''      // 音源地址：包内路径（如 '/assets/bgm.mp3'，注意包体积）或 https CDN 地址
const VOLUME = 0.22     // 预置音量 22%（20–25% 区间内，避免刺耳打扰阅读）
const KEY = 'ly_bgm_on' // 全局开关存储键（首次进入默认开；静音全局生效——单例全局唯一）

let ctx = null

// 全局单例：模块作用域持有，页面跳转不销毁；loop 循环；尊重手机硬件静音键
function ensureCtx() {
  if (ctx) return ctx
  ctx = wx.createInnerAudioContext({ useWebAudioImplement: false })
  ctx.loop = true
  ctx.obeyMuteSwitch = true
  ctx.volume = VOLUME
  ctx.src = BGM_SRC
  ctx.onError((e) => console.error('[背景音乐] 播放失败', e))
  return ctx
}

// 音源是否已配置（未配置时按钮为预告态）
export function bgmReady() {
  return !!BGM_SRC
}

// 开关态：首次进入（无存储）默认「开」——只是开关预置，出声仍须手点音符按钮
export function bgmOn() {
  const v = wx.getStorageSync(KEY)
  return v === '' ? true : !!v
}

// 当前完整状态（「我的」页渲染用）
export function bgmState() {
  const ready = bgmReady()
  return {
    configured: ready,
    on: ready ? (ctx ? !ctx.paused : bgmOn()) : bgmOn(),
    playing: ready && !!ctx && !ctx.paused
  }
}

// 音符按钮点按：已配置 → 播/暂停（并落全局开关）；未配置 → 提示后维持原状。
// 冷启动后 ctx 为空但开关为开时，点按即播放（play 优先于开关翻转，避免「点了却关掉」）
export function bgmToggle() {
  if (!BGM_SRC) {
    wx.showToast({ title: '背景音乐音源尚未配置', icon: 'none' })
    return { on: bgmOn(), playing: false }
  }
  const c = ensureCtx()
  if (!c.paused) {
    c.pause()
    wx.setStorageSync(KEY, false)
    return { on: false, playing: false }
  }
  c.play()
  wx.setStorageSync(KEY, true)
  return { on: true, playing: true }
}
