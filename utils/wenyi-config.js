// utils/wenyi-config.js — 问易服务模式开关（唯一改动点）
//
// WENYI_MODE 三态：
//   ''      未开通：wenyi 页只引导读本卦/变卦原文（v0.3.24 之前的旧态）
//   'mock'  本地合成：不上报、不联网，由 utils/wenyi-mock.js 用排盘结果 +
//           64 卦经文库在端上合成四段参考文（模拟态，全管线可体验）
//   'cloud' 云函数：wx.cloud.callFunction 调 cloudfunctions/wenyi，
//           由云端大模型生成（key 只存云函数环境变量，不下发小程序端）；
//           云端失败时自动降级本地合成
//
// 切 'cloud' 前须完成（详见 docs/问易解读规格.md 云函数部署节）：
//   1. 开发者工具开通云开发，环境 ID 填入 WENYI_CLOUD_ENV；
//   2. 上传部署 cloudfunctions/wenyi，控制台配环境变量
//      WENYI_BASE_URL / WENYI_API_KEY / WENYI_MODEL / WENYI_TIMEOUT_MS。
export const WENYI_MODE = 'mock'

// 云开发环境 ID（WENYI_MODE='cloud' 时必填；app.js 由此决定是否 wx.cloud.init）
export const WENYI_CLOUD_ENV = ''
