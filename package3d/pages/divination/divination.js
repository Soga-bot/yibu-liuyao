// package3d/pages/divination/divination.js
// 3D 起卦页：龟壳 + 三枚铜钱「抛起 → 翻滚 → 落入龟壳 → 弹跳落定」
// 闭环：每摇一次读正反面成爻，摇满 6 爻自动带参跳转 pages/paipan 出完整盘。
// 真机增强：摇一摇手机=摇卦（加速度计）＋震动反馈；支持横竖屏（pageOrientation: auto）。
//
// 依赖（已放进分包 package3d/libs/three/）：
//   index.js        → createScopedThreejs（webpack 预打包整包，自洽无外部依赖）
//   gltf-loader.js  → registerGLTFLoader
// ⚠️ 模型必须是非 Draco 压缩的 glb（本 threejs-miniprogram 不含 DRACOLoader）
import { createScopedThreejs } from '../../libs/three/index.js'
import { registerGLTFLoader } from '../../libs/three/gltf-loader.js'

// ====== 模型来源 ======
// FileSystemManager 按小程序根路径读取。体积平衡：龟壳留分包，铜钱放主包 models/
// （r108 引擎不支持 KHR_mesh_quantization，无法靠量化压模型，故用分包装载平衡，见 THREE-SETUP.md）
const SHELL_SRC = 'package3d/models/shell.glb'
const COIN_SRC = 'models/coin.glb'

// ====== 动画参数（按你的模型尺度微调）======
const GRAVITY = 24          // 重力，越大落得越快
const FLOOR_Y = -1.45       // 铜钱落定高度（桌面）
const COIN_SIZE = 0.5       // 铜钱归一化尺寸（真物壳:钱≈3:1）
const SHELL_SIZE = 3.1      // 龟壳归一化尺寸（再放大一倍，画面主体）
// 龟壳姿态：立起来、龟背(拱面)正对镜头、壳口朝里；铜钱在壳前桌面弹跳落定
const SHELL_ADJUST = {
  x: 0, y: 0.15, z: -0.6,      // y=壳底缘落在铜钱桌面高度；z 后撤让铜钱停在壳前
  rotX: Math.PI / 2,           // 立起，纯竖直不俯仰（曾试后仰 0.28 补偿俯视透视，按要求已撤）
  rotY: Math.PI,               // 先把模型上下翻正（Euler XYZ 里 y/z 先于 x 生效），
  rotZ: 0,                     //   再立起——拱面仍朝镜头，仅头尾上下调转
  extraScale: 1
}
const BOUNCE = 0.34         // 弹跳能量保留率
const SETTLE_VEL = 0.4      // 速度低于此值视为落定

// ====== 手势拨动龟壳 ======
const SPIN_SENS = 0.012     // 横向拖动灵敏度：1px → 0.012rad，约拖一屏宽转一圈多
const PITCH_SENS = 0.012    // 纵向拖动灵敏度（俯仰），与横向一致
const SPRING_K = 5          // 松手回位弹簧刚度：越大回得越快（当前≈2.2s 回正），临界阻尼≈2√K
const SPRING_C = 4.2        // 弹簧阻尼（略欠阻尼：几乎不过冲）
const PITCH_LIMIT = 1.48    // 俯仰限位 ±85°：能看壳口/壳底又不整个翻转

// ====== 摇卦判定参数 ======
// 铜钱落定后 rotation.x=kπ、rotation.z=mπ（已 snap 躺平），盘面法向是否翻转取决于
// (k+m) 奇偶。「背面朝上」对应哪个奇偶由模型默认贴图朝向决定，需真机标定一次：
// 待机时三枚铜钱顶面若是「字面」(如通宝钱文)，则背面奇偶=1；反之改 0。
const BACK_PARITY = 1

