// cloudfunctions/wenyi/quota.js — 每用户每日调用限额（openid 维度，CJS）
//
// 计数存云开发数据库 wenyi_quota 集合：_id = `${openid}_${yyyymmdd}`（北京时间
// 日界，云函数跑 UTC 故 +8h 取日），字段 n=当日已调次数。先自增再读回，
// n 超过限额即拒绝——正好放行 limit 次/日。隔日自然换新文档，旧档不清理
// （单文档 <100B，免费额度 3GB 容量下量级可忽略）。
//
// 集合不存在时自动建（首部署免手工建表）；限流设施自身故障（数据库不可用
// 等）一律放行并记 log——配额系统挂了不应挡正常调用，与 msgSecCheck 入口
// fail-open 同一哲学。并发首调可能双双建档各记 1 → 极端漏计一两轮，可接受
//（成本对账以控制台调用次数为准）。
const cloud = require('wx-server-sdk')

const COL = 'wenyi_quota'

// 北京日界的 yyyymmdd
function dayKey() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

// db 句柄惰性获取：本模块在 index.js 的 cloud.init 之前被 require，
// 顶层取 cloud.database() 有加载顺序风险，挪到调用时取
async function ensureCol() {
  try { await cloud.database().createCollection(COL) } catch (e) { /* 已存在则忽略 */ }
}

// 取值口径：环境变量 WENYI_DAILY_LIMIT 缺省/非法 → 默认 10；显式 0 → 不限额
function dailyLimit() {
  const v = Number(process.env.WENYI_DAILY_LIMIT)
  return Number.isFinite(v) && v >= 0 ? v : 10
}

// 返回 true=放行（已计数）；false=今日已达上限。设施故障放行（fail-open）
async function take(openid) {
  if (!openid) return true            // 无 openid（控制台测试等）不限
  const limit = dailyLimit()
  if (limit === 0) return true        // 显式关闭限额
  const id = openid + '_' + dayKey()
  const db = cloud.database()
  const _ = db.command
  try {
    const upd = await db.collection(COL).doc(id).update({ data: { n: _.inc(1) } })
    if (!upd.stats || upd.stats.updated > 0) {
      const r = await db.collection(COL).doc(id).get()
      return !(((r.data && r.data.n) || 1) > limit)
    }
    // 文档不存在 → 建档（当日首调）
    await db.collection(COL).doc(id).set({ data: { n: 1, d: dayKey() } })
    return true
  } catch (e) {
    const msg = String((e && e.errMsg) || e)
    if (/DATABASECOLLECTIONNOTEXIST|collection.*not.*exist/i.test(msg)) {
      try {
        await ensureCol()
        await db.collection(COL).doc(id).set({ data: { n: 1, d: dayKey() } })
        return true
      } catch (e2) {
        console.error('[wenyi] 限额建档失败（放行）：', e2)
        return true
      }
    }
    console.error('[wenyi] 限流设施不可用（放行）：', e)
    return true
  }
}

module.exports = { take, dailyLimit }
