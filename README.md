# 易研六爻 · 微信小程序

传统六爻（火珠林/金钱卦）传统文化学习小程序。**唯一产品线**：起卦入口 = 3D 龟壳摇铜钱（分包 `package3d`），辅以手动排盘；解卦走「问易」单篇合参解读（当前本地合成模拟态，云端真模型切换预留 v0.4.0）。

> 2026-08 整理：已删除伏羲 Streamlit 应用与其小程序移植版（CHAT），只保留本线。
> 有用的知识已收进 `tools/reference/`（64 卦 desc/大象传、参考页原型）。

## 结构

```text
├── app.js / app.json / app.wxss   全局配置（自定义导航/TabBar，宣纸米黄+墨色宣纸双主题）
├── custom-tab-bar/                自定义底部 TabBar
├── pages/                         主包页（4 个 tab + 卦详情数据锚点）
│   ├── index/                     首页：摇卦起卦(3D) / 手动排盘 双入口 + 知识页入口
│   ├── paigua/                    解卦速查（用神/断法口径）
│   ├── dianji/ detail             典籍库 tab：64卦浏览 / 卦详情（全站卦库数据锚点）
│   └── mine/                      我的（历史/版本/音乐）
├── package3d/                     分包：3D 起卦链路 ★ 主打
│   ├── models/ audio/             shell.glb 龟壳模型（非 Draco）+ 摇卦音效
│   ├── utils/wenyi-mock.js        本地经文合成器（模拟态：零随机零联网）
│   └── pages/ ask→divination→result→wenyi   问事 → 摇卦 → 卦成 → 问易解读
├── packageEngine/                 分包：three 引擎（divination 页 require.async 异步注入）
├── packageBooks/                  分包：通识与工具页（首页/典籍库 tab 预载）
│   ├── wuxing/ bagua/ bagong/     知识页：五行 / 八卦 / 八宫六十四卦表
│   ├── paipan/                    手动排盘：6爻+日干支 → 完整盘
│   ├── dianji/shiyi               十翼通读（系辞文言说序杂）
│   └── settings/ utils/bgm.js     设置（字号三档/深色/背景音乐）
├── utils/
│   ├── liuyao.js                  ★ 六爻排盘引擎（纯算法零依赖）
│   ├── wenyi-config.js            问易三态开关（''/mock/cloud，唯一改动点）
│   └── *.test.mjs                 测试（wenyi 84 / liuyao 35 / gua 13，node 直跑）
├── data/                          机器生成勿手改：gua(64卦经文) shiyi(十翼) baihua* diangu
├── cloudfunctions/wenyi/          问易云函数（服务端复核+提示词 v1.1+豆包调用；key 只存环境变量）
├── local/                         本地联调配置与输出（git/包双排除，密钥所在）
├── tools/                         生成与校对脚本（含 wenyi-cloud 快照/wenyi-local 直连）+ reference/
└── docs/                          版本说明/开发日志/技术文档/规格与方案/回归清单/校对档
```

## 排盘引擎 `utils/liuyao.js`

按火珠林标准实现：纳甲 / 八宫世应（京房变卦法程序化生成）/ 六亲（五行生克）/ 六神（日起）/ 旬空 / 变卦，另有公历→日干支（JDN 公式）。
`data/gua.js` 由 `tools/gen-gua-data.mjs` 生成：卦名卦宫来自引擎，大象传/desc 来自 `tools/reference/fuxi-gua.json`，**卦辞/爻辞/用九用六来自《周易》原文 `tools/reference/zhouyi.txt`**（GB18030 已转 UTF-8；注意坎卦经文作「习坎」已特判）。改引擎或 gua 源后须 `node tools/gen-wenyi-cloud.mjs` 重生成云函数快照（自校验不过会拦）。

## 问易（AI 解卦）

`utils/wenyi-config.js` 三态：`''` 未开通 / `'mock'` 本地合成（**当前默认**，零联网可全流程体验）/ `'cloud'` 云函数（失败自动降级 mock）。云端走 `cloudfunctions/wenyi`（豆包·火山方舟，OpenAI 兼容；服务端排盘复核防注入、七禁词红线、msgSecCheck 双检）。部署与切换见 `docs/AI问易接入方案.md` §七；本地联调 `node tools/wenyi-local.mjs`（配置在 `local/`，勿入库）。

## 运行

微信开发者工具打开项目根目录 → 编译。主链路：首页 →「摇卦起卦」→ 摇卦 → 卦成 → 问易。

## 打包注意

`project.config.json` 的 `packOptions.ignore` 已忽略 `tools/`、`docs/`、`cloudfunctions/`、`local/`、`.mypy_cache/`、全部 `*.md` 与 `*.test.mjs`——新增文档/脚本/密钥类文件请放这些位置；**密钥只进 `local/`（本地）或云函数环境变量（线上），绝不进小程序包**。

## 待办（当前）

1. **v0.4.0 云端切换**：云开发部署四步 + `WENYI_MODE='cloud'`（`docs/AI问易接入方案.md` §七）
2. 上线前补：云函数限流（openid 每日次数）、AIGC 标识提审前复核
3. BGM 音源未配置（`packageBooks/utils/bgm.js` 预留接口，`BGM_SRC` 为空）
4. 真机回归清单逐轮走查（`docs/真机回归清单.md`）
