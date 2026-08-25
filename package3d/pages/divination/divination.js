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

// ====== 装钱→摇动→倒出流程 ======
const SHAKE_HITS = 4           // 有效晃动达此次数 = 摇够
const SHAKE_QUIET = 800        // 摇够后静默该时长(ms)判定摇动停止，自动倒出
const LOAD_ANGLE = 1.5         // 装钱态：壳后仰成碗（口朝上）
const POUR_ANGLE = -1.9        // 倒钱态：壳前倾（口转向桌面）
const TILT_SPEED = 6           // 壳姿态角指数趋近系数（越大转得越快）
const POUR_RELEASE = 0.55      // 前倾角走过该比例时松钱
const LOAD_RADIUS = 1.05       // 拖钱入壳判定：落点距壳心该半径内算入
const HOP_DUR = 0.35           // 铜钱落入壳内动画时长(s)

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
    qiu: '',         // 所问之事（输入框值）
    failed: false,   // 3D 初始化失败（画布/模型）：按钮变「重新加载」
    phase: 'idle',   // 流程阶段（按钮文案用）
    loadCount: 0,    // 已入壳铜钱数
    btnLabel: '摇卦起卦'  // 按钮文案（JS 集中算：wxml 深层三元编译不过）
  },

  onLoad() {
    this._accLast = null
    this._lastShakeAt = 0
    wx.createSelectorQuery()
      .select('#gl')
      .fields({ node: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          console.error('画布节点获取失败', res)
          this.setData({ failed: true, btnLabel: '重新加载', status: '画布初始化失败，点下方按钮重试' })
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
    this._winW = info.windowWidth    // 触摸坐标 → 射线 NDC 换算用
    this._winH = info.windowHeight
    this._tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(FLOOR_Y + 0.3)) // 拖钱平面（提起高度）

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
      this._phase = 'idle'     // idle 观赏｜loading 装钱｜righting 立正｜shaking 摇动｜pouring 前倾倒钱｜settling 落定｜returning 回正
      this._tilt = 0           // 仪式姿态角（0=立正，>0 后仰成碗，<0 前倾倒钱）
      this._tiltTarget = 0
      this._tiltCb = null      // 姿态到位后的回调（一次性）
      this._loadCount = 0
      this._dragCoin = null
      this._released = false
      this._hits = 0
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
      // 真实原因带出来（readFile 的 errMsg / GL 上下文失败等），别再只写推测文案
      console.error('3D 初始化失败', e)
      const msg = (e && (e.errMsg || e.message)) || '未知错误'
      this.setData({ failed: true, btnLabel: '重新加载', status: '加载失败：' + msg })
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
      c.anim = null
      c.settled = true
    })
  },

  // ====== 装钱→摇动→倒出流程 ======
  // 装钱态：壳后仰成碗，等用户把三枚铜钱拖入壳口
  beginLoad() {
    this._phase = 'loading'
    this._loadCount = 0
    this._tiltTarget = LOAD_ANGLE
    this._tiltCb = () => this.selfTestPick()   // 【临时自检】调通后改回 null
    this._coins.forEach((c) => { c.loaded = false; c.anim = null })
    this.updateBtn({ phase: 'loading', loadCount: 0, tip: '拖动铜钱放入壳中（0/3）' })
  },

  // 三钱入壳后：壳立正 → 进入摇动阶段
  startShakePhase() {
    this._phase = 'shaking'
    this._hits = 0
    this._lastHitAt = 0
    this._released = false
    this._shaking = true
    this._shakeAmp = 1
    this.updateBtn({ phase: 'shaking', shaking: true, tip: '摇动手机，或连点下方按钮' })
  },

  // 一次有效晃动：壳摆一下，壳内铜钱翻个身
  addShakeHit() {
    this._hits += 1
    this._lastHitAt = Date.now()
    this._shakeAmp = 1
    this._coins.forEach((c) => {
      c.mesh.rotation.x += rand(-0.6, 0.6)
      c.mesh.rotation.y += rand(-0.6, 0.6)
    })
  },

  // 摇够且静止 → 前倾倒钱
  beginPour() {
    this._phase = 'pouring'
    this._tiltTarget = POUR_ANGLE
    this._tiltCb = null
    this._released = false
    this.updateBtn({ phase: 'pouring', tip: '' })
  },

  // 松钱：从壳口沿口朝向抛出（附向前初速让钱落在壳前桌面），交给自由落体物理
  releaseCoins() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this._shellPivot.quaternion)
    const mouth = this._shellPivot.position.clone().addScaledVector(dir, 1.0)
    this._coins.forEach((c) => {
      c.anim = null
      c.mesh.position.set(mouth.x + rand(-0.15, 0.15), mouth.y + rand(0, 0.12), mouth.z + rand(-0.15, 0.15))
      c.vel.set(dir.x * 3 + rand(-0.5, 0.5), dir.y * 3 - 0.4, dir.z * 3 + 1.2 + rand(-0.4, 0.4))
      c.angVel.set(rand(-10, 10), rand(-10, 10), rand(-10, 10))
      c.settled = false
    })
    this._phase = 'settling'
  },

  // 每帧更新：壳晃动 / 跃入动画 / 拨动回位 / 倒钱流程 / 铜钱物理
  update(dt) {
    // 龟壳晃动（每次有效晃动衰减摆动，模拟手摇）
    if (this._shakeAmp > 0.01 && this._shell) {
      this._shakeT += dt
      this._shell.rotation.z = this._shellBaseRotZ + Math.sin(this._shakeT * 28) * 0.06 * this._shakeAmp
      this._shakeAmp *= 0.96
    }

    // 铜钱跃入壳内动画（t<0 = 排队起跳）
    if (this._coins) {
      for (const c of this._coins) {
        if (!c.anim) continue
        c.anim.t += dt / HOP_DUR
        if (c.anim.t <= 0) continue
        const k = Math.min(c.anim.t, 1)
        c.mesh.position.lerpVectors(c.anim.from, c.anim.to, k)
        if (k >= 1) c.anim = null
      }
    }

    // 摇够了且静默 SHAKE_QUIET ms → 自动前倾倒钱（判定「摇动停止」）
    if (this._phase === 'shaking' && this._hits >= SHAKE_HITS &&
        this._lastHitAt && Date.now() - this._lastHitAt > SHAKE_QUIET) {
      this.beginPour()
    }

    if (this._shellPivot) {
      // 手势回位弹簧仅观赏态(idle)生效；仪式各阶段 pitch 由流程接管
      if (this._phase === 'idle' && !this._dragging && this._homing) {
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
      // 仪式姿态：tilt 向目标角指数趋近；前倾过门槛即松钱，到位后回调一次
      const diff = this._tiltTarget - this._tilt
      if (Math.abs(diff) > 0.01) {
        this._tilt += diff * Math.min(1, dt * TILT_SPEED)
        if (this._phase === 'pouring' && !this._released && this._tilt <= POUR_ANGLE * POUR_RELEASE) {
          this._released = true
          this.releaseCoins()
        }
      } else if (this._tiltCb) {
        const cb = this._tiltCb
        this._tiltCb = null
        cb()
      }
      this._shellPivot.rotation.y = this._shellYaw
      this._shellPivot.rotation.x = this._shellPitch + this._tilt
    }

    // 铜钱自由落体物理：仅 settling 阶段（倒出后到落定）
    if (this._phase !== 'settling') return
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
      this._phase = 'returning'   // 壳回正
      this._tiltTarget = 0
      this._tiltCb = () => { this._phase = 'idle'; this.setData({ phase: 'idle' }) }
      this.updateBtn({ shaking: false, phase: 'returning' })
      this.onCoinsSettled()       // 读面成爻
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
      // 卦成：重震一下，稍候跳排盘；下次起卦视为新卦，重新问所求
      this._asked = false
      wx.vibrateShort({ type: 'heavy', fail: () => {} })
      this.updateBtn({ lines, done: true, tip: backs + '背 → ' + y.name + '，卦成！' })
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
      this.updateBtn({ lines, tip: '第' + (pos + 1) + '爻：' + backs + '背 → ' + y.name + (y.dong ? '（动）' : '') })
    }
  },

  // 清零重摇
  onReset() {
    if (this._navTimer) { clearTimeout(this._navTimer); this._navTimer = null }
    this._shakeAmp = 0
    this._asked = false          // 重摇=新卦，下次起卦重新问所求
    this._qiu = ''
    this._phase = 'idle'
    this._tilt = 0
    this._tiltTarget = 0
    this._tiltCb = null
    this._dragCoin = null
    this._shaking = false
    if (this._coins) this._coins.forEach((c) => { c.anim = null; c.loaded = false })
    if (this._shell) this._shell.rotation.z = this._shellBaseRotZ
    this.placeCoinsIdle()
    this.updateBtn({ lines: [], done: false, qiu: '', phase: 'idle', loadCount: 0, shaking: false, tip: '已重置，摇一摇或点按钮起卦' })
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
      // 待起卦：晃手机=起卦；摇动阶段：计一次有效晃动
      if (this._phase === 'shaking') this.addShakeHit()
      else if (this._phase === 'idle') this.triggerShake()
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
    if (this._phase !== 'idle') return   // 仪式进行中不重复触发
    // 新起一卦（首次或卦成重开）先弹「问事签」记录所求；同卦续爻不再问
    if ((this.data.done || !this.data.lines.length) && !this._asked) {
      this.setData({ asking: true })
      return
    }
    if (this.data.done) this.onReset()   // 卦成后再摇 = 重新起卦
    this.beginLoad()
  },

  // 按钮文案集中计算（patch 为本次要一并 setData 的字段，优先取新值）
  updateBtn(patch) {
    const d = this.data
    const p = patch || {}
    const phase = 'phase' in p ? p.phase : this._phase
    const shaking = 'shaking' in p ? p.shaking : d.shaking
    const done = 'done' in p ? p.done : d.done
    const linesLen = p.lines ? p.lines.length : d.lines.length
    const loaded = 'loadCount' in p ? p.loadCount : this._loadCount
    let label
    if (phase === 'loading') label = '铜钱 ' + loaded + ' / 3'
    else if (shaking) label = '摇动中…'
    else if (done) label = '重新起卦'
    else if (linesLen) label = '摇第' + (linesLen + 1) + '爻'
    else label = '摇卦起卦'
    this.setData(Object.assign({ btnLabel: label }, p))
  },

  // ====== 问事签：起卦前默祷所求（可不填），为后续解读提供上下文 =====
  onQiuInput(e) { this.setData({ qiu: e.detail.value }) },
  onQiuConfirm() {
    this._qiu = (this.data.qiu || '').trim()
    this._asked = true
    this.setData({ asking: false })
    if (this.data.done) this.onReset()
    this.beginLoad()
  },
  onQiuSkip() {
    this._qiu = ''
    this._asked = true
    this.setData({ asking: false, qiu: '' })
    if (this.data.done) this.onReset()
    this.beginLoad()
  },

  // 横竖屏切换：画布与相机跟着新窗口尺寸走
  onResize() {
    if (!this._renderer || !this._camera) return
    const info = wx.getWindowInfo()
    this._winW = info.windowWidth
    this._winH = info.windowHeight
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
    // 装钱态：拾起一枚未入壳的铜钱（提起 0.3），拖动只移钱不转壳
    if (this._phase === 'loading') {
      const coin = this.pickCoin(t.clientX, t.clientY)
      console.log('[装钱] 触摸', t.clientX, t.clientY, coin ? '拾取成功' : '未命中')
      if (coin) {
        this._dragCoin = coin
        this._touchId = t.identifier
        coin.mesh.position.y = FLOOR_Y + 0.3
      }
      return
    }
    if (this._phase !== 'idle') return   // 其余仪式阶段壳由流程接管
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
    if (this._dragCoin) {                 // 拖钱：沿桌面平面平移
      const t = (e.touches || []).filter((x) => x.identifier === this._touchId)[0]
      if (t) this.moveCoinOnTable(this._dragCoin, t.clientX, t.clientY)
      return
    }
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
    if (this._dragCoin) {                 // 松钱：判定是否落入壳口
      const still = (e.touches || []).some((x) => x.identifier === this._touchId)
      if (!still) {
        this.dropCoin(this._dragCoin)
        this._dragCoin = null
      }
      return
    }
    if (!this._dragging) return
    const still = (e.touches || []).some((x) => x.identifier === this._touchId)
    if (!still) {
      this._dragging = false    // 手指全离开才松
      // 回位目标取最近整圈：不管转过多少圈，都走最短路径回到正面朝镜头
      this._homeYaw = Math.round(this._shellYaw / (Math.PI * 2)) * Math.PI * 2
      this._homing = true
    }
  },

  // ====== 装钱：射线拾取 / 桌面拖动 / 入壳判定 ======
  // 【临时自检】壳后仰到位后自动跑一次：把每枚未入壳铜钱中心投影回屏幕坐标再反向拾取，
  // 结果写进 tip + console——定位「铜钱没反应」断在哪一环（调通后整段删除）
  selfTestPick() {
    try {
      const unloaded = this._coins.filter((c) => !c.loaded)
      let ok = 0
      const detail = unloaded.map((c) => {
        const ndc = c.mesh.position.clone().project(this._camera)
        const px = (ndc.x + 1) / 2 * this._winW
        const py = (1 - ndc.y) / 2 * this._winH
        const hit = this.pickCoin(px, py) === c
        if (hit) ok++
        return hit + '@(' + px.toFixed(0) + ',' + py.toFixed(0) + ')'
      })
      console.log('[自检] 屏幕坐标→拾取', detail, '窗口', this._winW + 'x' + this._winH)
      this.setData({ tip: '自检 拾取' + ok + '/' + unloaded.length + ' ' + detail.join(' ') })
    } catch (err) {
      console.error('[自检] 异常', err)
      this.setData({ tip: '自检异常：' + ((err && err.message) || err) })
    }
  },

  pickCoin(cx, cy) {
    this._ray = this._ray || new THREE.Raycaster()
    this._ray.setFromCamera({
      x: (cx / this._winW) * 2 - 1,
      y: -(cy / this._winH) * 2 + 1
    }, this._camera)
    const hits = this._ray.intersectObjects(this._coins.map((c) => c.mesh), true)
    if (!hits.length) return null
    // 命中的是子网格：沿父链找到所属铜钱（已入壳的不可再拖）
    let o = hits[0].object
    while (o) {
      const c = this._coins.find((x) => x.mesh === o && !x.loaded)
      if (c) return c
      o = o.parent
    }
    return null
  },

  moveCoinOnTable(coin, cx, cy) {
    this._ray.setFromCamera({
      x: (cx / this._winW) * 2 - 1,
      y: -(cy / this._winH) * 2 + 1
    }, this._camera)
    const p = new THREE.Vector3()
    if (!this._ray.ray.intersectPlane(this._tablePlane, p)) return
    coin.mesh.position.x = clamp(p.x, -1.3, 1.3)
    coin.mesh.position.z = clamp(p.z, -0.3, 1.5)
  },

  dropCoin(coin) {
    coin.mesh.position.y = FLOOR_Y
    if (this._phase !== 'loading' || coin.loaded) return
    const c0 = this._shellPivot.position
    const dx = coin.mesh.position.x - c0.x
    const dz = coin.mesh.position.z - c0.z
    if (Math.sqrt(dx * dx + dz * dz) > LOAD_RADIUS) return   // 没入壳：留在原地可再拖
    // 入壳：跳进碗里
    coin.loaded = true
    coin.anim = {
      from: coin.mesh.position.clone(),
      to: new THREE.Vector3(c0.x + rand(-0.2, 0.2), c0.y - 0.35, c0.z + rand(-0.2, 0.2)),
      t: 0
    }
    this._loadCount += 1
    this.updateBtn()
    if (this._loadCount >= 3) {
      // 三钱齐：壳立正 → 摇动阶段
      this._phase = 'righting'
      this._tiltTarget = 0
      this._tiltCb = () => this.startShakePhase()
      this.updateBtn({ phase: 'righting', tip: '' })
    } else {
      this.setData({ tip: '拖动铜钱放入壳中（' + this._loadCount + '/3）' })
    }
  },

  onShakeTap() {
    // 初始化失败：整页重载（redirectTo 自身 = 干净的新实例，避免残留半初始化状态）
    if (this.data.failed) {
      wx.redirectTo({ url: '/package3d/pages/divination/divination', fail: () => {} })
      return
    }
    // 摇动阶段点按钮 = 补一次有效晃动（开发者工具模拟不了加速度计的兜底）
    if (this._phase === 'shaking') { this.addShakeHit(); return }
    this.triggerShake()
  },

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
    // 释放 GL 上下文：反复进出页面不释放，devtools/真机会耗尽上下文，
    // 表现为下次进入画布空白只剩浮层（时好时坏的根源）
    if (this._renderer) {
      try {
        this._renderer.dispose()
        if (this._renderer.forceContextLoss) this._renderer.forceContextLoss()
      } catch (e) { /* 上下文已失效则忽略 */ }
      this._renderer = null
    }
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