// 三钱 → 爻（金钱卦标准：背为阳）
// 3背=老阳(动)｜0背=老阴(动)｜1背=少阳｜2背=少阴
const BACKS_TO_YAO = {
  3: { yin: false, dong: true,  name: '老阳', mark: 'O' },
  0: { yin: true,  dong: true,  name: '老阴', mark: 'X' },
  1: { yin: false, dong: false, name: '少阳', mark: '、' },
  2: { yin: true,  dong: false, name: '少阴', mark: '、、' }
}

// ====== 摇一摇（加速度计）参数 ======
const ACC_INTERVAL = 'game'     // ~20ms，最流畅
const SHAKE_DELTA = 12          // 相邻两次读数 |Δx|+|Δy|+|Δz| 超过此值算一次有效摇晃
const SHAKE_COOLDOWN = 1200     // 两次触发最小间隔(ms)，防止一甩连触发

const POS_SHORT = ['初', '二', '三', '四', '五', '上']

let THREE = null

Page({
  data: {
    loading: true,
    status: '加载模型中…',
    shaking: false,
    lines: [],       // 已得爻（摇出顺序 = 初→上）：{yin, dong, name, mark, pos}
    done: false,     // 6 爻已满，已跳转/待重摇
    tip: '',         // 最近一爻结果 / 引导文案
    asking: false,   // 问事签弹卡中
    qiu: ''          // 所问之事（输入框值）
  },

  onLoad() {
    this._accLast = null
    this._lastShakeAt = 0
    wx.createSelectorQuery()
      .select('#gl')
      .fields({ node: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          this.setData({ status: '画布初始化失败' })
          return
        }
        this.init(res[0].node)
      })
  },

  async init(canvas) {
    THREE = createScopedThreejs(canvas)
    registerGLTFLoader(THREE)

    // ---- 渲染器（用真实窗口尺寸，避免画布宽高比错乱导致拉伸变形）----
    const info = wx.getWindowInfo()
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(info.pixelRatio)
    renderer.setSize(info.windowWidth, info.windowHeight, false)
    renderer.setClearColor(0xEDE4CF, 1) // 宣纸浅底（与页面 css 背景一致），深底衬不出龟壳铜钱
    this._canvas = canvas
    this._renderer = renderer

    // 复用一个 GLTFLoader
    this._gltfLoader = new THREE.GLTFLoader()

    // ---- 场景 / 相机 ----
    const scene = new THREE.Scene()
    this._scene = scene
    const camera = new THREE.PerspectiveCamera(45, info.windowWidth / info.windowHeight, 0.1, 100)
    camera.position.set(0, 1.8, 5.8)
    camera.lookAt(0, 0.1, 0)           // 构图改为立壳+前桌面铜钱，视线略上移
    this._camera = camera

    // ---- 灯光：半球 + 主光 + 补光 + 环境（模型贴图整体偏黑，光比抬高）----
    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x4a3a22, 1.3))
    const key = new THREE.DirectionalLight(0xfff2cc, 1.4)
    key.position.set(3, 6, 4)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xb98a4a, 0.7)
    fill.position.set(-4, 2, -3)
    scene.add(fill)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))

    // ---- 加载龟壳 ----
    try {
      const shell = await this.loadModel(SHELL_SRC)
      fitObject(shell, SHELL_SIZE)
      liftMaterial(shell, [1.5, 1.4, 1.25], [0.1, 0.07, 0.04]) // 壳贴图偏黑，提亮
      // 手动微调（见顶部 SHELL_ADJUST）
      shell.scale.multiplyScalar(SHELL_ADJUST.extraScale)
      shell.position.x += SHELL_ADJUST.x
      shell.position.y += SHELL_ADJUST.y
      shell.position.z += SHELL_ADJUST.z
      shell.rotation.x += SHELL_ADJUST.rotX
      shell.rotation.y += SHELL_ADJUST.rotY
      shell.rotation.z += SHELL_ADJUST.rotZ
      // 手势转轴：Group 固定在壳中心、壳挂为子对象。拖动只转 Group ——
      // 壳绕自身中心 360° 旋转、位置不变；壳自身姿态(立起/翻正/后仰)与摇晃摆动都在子对象上，互不干扰
      const pivot = new THREE.Group()
      pivot.position.copy(shell.position)
      shell.position.set(0, 0, 0)
      pivot.add(shell)
      scene.add(pivot)
      this._shellPivot = pivot
      this._shell = shell
      this._shellYaw = 0        // 当前水平转角
      this._spinVel = 0         // 水平角速度(rad/s)
      this._shellPitch = 0      // 当前俯仰角
      this._pitchVel = 0        // 俯仰角速度(rad/s)
      this._homing = false      // 松手后弹簧回位中
      this._homeYaw = 0         // 回位目标 = 最近整圈（≡正面朝镜头）
      this._dragging = false
      this._shellBaseRotZ = shell.rotation.z   // 摇晃晃动以此为基准
      this._shakeT = 0
      this._shakeAmp = 0

      // ---- 加载铜钱（一次，克隆 ×3）；贴图偏黑，提亮力度比壳更大 ----
      const proto = await this.loadModel(COIN_SRC)
      liftMaterial(proto, [1.8, 1.7, 1.5], [0.2, 0.15, 0.09])
      this._coins = []
      for (let i = 0; i < 3; i++) {
        const coin = proto.clone(true)
        fitObject(coin, COIN_SIZE)
        scene.add(coin)
        this._coins.push(this.makeCoin(coin))
      }
      this.placeCoinsIdle()
    } catch (e) {
      console.error('模型加载失败', e)
      this.setData({ status: '模型加载失败：请确认是非 Draco 的 glb' })
      return
    }

    // ---- 启动渲染循环 + 摇一摇监听 ----
    if (this._destroyed) return   // 加载期间已退出页面：不再拉起
    this.setData({ loading: false, tip: '摇一摇手机，或点下方按钮起卦' })
    this._clock = new THREE.Clock()
    this.resumeLoop()
    this.startAcc()
  },

  // 铜钱状态对象
  makeCoin(mesh) {
    return {
      mesh,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      settled: true
    }
  },

  // 静态态：三枚铜钱停在立壳前方的桌面（x, z 均为壳前）
  placeCoinsIdle() {
    const slots = [[-0.5, 0.45], [0.5, 0.45], [0, 0.8]]
    this._coins.forEach((c, i) => {
      c.mesh.position.set(slots[i][0], FLOOR_Y, slots[i][1])
      c.mesh.rotation.set(0, i * 0.6, 0) // 若铜钱默认是立着的，按需改 0,0,0
      c.vel.set(0, 0, 0)
      c.angVel.set(0, 0, 0)
      c.settled = true
    })
  },

  // 触发抛落动画（铜钱落在立壳前方的桌面：z 取正值区间）
  startDrop() {
    this._coins.forEach((c, i) => {
      c.mesh.position.set(rand(-0.5, 0.5), 3.2 + i * 0.3, rand(0.15, 0.9))
      c.vel.set(rand(-0.6, 0.6), rand(-0.5, 0.8), rand(-0.3, 0.3))
      c.angVel.set(rand(-10, 10), rand(-10, 10), rand(-10, 10))
      c.settled = false
    })
    this._shaking = true
    this._shakeAmp = 1   // 龟壳跟着晃一下
    this.setData({ shaking: true, tip: '' })
  },

  // 每帧物理更新
  update(dt) {
    // 龟壳晃动（起卦时衰减摆动，模拟手摇）
    if (this._shakeAmp > 0.01 && this._shell) {
      this._shakeT += dt
      this._shell.rotation.z = this._shellBaseRotZ + Math.sin(this._shakeT * 28) * 0.06 * this._shakeAmp
      this._shakeAmp *= 0.96
    }
    // 手势拨动：拖动中跟手；松手后弹簧回位（yaw 回最近整圈=正面，pitch 归零竖直），≈2.2s 回正
    if (this._shellPivot) {
      if (!this._dragging && this._homing) {
        // 半隐式欧拉积分的欠阻尼弹簧：继承松手时的角速度，先顺势转、再平滑拉回，无跳变
        this._spinVel += (-SPRING_K * (this._shellYaw - this._homeYaw) - SPRING_C * this._spinVel) * dt
        this._shellYaw += this._spinVel * dt
        this._pitchVel += (-SPRING_K * this._shellPitch - SPRING_C * this._pitchVel) * dt
        this._shellPitch = clamp(this._shellPitch + this._pitchVel * dt, -PITCH_LIMIT, PITCH_LIMIT)
        if (Math.abs(this._shellYaw - this._homeYaw) < 0.002 && Math.abs(this._spinVel) < 0.02 &&
            Math.abs(this._shellPitch) < 0.002 && Math.abs(this._pitchVel) < 0.02) {
          this._shellYaw = this._homeYaw   // 到位吸附，彻底静止
          this._shellPitch = 0
          this._spinVel = 0
          this._pitchVel = 0
          this._homing = false
        }
      }
      this._shellPivot.rotation.y = this._shellYaw
      this._shellPivot.rotation.x = this._shellPitch
    }

    if (!this._shaking) return
    let allSettled = true
    for (const c of this._coins) {
      if (c.settled) continue
      allSettled = false

      c.vel.y -= GRAVITY * dt
      c.mesh.position.addScaledVector(c.vel, dt)
      c.mesh.rotation.x += c.angVel.x * dt
      c.mesh.rotation.y += c.angVel.y * dt
      c.mesh.rotation.z += c.angVel.z * dt

      if (c.mesh.position.y < FLOOR_Y) {
        c.mesh.position.y = FLOOR_Y
        c.vel.y = -c.vel.y * BOUNCE
        c.vel.x *= 0.62
        c.vel.z *= 0.62
        c.angVel.multiplyScalar(0.5)

        if (Math.abs(c.vel.y) < 0.25 && c.vel.length() < SETTLE_VEL) {
          c.mesh.rotation.x = snap(c.mesh.rotation.x)
          c.mesh.rotation.z = snap(c.mesh.rotation.z)
          c.vel.set(0, 0, 0)
          c.angVel.set(0, 0, 0)
          c.settled = true
        }
      }
    }
    if (allSettled) {
      this._shaking = false
      this.setData({ shaking: false })
      this.onCoinsSettled()
    }
  },

  // ====== 三钱成爻（闭环核心） ======
  // 铜钱全部落定：读正反面 → 数背 → 查表成爻 → 入 lines；满 6 爻跳排盘
  onCoinsSettled() {
    const backs = this._coins.filter(isBackUp).length
    const y = BACKS_TO_YAO[backs]
    if (!y) {   // 理论不可达（0~3 之外），防御
      this.setData({ tip: '读面异常，请重摇' })
      return
    }
    const pos = this.data.lines.length          // 0=初爻
    const lines = this.data.lines.concat([{
      yin: y.yin, dong: y.dong, name: y.name, mark: y.mark,
      posName: POS_SHORT[pos] + '爻'
    }])
    wx.vibrateShort({ type: 'light', fail: () => {} })

    if (lines.length >= 6) {
      // 卦成：重震一下，稍候跳排盘
      wx.vibrateShort({ type: 'heavy', fail: () => {} })
      this.setData({ lines, done: true, tip: backs + '背 → ' + y.name + '，卦成！' })
      const yaoKey = lines.map(l => l.yin ? '0' : '1').join('')
      const dongKey = lines.map(l => l.dong ? '1' : '0').join('')
      this._navTimer = setTimeout(() => {
        wx.navigateTo({
          url: '/pages/paipan/paipan?yao=' + yaoKey + '&dong=' + dongKey +
               '&q=' + encodeURIComponent(this._qiu || '') + '&from=3d',
          fail: () => this.setData({ tip: '跳转失败，请手动打开排盘页' })
        })
      }, 900)
    } else {
      this.setData({ lines, tip: '第' + (pos + 1) + '爻：' + backs + '背 → ' + y.name + (y.dong ? '（动）' : '') })
    }
  },

  // 清零重摇
  onReset() {
    if (this._navTimer) { clearTimeout(this._navTimer); this._navTimer = null }
    this._shakeAmp = 0
    this._asked = false          // 重摇=新卦，下次起卦重新问所求
    this._qiu = ''
    if (this._shell) this._shell.rotation.z = this._shellBaseRotZ
    this.placeCoinsIdle()
    this.setData({ lines: [], done: false, qiu: '', tip: '已重置，摇一摇或点按钮起卦' })
  },

  // 渲染循环
  loop() {
    if (!this._running) return
    const dt = Math.min(this._clock.getDelta(), 0.05)
    this.update(dt)
    this._renderer.render(this._scene, this._camera)
    this._canvas.requestAnimationFrame(this.loop)
  },
  resumeLoop() {
    if (this._running || !this._clock) return
    this._running = true
    this._clock.getDelta()   // 丢弃后台积压的 dt
    this.loop()
  },

  // ====== 摇一摇（真机）：加速度计触发，等价于点按钮 ======
  startAcc() {
    if (this._accOn) return
    this._accOn = true
    wx.startAccelerometer({ interval: ACC_INTERVAL, fail: () => {} })
    this._accHandler = (res) => {
      if (this.data.loading) return
      const last = this._accLast
      this._accLast = [res.x, res.y, res.z]
      if (!last) return
      const delta = Math.abs(res.x - last[0]) + Math.abs(res.y - last[1]) + Math.abs(res.z - last[2])
      if (delta < SHAKE_DELTA) return
      const now = Date.now()
      if (now - this._lastShakeAt < SHAKE_COOLDOWN) return
      this._lastShakeAt = now
      this.triggerShake()
    }
    wx.onAccelerometerChange(this._accHandler)
  },
  stopAcc() {
    if (!this._accOn) return
    this._accOn = false
    wx.stopAccelerometer({ fail: () => {} })
    if (this._accHandler) wx.offAccelerometerChange(this._accHandler)
  },

  // 摇卦统一入口：按钮 / 摇一摇都走这里
  triggerShake() {
    if (this.data.loading || this.data.shaking || this.data.asking) return
    // 新起一卦（首次或卦成重开）先弹「问事签」记录所求；同卦续爻不再问
    if ((this.data.done || !this.data.lines.length) && !this._asked) {
      this.setData({ asking: true })
      return
    }
    if (this.data.done) this.onReset()   // 卦成后再摇 = 重新起卦
    this.startDrop()
  },

  // ====== 问事签：起卦前默祷所求（可不填），为后续解读提供上下文 =====
  onQiuInput(e) { this.setData({ qiu: e.detail.value }) },
  onQiuConfirm() {
    this._qiu = (this.data.qiu || '').trim()
    this._asked = true
    this.setData({ asking: false })
    if (this.data.done) this.onReset()
    this.startDrop()
  },
  onQiuSkip() {
    this._qiu = ''
    this._asked = true
    this.setData({ asking: false, qiu: '' })
    if (this.data.done) this.onReset()
    this.startDrop()
  },

  // 横竖屏切换：画布与相机跟着新窗口尺寸走
  onResize() {
    if (!this._renderer || !this._camera) return
    const info = wx.getWindowInfo()
    this._renderer.setSize(info.windowWidth, info.windowHeight, false)
    this._camera.aspect = info.windowWidth / info.windowHeight
    this._camera.updateProjectionMatrix()
  },

  // 加载 glb：FileSystemManager 读分包内文件为 ArrayBuffer，再 parse
  loadModel(src) {
    return readGlbArrayBuffer(src).then((data) => {
      return new Promise((resolve, reject) => {
        this._gltfLoader.parse(data, '', (gltf) => resolve(gltf.scene), reject)
      })
    })
  },

  // ====== 手势拨动龟壳：横拖=绕竖直轴 360°，纵拖=俯仰(±85°限位)；松手弹簧回位 =====
  onShellTouchStart(e) {
    if (!this._shellPivot) return
    const t = e.changedTouches[0]
    this._touchId = t.identifier
    this._touchLastX = t.clientX
    this._touchLastY = t.clientY
    this._touchLastT = e.timeStamp
    this._spinVel = 0              // 按住即停（取消回位）
    this._pitchVel = 0
    this._homing = false
    this._dragging = true
  },
  onShellTouchMove(e) {
    if (!this._dragging || !this._shellPivot) return
    const t = (e.touches || []).filter((x) => x.identifier === this._touchId)[0]
    if (!t) return
    const dx = t.clientX - this._touchLastX
    const dy = t.clientY - this._touchLastY
    this._touchLastX = t.clientX
    this._touchLastY = t.clientY
    this._shellYaw += dx * SPIN_SENS
    this._shellPitch = clamp(this._shellPitch + dy * PITCH_SENS, -PITCH_LIMIT, PITCH_LIMIT)
    // 按真实移动间隔估角速度作惯性初速（限幅 ±8rad/s，防一甩转飞）
    const gap = Math.max((e.timeStamp - this._touchLastT) / 1000, 0.008)
    this._spinVel = clamp((dx * SPIN_SENS) / gap, -8, 8)
    this._pitchVel = clamp((dy * PITCH_SENS) / gap, -8, 8)
    this._touchLastT = e.timeStamp
  },
  onShellTouchEnd(e) {
    if (!this._dragging) return
    const still = (e.touches || []).some((x) => x.identifier === this._touchId)
    if (!still) {
      this._dragging = false    // 手指全离开才松
      // 回位目标取最近整圈：不管转过多少圈，都走最短路径回到正面朝镜头
      this._homeYaw = Math.round(this._shellYaw / (Math.PI * 2)) * Math.PI * 2
      this._homing = true
    }
  },

  onShakeTap() { this.triggerShake() },

  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  onShow() {
    // 从排盘页返回：恢复渲染循环与摇一摇（onHide 已停）
    this.resumeLoop()
    if (!this.data.loading) this.startAcc()
  },
  onHide() {
    this._running = false
    this.stopAcc()
  },
  onUnload() {
    this._running = false
    this._destroyed = true
    this.stopAcc()
    if (this._navTimer) clearTimeout(this._navTimer)
  }
})

