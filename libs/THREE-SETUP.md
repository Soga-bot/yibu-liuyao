# 3D 起卦页 —— 结构与状态

3D 功能分布在两个**分包**：`package3d`（页面/模型/音效）+ `packageEngine`（three 引擎，2026-08-27 体积治理拆出，
divination 页经 `require.async` 跨分包异步注入，官方「分包异步化」特性，基础库 ≥2.17.3）。

```text
package3d/
├── models/
│   └── shell.glb        ← 龟壳（非 Draco，已验证；coin.glb 在主包 models/，体积平衡）
├── audio/               ← 摇卦音效
└── pages/divination/    ← 3D 起卦页

packageEngine/
└── three/
    ├── index.js         ← three.js 引擎（createScopedThreejs，webpack 预打包，自洽）
    └── gltf-loader.js   ← registerGLTFLoader（ESM export，靠 es6:true 转译）
```

## 关键事实

- **引擎已就位**：`packageEngine/three/index.js` 是 threejs-miniprogram 预打包整包，`abab` 等依赖已内联，无外部 require。
- **该库不含 DRACOLoader**，模型必须是普通（非 Draco）glb。
  当前两个模型已实测 `KHR_draco_mesh_compression` 计数为 0（非压缩），加载正常。
- **体积（2026-08-24 调整）**：引擎 r108 不支持 `KHR_mesh_quantization`，模型无法量化压缩（实测贴图本就很小——
  shell 内嵌 webp 共 56KB、coin 一张 PNG 11KB，体积大头是 float32 顶点属性；weld/prune/simplify 均无收益）。
  解法：**coin.glb 移到主包 `models/`，shell.glb 留分包**——主包 ~841KB ✓、package3d ~1585KB ✓，均低于 2MB 限额。
  原始模型备份在 `tools/reference/models-orig/`。长期方案：升级 three 移植版后对两个模型做量化。
- **体积治理二期（2026-08-27）**：three 引擎 698K 拆出独立分包 `packageEngine` 后，
  package3d 源码 1.67M→约 1.05M（回到 1.5M 质量线内），引擎分包约 0.7M；两包各留约 1M 硬限余量。
  代价：引擎改异步加载（divination.js `init` 头部 `require.async`），首进弱网多一段下载，
  wifi 场景由 preloadRule（首页/问事页预载 packageEngine 分包）掩盖；加载失败走页面既有 failed→redirectTo 重试通道。
- 模型加载方式：`FileSystemManager.readFile`（按小程序根路径）→ `GLTFLoader.parse(ArrayBuffer)`。

## ★ 「摇卦 → 排盘」闭环（2026-08-24 已打通）

每摇一次：三枚铜钱落定 → 读正反面 → 数背成爻 → 入 `lines[]`（UI 亮一格）；
摇满 6 爻自动 `navigateTo('/pages/paipan/paipan?yao=<6位>&dong=<6位>')`，排盘页 `onLoad` 解析后直接出完整盘。

**正反面判定**：落定时 rotation.x=kπ、rotation.z=mπ（已 snap 躺平），盘面法向是否翻转取决于 (k+m) 奇偶。
「背面朝上」对应哪个奇偶由模型默认贴图朝向决定——`divination.js` 顶部常量 `BACK_PARITY` 标定：

- 待机时铜钱顶面是「字面」（钱文）→ `BACK_PARITY = 1`（当前默认）；
- 若真机验证发现阴阳颠倒（如三背总出少阳），改成 0 即可。

三枚铜钱 → 一爻的映射（金钱卦标准，背=阳记 1）：

| 三枚结果（背数） | 爻 | 动静 |
| --- | --- | --- |
| 3 背 | 老阳 ⚊（`{yin:false, dong:true}`） | 动 |
| 0 背（3 字） | 老阴 ⚋（`{yin:true, dong:true}`） | 动 |
| 1 背 2 字 | 少阳 ⚊（`{yin:false, dong:false}`） | 静 |
| 2 背 1 字 | 少阴 ⚋（`{yin:true, dong:false}`） | 静 |

摇满 6 爻自动跳转排盘（`paipan({ yao, dayGan, dayZhi })` 在排盘页内完成，日干支默认取当天）。

## 真机增强：摇一摇 + 震动 + 横屏（已实现，需真机预览验证）

- **摇一摇起卦**：`wx.onAccelerometerChange`（interval=game）+ 相邻帧 |Δx|+|Δy|+|Δz| > `SHAKE_DELTA(12)` 触发，冷却 `SHAKE_COOLDOWN(1200ms)`；触发时龟壳做衰减摆动动画。
- **震动**：每成一爻 `vibrateShort(light)`，卦成 `vibrateShort(heavy)`（fail 静默，部分安卓机型不支持 type）。
- **横屏**：`divination.json` 已设 `"pageOrientation": "auto"`（横竖都行），`onResize` 同步更新 renderer 尺寸与相机宽高比。
- **注意**：加速度计与震动在开发者工具里模拟不了，必须真机「预览」测试。

## 运行

微信开发者工具 → 编译 → 首页点「摇卦起卦」→ 进入分包 3D 页 → 点底部按钮看铜钱抛入龟壳。

## 微调（divination.js 顶部参数）

| 参数 | 作用 |
| ------ | ------ |
| `GRAVITY` | 重力，越大落得越快 |
| `FLOOR_Y` | 龟壳内底高度，决定铜钱落定 y |
| `COIN_SIZE` / `SHELL_SIZE` | 铜/龟归一化尺寸 |
| `BOUNCE` | 弹跳保留率（0–1） |
| `BACK_PARITY` | 背面朝上的奇偶标定（见上） |
| `SHAKE_DELTA` / `SHAKE_COOLDOWN` | 摇一摇灵敏度 / 防连触冷却 |

龟壳口没朝上 → 调 `SHELL_ADJUST.rotX`。
