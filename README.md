# 易卜六爻 · 微信小程序

传统六爻占卜（火珠林/金钱卦）小程序。**唯一产品线**：起卦入口 = 3D 龟壳摇铜钱（分包 `package3d`），辅以手动排盘。

> 2026-08 整理：已删除伏羲 Streamlit 应用与其小程序移植版（CHAT），只保留本线。
> 有用的知识已收进 `tools/reference/`（64 卦 desc/大象传、参考页原型）。

## 结构

```text
├── app.js / app.json / app.wxss   全局配置（自定义导航/TabBar，宣纸米黄主题）
├── custom-tab-bar/                自定义底部 TabBar
├── pages/
│   ├── index/                     首页：摇卦起卦(3D) / 手动排盘 双入口
│   ├── paipan/                    手动排盘：6爻+日干支 → 完整盘（唯一成品功能页）
│   ├── paigua/ dianji/ mine/      占位页（排卦解卦/典籍库/我的，待开发）
├── package3d/                     分包：3D 起卦（three.js + glb 模型）★ 主打
│   ├── libs/three/                threejs-miniprogram 预打包引擎 + GLTFLoader
│   ├── models/                    shell.glb / coin.glb（非 Draco）
│   └── pages/divination/          龟壳摇铜钱 3D 页
├── utils/
│   ├── liuyao.js                  ★ 六爻排盘引擎（纯算法零依赖）
│   └── liuyao.test.mjs            引擎测试（node utils/liuyao.test.mjs）
├── data/gua.js                    64卦知识库（自动生成，勿手改）
└── tools/
    ├── gen-gua-data.mjs           知识库生成脚本（node tools/gen-gua-data.mjs）
    └── reference/                 数据来源与参考原型（fuxi-gua.json 等）
```

## 排盘引擎 `utils/liuyao.js`

按火珠林标准实现：纳甲 / 八宫世应（京房变卦法程序化生成）/ 六亲（五行生克）/ 六神（日起）/ 旬空 / 变卦，另有公历→日干支（JDN 公式）。
`data/gua.js` 由 `tools/gen-gua-data.mjs` 生成：卦名卦宫来自引擎，大象传/desc 来自 `tools/reference/fuxi-gua.json`，**卦辞/爻辞/用九用六来自《周易》原文 `tools/reference/zhouyi.txt`**（GB18030 已转 UTF-8；含十翼全文，可供典籍库页使用；注意坎卦经文作「习坎」已特判）。

## 运行

微信开发者工具打开项目根目录 → 编译。3D 页路径：首页 →「摇卦起卦」。

## 打包注意

`project.config.json` 的 `packOptions.ignore` 已忽略 `tools/` 与全部 `*.md`——新增文档/脚本请放这两处，避免进主包。

## 待办（优先级）

1. ~~打通 3D 摇卦→排盘闭环~~ ✅ 2026-08-24 完成（含摇一摇/震动/横屏，见 `libs/THREE-SETUP.md`）
2. `git init` 版本管理
3. 典籍库页（`pages/dianji`）接 `GUA_LIST` 渲染 64 卦浏览（卦辞/爻辞已齐；`zhouyi.txt` 里还有彖传/系辞等十翼全文可用）
4. 替换正式 AppID（当前 `touristappid`）