// ============ 工具函数 ============

// 材质暖调提亮：贴图整体偏黑。color 是贴图乘数（>1 即增亮），emissive 微补暗部
function liftMaterial(obj, mul, glow) {
  obj.traverse((o) => {
    if (!o.isMesh) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    mats.forEach((m) => {
      if (!m || !m.color) return
      m.color.setRGB(mul[0], mul[1], mul[2])
      if (m.emissive) m.emissive.setRGB(glow[0], glow[1], glow[2])
    })
  })
}

// 读 glb 为 ArrayBuffer（分包内文件，按小程序根路径）
function readGlbArrayBuffer(src) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: src,
      success: (r) => resolve(r.data),
      fail: reject
    })
  })
}

// 落定后判断铜钱是否背面朝上（见顶部 BACK_PARITY 标定说明）
function isBackUp(c) {
  const k = Math.round(c.mesh.rotation.x / Math.PI)
  const m = Math.round(c.mesh.rotation.z / Math.PI)
  return (((k + m) % 2) + 2) % 2 === BACK_PARITY
}

// 把模型归一化到 size，并以几何中心对齐原点
function fitObject(obj, size) {
  const box = new THREE.Box3().setFromObject(obj)
  const dim = new THREE.Vector3()
  box.getSize(dim)
  const maxDim = Math.max(dim.x, dim.y, dim.z) || 1
  const scale = size / maxDim
  obj.scale.setScalar(scale)
  const center = new THREE.Vector3()
  box.getCenter(center)
  obj.position.sub(center.multiplyScalar(scale))
}

function rand(a, b) { return a + Math.random() * (b - a) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
// 把任意角度吸附到 π 的整数倍（让铜钱落定时是平的）
function snap(rad) { return Math.round(rad / Math.PI) * Math.PI }
