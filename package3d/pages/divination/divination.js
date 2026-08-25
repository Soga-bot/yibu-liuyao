// package3d/pages/divination/divination.js
// 3D 起卦页：龟壳 + 三枚铜钱「拖钱入壳 → 摇动 → 倒出落定 → 读面成爻」
// 闭环：每摇一次读正反面成爻，摇满 6 爻自动带参跳转 pages/paipan 出完整盘。
// 入口：问事签独立页（package3d/pages/ask）确认所求后 redirect 进本页（q 参数），
// 场景就绪即自动进入装钱；弹卡式问事签已废弃——首进时原生画布层会压住 WebView
// 浮层（同层渲染偶发失效），弹卡与画布同页无解，拆独立页彻底避开。
// 真机增强：摇一摇手机=摇卦（加速度计）＋震动反馈；支持横竖屏（pageOrientation: auto）。
//
// 依赖（已放进分包 package3d/libs/three/）：
//   index.js        → createScopedThreejs（webpack 预打包整包，自洽无外部依赖）
//   gltf-loader.js  → registerGLTFLoader
// ⚠️ 模型必须是非 Draco 压缩的 glb（本 threejs-miniprogram 不含 DRACOLoader）
import { createScopedThreejs } from '../../libs/three/index.js'
import { registerGLTFLoader } from '../../libs/three/gltf-loader.js'
import { GUA_DATA } from '../../../data/gua.js'   // 卦成时报卦名（主包数据，分包可引）

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

// ====== 摇卦判面 ======
// glb 实证（tools 解析几何）：钱体圆盘法线沿 local Z（最薄轴 Z=0.033），
// 默认姿态是「立着」的；「乾隆通宝」汉字贴 +Z 面、满文贴 −Z 面 ⇒ 字面 = local +Z。
// 判面直接读盘面法线的世界方向：n.y < 0 即字面朝下 = 背面朝上（无需奇偶标定）。
// 平躺姿态 = 绕 X 转 ±90°（Euler(∓π/2,0,γ)，γ 为绕法线自转）。

// 三钱 → 爻（金钱卦标准：背为阳）
// 3背=老阳(动)｜0背=老阴(动)｜1背=少阳｜2背=少阴
const BACKS_TO_YAO = {
  3: { yin: false, dong: true,  name: '老阳', mark: 'O' },
  0: { yin: true,  dong: true,  name: '老阴', mark: 'X' },
  1: { yin: false, dong: false, name: '少阳', mark: '、' },
  2: { yin: true,  dong: false, name: '少阴', mark: '、、' }
}
// 读面播报（提示行 + 监测日志共用）：背数的传统说法
const BACKS_TEXT = { 3: '三背', 2: '两背一字', 1: '一背两字', 0: '三字' }

// ====== 摇一摇（加速度计）参数 ======
const ACC_INTERVAL = 'game'     // ~20ms，最流畅
const SHAKE_DELTA = 12          // 相邻两次读数 |Δx|+|Δy|+|Δz| 超过此值算一次有效摇晃
const SHAKE_COOLDOWN = 1200     // 两次触发最小间隔(ms)，防止一甩连触发

// ====== 装钱→摇动→倒出流程 ======
const SHAKE_HITS = 4           // 有效晃动达此次数 = 摇够
const SHAKE_QUIET = 800        // 摇够后静默该时长(ms)判定摇动停止，自动倒出
const LOAD_ANGLE = Math.PI / 6 // 装钱态：壳后仰 30°（微张口迎钱，原 86° 太翻）
const POUR_ANGLE = -1.65       // 倒钱态：壳前倾（口转向桌面；原 -1.9 过水平面 19°，近沿上翘太夸张）
const TILT_SPEED = 6           // 壳姿态角指数趋近系数（越大转得越快）
const POUR_RELEASE = 0.55      // 前倾角走过该比例时松钱
const PICK_PX = 55             // 铜钱拾取热区半径(px)：屏幕空间拾取，手指友好
// 装钱：三钱看作一个整体拖动，拖近洞口逐渐聚拢、洞口处最紧，到位依次跳入
const GROUP_ENTER = 0.8        // 簇心距壳心该半径内 = 到位，自动入壳
const GROUP_FAR = 1.8          // 簇心距壳心该距离外保持原间距（线性聚拢区间外沿）
const GROUP_TIGHT = 0.55       // 洞口处间距系数（1=原间距，0.55≈三钱相扣成簇）
const GROUP_LIFT = 0.25        // 整体提起高度（抓住=拿起一叠）
const HOP_DUR = 0.4            // 单枚跳入壳内动画时长(s)
const HOP_STAGGER = 0.45       // 三钱依次起跳间隔（HOP_DUR 的倍数）
const HOP_UP = 3.5             // 跳入路线：起点正上方提起高度（控制点1，先竖直拔起）
const HOP_OVER = 3.4           // 跳入路线：壳口上方高度（控制点2，越过口沿）
const HOP_FWD = 0.5            // 跳入路线：控制点2在碗心前方偏移（压住「从前面进」）
const HOP_SCALE = 0.18         // 跳入途中微放大（提起感）
const FLAT_DUR = 0.28          // 落定压平+滑位动画时长(s)：摊开在桌面，杜绝立着收场
const SETTLE_FORCE = 2500      // 倒出后该时长(ms)仍未落定的钱强制压平（乱滚/漂远保险丝）
const POUR_SLOTS = [[-0.5, 0.75], [0.5, 0.75], [0, 1.05]]   // 三钱落位(x,z)：上移0.3≈钱壳视距1/3（再近有倒壳扫入风险）
const POUR_T = 0.35            // 出壳抛射飞行时长(s)：初速按落位抛体反解

// ====== 刻爻上壳仪式（每得一爻：壳转背面刻录 → 停留赏看 → 转回正面续下一爻） ======
// 暗合古法龟甲刻辞；刻线挂在壳上随壳转，平时随手拨壳也能翻看已得之爻
const INSC_TURN = 0.7          // 转到背面 / 转回正面时长(s)
const INSC_CARVE = 0.45        // 爻线「刻出」动画时长(s)：从中点向两侧生长
const INSC_HOLD = 1.1          // 背面停留赏看时长(s)；卦成（第6爻）自动加长

const POS_SHORT = ['初', '二', '三', '四', '五', '上']

let THREE = null
// 热重载可能不触发 onUnload，旧实例渲染循环变僵尸抢帧（卡顿根源）——模块级强杀
let livePage = null

Page({
  data: {
    loading: true,
    status: '加载模型中…',
    shaking: false,
    lines: [],       // 已得爻（摇出顺序 = 初→上）：{yin, dong, name, mark, pos}
    done: false,     // 6 爻已满，已跳转/待重摇
    tip: '',         // 最近一爻结果 / 引导文案
    failed: false,   // 3D 初始化失败（画布/模型）：按钮变「重新加载」
    phase: 'idle',   // 流程阶段（按钮文案用）
    loadCount: 0,    // 已入壳铜钱数
    btnLabel: '摇卦起卦',  // 按钮文案（JS 集中算：wxml 深层三元编译不过）
    btnHidden: false       // 仪式阶段（装钱/立正/倒钱/落定/回正）隐藏按钮
  },

  onLoad(options) {
    this._accLast = null
    this._lastShakeAt = 0
    // 所问之事由问事签独立页经 q 参数带入（直接进本页则视为未问，流程照常）
    this._qiu = options && options.q ? decodeURIComponent(options.q).slice(0, 30) : ''
    console.log('[流程] 3D 页进入，所问 =', this._qiu || '(未填)')
  },
  // 画布在 onReady 创建（首次布局完成后）：onLoad 过早创建画布会让同层渲染
  // 挂接失败，原生画布层浮到所有浮层之上（首进看不到按钮/弹窗，刷新才恢复）
  onReady() {
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
    this._winW = info.windowWidth    // 触摸坐标 ↔ 屏幕投影换算用
    this._winH = info.windowHeight

    // 卦名贴图的离屏 2D 画布节点（小程序无 wx.createCanvas，WXML 藏一张 type=2d）
    wx.createSelectorQuery().select('#ink').fields({ node: true }).exec((r) => {
      this._inkNode = r[0] && r[0].node
    })

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
      // 壳背刻爻基准：刻线挂 shell 子节点，坐标必须是模型原生局部系（fitObject 的
      // 缩放/平移只作用于 shell 自身矩阵，子节点不受其约束）。整体包围盒 min.Y 还会
      // 被腿/裙边等凸出物拉低，故中央刻字带内逐顶点探测腹甲真实表面（见 measureShellBack）
      this._shellLocal = this.measureShellBack(shell)
      this._marksGroup = new THREE.Group()   // 刻线挂壳上：随壳转/翻，天生贴背
      shell.add(this._marksGroup)
      this._inscribedCount = 0               // 已刻爻数（重摇清零）
      this._inscribe = null                  // 刻录仪式时间线（进行中才有值）
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
      this._dragGroup = null
      this._released = false
      this._hits = 0
      this._pourAt = 0     // 倒出时刻（落定保险丝用，0=未在倒出）
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
    if (livePage && livePage !== this) livePage.stopLoopHard()
    livePage = this
    this.setData({ loading: false })
    this._clock = new THREE.Clock()
    this.resumeLoop()
    this.startAcc()
    // 所求已在问事签页确认：场景就绪直接开始装钱仪式
    console.log('[流程] 场景就绪，自动装钱')
    this.beginLoad()
  },

  // 铜钱状态对象（baseScale：fitObject 后的基础缩放，跳跃动画中放大、结束还原）
  makeCoin(mesh) {
    return {
      mesh,
      baseScale: mesh.scale.x,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      settled: true
    }
  },

  // 静态态：三枚铜钱平躺停在立壳前方的桌面（模型默认立姿，−90° 放平、字面朝上）
  placeCoinsIdle() {
    const slots = [[-0.5, 0.45], [0.5, 0.45], [0, 0.8]]
    this._coins.forEach((c, i) => {
      c.mesh.position.set(slots[i][0], FLOOR_Y, slots[i][1])
      c.mesh.rotation.set(-Math.PI / 2, 0, i * 0.6) // 平躺：法线(local Z)→竖直向上
      c.vel.set(0, 0, 0)
      c.angVel.set(0, 0, 0)
      c.anim = null
      c.flat = null
      c.settled = true
    })
  },

  // ====== 装钱→摇动→倒出流程 ======
  // 装钱态：壳保持竖直、可随意翻动；拖钱凑向壳口的过程中才逐渐后仰（见 moveGroupOnTable）
  // tip 可带上一爻播报（续爻时「已得N爻 · 拖钱归壳…」），首爻用默认引导
  beginLoad(tip) {
    this._phase = 'loading'
    this._loadCount = 0
    this._tiltTarget = 0
    this._tiltCb = null
    this._coins.forEach((c) => { c.loaded = false; c.anim = null })
    this.updateBtn({ phase: 'loading', loadCount: 0, tip: tip || '拖动三枚铜钱凑向壳口' })
  },

  // 三钱入壳后：壳立正 → 进入摇动阶段
  startShakePhase() {
    this._phase = 'shaking'
    this._hits = 0
    this._lastHitAt = 0
    this._released = false
    this._shaking = true
    this._shakeAmp = 1
    this.updateBtn({ phase: 'shaking', shaking: true, tip: '第' + (this.data.lines.length + 1) + '爻 · 摇一摇手机（或连点屏幕）' })
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

  // 松钱：从壳底前缘把三钱扇形抛向 POUR_SLOTS 三个落位（初速按抛体反解，
  // 飞行 POUR_T 秒途经落位），弹跳后由压平动画滑到各自落位——摊开、互不重叠、不压壳
  releaseCoins() {
    const p0 = this._shellPivot.position
    const mouth = new THREE.Vector3(p0.x, p0.y - 0.85, p0.z + 0.35)
    const slots = POUR_SLOTS.slice().sort(() => Math.random() - 0.5)   // 钱与落位随机配对
    this._coins.forEach((c, i) => {
      c.anim = null
      c.mesh.position.set(mouth.x + rand(-0.1, 0.1), mouth.y + rand(0, 0.1), mouth.z + rand(-0.1, 0.1))
      const tx = slots[i][0] + rand(-0.06, 0.06)
      const tz = slots[i][1] + rand(-0.06, 0.06)
      c.slot = { x: tx, z: tz }
      c.vel.set(
        (tx - c.mesh.position.x) / POUR_T,
        (FLOOR_Y - c.mesh.position.y + 0.5 * GRAVITY * POUR_T * POUR_T) / POUR_T,
        (tz - c.mesh.position.z) / POUR_T
      )
      c.angVel.set(rand(-10, 10), rand(-10, 10), rand(-10, 10))
      c.settled = false
    })
    this._phase = 'settling'
    this._pourAt = Date.now()
  },

  // 落定：停物理，交给压平动画——四元数 slerp 到「就近翻倒」的平躺姿态
  //（翻倒方向由法线 y 符号定，保留翻滚物理得出的正反面），同时滑到落位
  settleCoin(c) {
    c.vel.set(0, 0, 0)
    c.angVel.set(0, 0, 0)
    c.settled = true
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(c.mesh.quaternion)
    const qFlat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(n.y < 0 ? Math.PI / 2 : -Math.PI / 2, 0, rand(-0.6, 0.6))
    )
    c.flat = {
      t: 0,
      q0: c.mesh.quaternion.clone(),
      q1: qFlat,
      px: c.mesh.position.x, pz: c.mesh.position.z,
      tx: c.slot ? c.slot.x : c.mesh.position.x,
      tz: c.slot ? c.slot.z : c.mesh.position.z
    }
  },

  // 每帧更新：壳晃动 / 跃入动画 / 拨动回位 / 倒钱流程 / 铜钱物理
  update(dt) {
    // 龟壳晃动（每次有效晃动衰减摆动，模拟手摇）
    if (this._shakeAmp > 0.01 && this._shell) {
      this._shakeT += dt
      this._shell.rotation.z = this._shellBaseRotZ + Math.sin(this._shakeT * 28) * 0.06 * this._shakeAmp
      this._shakeAmp *= 0.96
    }

    // 铜钱跳入壳内动画（t<0 = 排队起跳）：三次贝塞尔
    // P0桌面 → C1起点正上方(竖直拔起) → C2壳口上方前方(越过口沿) → P2碗心(垂直落入)。
    // 直线/二次贝塞尔的弧鼓包不足，看起来仍平直穿壳身到中心，故用双控制点强化绕沿。
    if (this._coins) {
      for (const c of this._coins) {
        if (!c.anim) continue
        c.anim.t += dt / HOP_DUR
        if (c.anim.t <= 0) continue
        const k = Math.min(c.anim.t, 1)
        const a = c.anim
        const u = 1 - k
        const b0 = u * u * u
        const b1 = 3 * u * u * k
        const b2 = 3 * u * k * k
        const b3 = k * k * k
        c.mesh.position.set(
          b0 * a.from.x + b1 * a.c1.x + b2 * a.c2.x + b3 * a.to.x,
          b0 * a.from.y + b1 * a.c1.y + b2 * a.c2.y + b3 * a.to.y,
          b0 * a.from.z + b1 * a.c1.z + b2 * a.c2.z + b3 * a.to.z
        )
        const pulse = Math.sin(Math.PI * k)
        c.mesh.scale.setScalar(c.baseScale * (1 + HOP_SCALE * pulse))
        if (k >= 1) {
          c.mesh.position.copy(a.to)
          c.mesh.scale.setScalar(c.baseScale)
          c.anim = null
        }
      }
      // 落定压平+滑位：slerp 到就近翻倒的平躺姿态（字/背面由物理翻滚决定），滑到落位摊开
      for (const c of this._coins) {
        if (!c.flat) continue
        c.flat.t += dt / FLAT_DUR
        const k = Math.min(c.flat.t, 1)
        c.mesh.quaternion.copy(c.flat.q0).slerp(c.flat.q1, k)
        c.mesh.position.x = c.flat.px + (c.flat.tx - c.flat.px) * k
        c.mesh.position.z = c.flat.pz + (c.flat.tz - c.flat.pz) * k
        if (k >= 1) {
          c.mesh.quaternion.copy(c.flat.q1)
          c.mesh.position.x = c.flat.tx
          c.mesh.position.z = c.flat.tz
          c.flat = null
        }
      }
      // 三钱全部跳完（整体入壳）→ 壳立正进摇动阶段：钱落定碗内再立正，不穿帮
      if (this._phase === 'loading' && this._loadCount >= 3 &&
          this._coins.every((c) => !c.anim)) {
        this._phase = 'righting'
        this._tiltTarget = 0
        this._tiltCb = () => this.startShakePhase()
        this.updateBtn({ phase: 'righting', tip: '三钱入壳，立正待摇' })
      }
    }

    // 摇够了且静默 SHAKE_QUIET ms → 自动前倾倒钱（判定「摇动停止」）
    if (this._phase === 'shaking' && this._hits >= SHAKE_HITS &&
        this._lastHitAt && Date.now() - this._lastHitAt > SHAKE_QUIET) {
      this.beginPour()
    }

    if (this._shellPivot) {
      // 刻爻仪式：接管 yaw/pitch 走时间线（turn→carve→hold→back）
      if (this._inscribe) this.stepInscribe(dt)
      // 手势回位弹簧在 idle 与装钱期生效（装钱期壳可随意翻、松手回正）；其余仪式阶段流程接管
      if ((this._phase === 'idle' || this._phase === 'loading') && !this._dragging && this._homing) {
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
      this._shellPivot.rotation.y = this._shellYaw + Math.sin(this._shakeT * 10) * 0.3 * this._shakeAmp
      this._shellPivot.rotation.x = this._shellPitch + this._tilt +
        Math.sin(this._shakeT * 10 + 1.5) * 0.08 * this._shakeAmp
    }

    // 铜钱自由落体物理：仅 settling 阶段（倒出后到落定）
    if (this._phase !== 'settling') return
    for (const c of this._coins) {
      if (c.settled) continue   // 已落定彻底退出物理（压平动画只管姿态/滑位，别再碰它）

      // 保险丝：倒出太久还没落定的（乱滚/漂远速度一直降不下来）强制压平收场
      if (this._pourAt && Date.now() - this._pourAt > SETTLE_FORCE) {
        c.mesh.position.y = FLOOR_Y
        this.settleCoin(c)
        continue
      }

      c.vel.y -= GRAVITY * dt
      c.mesh.position.addScaledVector(c.vel, dt)
      // 桌面边界：别飞出视野（尤其朝镜头的 z 初速）
      c.mesh.position.x = clamp(c.mesh.position.x, -1.6, 1.6)
      c.mesh.position.z = clamp(c.mesh.position.z, -1.0, 1.7)
      c.mesh.rotation.x += c.angVel.x * dt
      c.mesh.rotation.y += c.angVel.y * dt
      c.mesh.rotation.z += c.angVel.z * dt

      if (c.mesh.position.y < FLOOR_Y) {
        c.mesh.position.y = FLOOR_Y
        c.vel.y = -c.vel.y * BOUNCE
        c.vel.x *= 0.35   // 落地狠搓水平速度：弹跳别冲过落位太远（压平动画会滑回去）
        c.vel.z *= 0.35
        c.angVel.multiplyScalar(0.5)

        if (Math.abs(c.vel.y) < 0.25 && c.vel.length() < SETTLE_VEL) this.settleCoin(c)
      }
    }
    // 全部落定 = 物理静止 + 压平动画播完（法线稳定才读面、壳才回正）
    if (this._coins.every((c) => c.settled && !c.flat)) {
      this._shaking = false
      this._phase = 'returning'   // 壳回正
      this._tiltTarget = 0
      // 回正后不直接待机：转背面刻录本爻，刻完再进下一爻装钱（见 beginInscribe）
      this._tiltCb = () => {
        this._phase = 'idle'
        this.setData({ phase: 'idle' })
        this.beginInscribe()
      }
      this.updateBtn({ shaking: false, phase: 'returning' })
      this.onCoinsSettled()       // 读面成爻
    }
  },

  // ====== 三钱成爻（闭环核心） ======
  // 铜钱全部落定：读正反面 → 数背 → 查表成爻 → 入 lines；满 6 爻跳排盘
  onCoinsSettled() {
    const faces = this._coins.map((c) => (isBackUp(c) ? '背' : '字')).join('·')
    const backs = this._coins.filter(isBackUp).length
    const y = BACKS_TO_YAO[backs]
    if (!y) {   // 理论不可达（0~3 之外），防御
      this.setData({ tip: '读面异常，请重摇' })
      return
    }
    // 监测：面是落定后从模型姿态读的（非隐藏随机数），屏幕所见即日志所记
    console.log('[读面]', faces, '→', BACKS_TEXT[backs] + '，' + y.name + (y.dong ? '（动爻）' : ''))
    const pos = this.data.lines.length          // 0=初爻
    const lines = this.data.lines.map((l) => Object.assign({}, l, { justSet: false }))
    lines.push({
      yin: y.yin, dong: y.dong, name: y.name, mark: y.mark,
      posName: POS_SHORT[pos] + '爻', justSet: true   // 新爻格弹入动画标记
    })
    wx.vibrateShort({ type: 'light', fail: () => {} })
    const brief = POS_SHORT[pos] + '爻 · ' + BACKS_TEXT[backs] + ' → ' + y.name + (y.dong ? '（动）' : '')

    if (lines.length >= 6) {
      // 卦成：重震一下，亮卦名；跳排在刻录仪式演完后（goPaipan）进行
      wx.vibrateShort({ type: 'heavy', fail: () => {} })
      const gname = (GUA_DATA[lines.map((l) => l.yin ? '0' : '1').join('')] || {}).name || ''
      this.updateBtn({ lines, done: true, tip: brief + '，卦成' + (gname ? '「' + gname + '」' : '') + '！' })
    } else {
      this.updateBtn({ lines, tip: brief })
    }
  },

  // ====== 刻爻上壳仪式（读面后由回正回调拉起） ======
  // 壳转背面 → 最新一爻刻上壳背 → 停留赏看 → 转回正面 →
  // 未满六爻：进装钱态等用户拖钱归壳（看得清、节奏自己掌握）；满六爻：跳排盘
  beginInscribe() {
    if (this._destroyed) return
    if (this.data.lines.length === this._inscribedCount) {   // 无新爻（读面异常防御）
      this.beginLoad('拖钱归壳，重摇此爻')
      return
    }
    this._phase = 'inscribing'
    this._dragging = false
    this._homing = false
    this._spinVel = 0
    this._pitchVel = 0
    const front = Math.round(this._shellYaw / (Math.PI * 2)) * Math.PI * 2   // 最近正面
    this._inscribe = {
      stage: 'turn', t: 0,
      y0: this._shellYaw, y1: front + Math.PI,   // 转到背面
      p0: this._shellPitch, p1: 0,
      bars: []
    }
    this.updateBtn({ phase: 'inscribing' })
  },

  // 仪式时间线（update 每帧驱动；手势在此阶段被禁，yaw/pitch 全归仪式接管）
  stepInscribe(dt) {
    const s = this._inscribe
    if (!s) return
    s.t += dt
    const isLast = this.data.lines.length >= 6
    if (s.stage === 'turn') {
      const k = ease01(Math.min(s.t / INSC_TURN, 1))
      this._shellYaw = s.y0 + (s.y1 - s.y0) * k
      this._shellPitch = s.p0 + (s.p1 - s.p0) * k
      if (s.t >= INSC_TURN) {
        s.stage = 'carve'; s.t = 0
        s.bars = this.carveLine(this.data.lines.length - 1)
        if (isLast) s.bars = s.bars.concat(this.carveGuaName())   // 卦成：上爻上方再刻卦名
      }
    } else if (s.stage === 'carve') {
      const k = ease01(Math.min(s.t / INSC_CARVE, 1))   // 从中点向两侧「刻出」
      s.bars.forEach((b) => {
        if (b.userData.growAll) b.scale.setScalar(Math.max(k, 0.02))   // 老阳○环整体长出
        else b.scale.x = Math.max(k, 0.02)
      })
      if (s.t >= INSC_CARVE) { s.stage = 'hold'; s.t = 0; this._inscribedCount += 1 }
    } else if (s.stage === 'hold') {
      if (s.t >= INSC_HOLD + (isLast ? 0.7 : 0)) {      // 卦成多停一拍，看完整个卦象
        s.stage = 'back'; s.t = 0
        s.y0 = this._shellYaw; s.y1 = s.y1 - Math.PI    // 转回正面
      }
    } else if (s.stage === 'back') {
      const k = ease01(Math.min(s.t / INSC_TURN, 1))
      this._shellYaw = s.y0 + (s.y1 - s.y0) * k
      if (s.t >= INSC_TURN) {
        this._inscribe = null
        this._shellYaw = s.y1
        this._homeYaw = s.y1
        this._shellPitch = 0
        this._phase = 'idle'
        this.setData({ phase: 'idle' })
        if (this.data.done) this.goResult()
        else {
          const n = this.data.lines.length
          this.beginLoad('第' + n + '爻已录 · 拖钱归壳，续摇第' + (n + 1) + '爻')
        }
      }
    }
  },

  // 壳局部系包围盒 + 腹甲面探测：返回 {min,size,backY}（模型原生坐标）。
  // 世界包围盒先除缩放/平移换回局部系；backY 取「刻字中央带」内最低顶点——
  // 腿/裙边/头尾在带外，拉不高刻字面，保证刻线贴的是腹甲真实表面。
  // 同时收集刻字带内全部顶点 _backPts：腹甲是弧面，整带一个 backY 垫平所有行，
  // 行在弧顶会沉进壳里（穿模）——每行要各自探测高度与倾角（见 probeRow）
  measureShellBack(shell) {
    shell.updateMatrixWorld(true)
    const wb = new THREE.Box3().setFromObject(shell)       // fit 后世界系（此刻未挂场景/未调姿）
    const s = shell.scale.x
    const min = wb.min.clone().sub(shell.position).divideScalar(s)
    const size = wb.getSize(new THREE.Vector3()).divideScalar(s)
    const bandX = size.x * 0.26
    const bandZ = size.z * 0.36
    const inv = new THREE.Matrix4().getInverse(shell.matrixWorld)
    const m = new THREE.Matrix4()
    const v = new THREE.Vector3()
    let backY = Infinity
    const pts = []
    shell.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return
      m.multiplyMatrices(inv, o.matrixWorld)               // 世界 → 壳局部
      const pos = o.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m)
        if (Math.abs(v.x) <= bandX && Math.abs(v.z) <= bandZ) {
          if (v.y < backY) backY = v.y
          pts.push({ x: v.x, y: v.y, z: v.z })
        }
      }
    })
    this._backPts = pts
    if (!isFinite(backY)) backY = min.y                    // 带内无顶点（理论不至）：退回整体盒
    return { min, size, backY }
  },

  // 行面探测：刻字带顶点里 z 落在行附近 ±0.6 行距的最低 y = 该行腹甲面高；
  // 前后两半的最低 y 之差 → 行倾角 pitch（笔道顺弧面微仰/俯，防穿模与悬空）。
  // 窗口收紧到本行（±0.6 行距）防邻行/裙边把面高压低；pitch 限幅防局部坏点打歪
  probeRow(zc) {
    const L = this._shellLocal
    const pts = this._backPts
    if (!pts || !pts.length) return { y: L.backY, pitch: 0 }
    const h = L.size.z * 0.06
    let yMid = Infinity
    let yA = Infinity
    let yB = Infinity
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k]
      const dz = p.z - zc
      if (dz < -h || dz > h) continue
      if (p.y < yMid) yMid = p.y
      if (dz < -0.3 * h) { if (p.y < yA) yA = p.y }
      else if (dz > 0.3 * h) { if (p.y < yB) yB = p.y }
    }
    if (!isFinite(yMid)) return { y: L.backY, pitch: 0 }
    if (!isFinite(yA)) yA = yMid
    if (!isFinite(yB)) yB = yMid
    // +z 端面高更高（yB>yA）时需抬起 +z 端：rotateX 负角（推导见刻痕注释）
    const pitch = Math.max(-0.35, Math.min(0.35, -Math.atan2(yB - yA, 1.3 * h)))
    return { y: yMid, pitch }
  },

  // 在壳背刻下第 i 爻（0=初）——「毛笔笔道」纯几何画法（不碰任何画布 API：
  // wx.createCanvas 是小游戏接口，小程序里不存在）。
  // 笔道 = 中心线微抖 + 端部收锋的变宽平面 Shape（零厚度，天生贴面无体积），
  // 两端半圆封口（圆头）。老阳=线中央刻○（线穿环）、老阴=中缝刻✕。
  // 局部轴向：腹甲面=backY，+Z→世界竖直。
  carveLine(i) {
    const L = this._shellLocal
    const len = L.size.x * 0.44             // 爻线长度（略收，避开两侧上翘的裙边）
    const gap = L.size.z * 0.1              // 六爻行距
    const line = this.data.lines[i]
    const z0 = L.min.z + L.size.z / 2 + (i - 2.5) * gap
    const row = this.probeRow(z0)           // 该行腹甲面高 + 顺弧倾角（防穿模与悬空）
    // 立于面「外」侧（局部 -Y 再让 0.02 行距）：行面是弧顶，放面内必被最高弧带顶穿；
    // 放面外则整行都在壳面之前，正对看不出浮起，也顺带避开 z-fighting
    const y0 = row.y - gap * 0.02
    const bake = Math.PI / 2 + row.pitch
    // 一道笔道：n+1 个中心点（纵向微抖 + 横向漂移），半宽正弦收锋（两头细中间丰）
    const brushGeo = (xc, l, w0) => {
      const n = 16
      const pts = []
      for (let k = 0; k <= n; k++) {
        const t = k / n
        pts.push([
          xc - l / 2 + l * t + rand(-0.008, 0.008) * l,
          rand(-0.025, 0.025) * gap,
          w0 * (0.4 + 0.6 * Math.sin(Math.PI * (0.12 + 0.76 * t))) * rand(0.93, 1.07)
        ])
      }
      const top = pts.map((p) => [p[0], p[1] + p[2]])
      const bot = pts.slice().reverse().map((p) => [p[0], p[1] - p[2]])
      const s = new THREE.Shape()
      s.moveTo(top[0][0], top[0][1])
      top.slice(1).forEach((p) => s.lineTo(p[0], p[1]))
      s.absarc(pts[n][0], pts[n][1], pts[n][2], Math.PI / 2, -Math.PI / 2, true)   // 端圆头
      bot.slice(1).forEach((p) => s.lineTo(p[0], p[1]))
      s.absarc(pts[0][0], pts[0][1], pts[0][2], -Math.PI / 2, Math.PI / 2, true)
      s.closePath()
      const g = new THREE.ShapeGeometry(s)
      // 烘焙平躺 + 行倾角：rotateX(π/2) 让法线 -Y 朝壳外、笔道落进 XZ 面；
      // pitch 为负时 +z 端抬起（顺弧面），mesh 的 rotation.y 留给面内摆角
      g.rotateX(bake)
      return g
    }
    const bars = []
    const add = (geo, y, opts) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1D1208 }))
      m.position.set(0, y, z0)
      if (opts && opts.ry) m.rotation.y = opts.ry
      if (opts && opts.growAll) m.userData.growAll = true
      m.scale.x = 0.02                          // 从中点向两侧「刻出」（carve 段驱动）
      this._marksGroup.add(m)
      bars.push(m)
    }
    if (line.yin) {
      // 两段外移、留宽中缝：✕ 尺寸按行距（局部 Z 长边）取值，缝宽按线长（局部 X 窄边），
      // 龟壳前后长左右窄，比例错位会把 ✕ 顶到线头上——缝放宽到 0.24·len 隔开
      add(brushGeo(-len * 0.32, len * 0.40, gap * 0.15), y0)
      add(brushGeo(len * 0.32, len * 0.40, gap * 0.15), y0)
      if (line.dong) {                          // 老阴 ✕：中缝两臂（更外侧错层防相交闪面）
        add(brushGeo(0, gap * 0.26, gap * 0.08), y0 - gap * 0.01, { ry: Math.PI / 4 })
        add(brushGeo(0, gap * 0.26, gap * 0.08), y0 - gap * 0.02, { ry: -Math.PI / 4 })
      }
    } else {
      add(brushGeo(0, len, gap * 0.15), y0)
      if (line.dong) {                          // 老阳 ○：环平贴面、线从环心穿过（错层防闪面）
        const r1 = gap * 0.20
        const s = new THREE.Shape()
        s.absarc(0, 0, r1, 0, Math.PI * 2, false)
        const hole = new THREE.Path()
        hole.absarc(0, 0, r1 - gap * 0.055, 0, Math.PI * 2, true)
        s.holes.push(hole)
        const g = new THREE.ShapeGeometry(s)
        g.rotateX(bake)
        add(g, y0 - gap * 0.01, { growAll: true })
      }
    }
    return bars
  },

  // 卦成：上爻上方刻卦名（上卦象+下卦象+卦名，如「地雷复」）。
  // 画字必须走 CanvasTexture：小程序没有 wx.createCanvas（小游戏接口），
  // 用 WXML 里藏的 type=2d 画布节点（init 时取好 _inkNode）
  carveGuaName() {
    const g = GUA_DATA[this.data.lines.map((l) => l.yin ? '0' : '1').join('')]
    if (!g) return []
    const label = (g.waiXiang || '') + (g.neiXiang || '') + g.name
    const cv = this._inkNode
    if (!cv) return []                   // 画布节点未就绪：跳过卦名，不崩刻录流程
    cv.width = 512                       // 2 的幂（WebGL1 NPOT 贴图不能建 mipmap）
    cv.height = 128
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, 512, 128)        // 画布节点跨局复用，先清残留
    ctx.fillStyle = '#1D1208'
    ctx.font = 'bold 96px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 256, 68)
    const L = this._shellLocal
    const gap = L.size.z * 0.1
    const w = gap * 4.2
    const nz = L.min.z + L.size.z / 2 + 3.6 * gap   // 上爻再上 1.1 行
    const row = this.probeRow(nz)                   // 同爻线：贴该处弧面高与倾角
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 128 / 512),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }))
    // 平躺贴背：法线从 +Z 转到 -Y（朝壳外），字头朝局部 +Z（世界竖直）+ 行倾角顺弧；
    // 与爻线同法立于面外侧，防弧顶顶穿
    m.rotation.x = Math.PI / 2 + row.pitch
    m.position.set(0, row.y - gap * 0.02, nz)
    m.scale.setScalar(0.02)
    m.userData.growAll = true
    this._marksGroup.add(m)
    return [m]
  },

  // 卦成跳独立结果页（刻录仪式收尾时调用，用户已看完壳背整卦）。
  // 结果页与手动排盘独立：同引擎同观感，但只读，不带录入/改爻交互
  goResult() {
    const yaoKey = this.data.lines.map((l) => l.yin ? '0' : '1').join('')
    const dongKey = this.data.lines.map((l) => l.dong ? '1' : '0').join('')
    wx.navigateTo({
      url: '/package3d/pages/result/result?yao=' + yaoKey + '&dong=' + dongKey +
           '&q=' + encodeURIComponent(this._qiu || ''),
      fail: () => this.setData({ tip: '跳转失败，请重试' })
    })
  },

  // 清零重摇（同一所问之内重摇，_qiu 保留）
  onReset() {
    this._inscribe = null          // 刻录仪式进行中重摇：取消时间线
    this._inscribedCount = 0
    if (this._marksGroup) {        // 壳背刻线全清（几何/贴图/材质逐一释放；每爻各持贴图）
      this._marksGroup.children.slice().forEach((m) => {
        this._marksGroup.remove(m)
        if (m.geometry) m.geometry.dispose()
        if (m.material && m.material.map) m.material.map.dispose()   // 裂痕/卦名 CanvasTexture
        if (m.material) m.material.dispose()
      })
    }
    this._shakeAmp = 0
    this._phase = 'idle'
    this._tilt = 0
    this._tiltTarget = 0
    this._tiltCb = null
    this._dragGroup = null
    this._shaking = false
    if (this._coins) this._coins.forEach((c) => { c.anim = null; c.loaded = false })
    if (this._shell) this._shell.rotation.z = this._shellBaseRotZ
    // 壳可能停在仪式半途的背面角度：给回位弹簧目标拉回正面
    this._homeYaw = Math.round(this._shellYaw / (Math.PI * 2)) * Math.PI * 2
    this._homing = true
    this.placeCoinsIdle()
    this.updateBtn({ lines: [], done: false, phase: 'idle', loadCount: 0, shaking: false, tip: '已重置，摇一摇或点按钮起卦' })
  },

  // 渲染循环
  loop() {
    if (!this._running || this._destroyed) return
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

  // 摇卦统一入口：按钮 / 摇一摇 / 待机点铜钱都走这里（所求已在问事签页问过）
  triggerShake() {
    if (this.data.loading || this.data.shaking) return
    if (this._phase !== 'idle') return   // 仪式进行中不重复触发
    if (this.data.done) {
      // 卦成后再摇 = 新的一卦：回问事签重新默祷
      wx.redirectTo({ url: '/package3d/pages/ask/ask', fail: () => {} })
      return
    }
    this.beginLoad()   // 首次起卦 / 同卦续爻：直接装钱
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
    // 装钱/立正/倒钱/落定/回正/刻录阶段藏按钮（摇动保留：连点=补晃动兜底）
    const hidden = ['loading', 'righting', 'pouring', 'settling', 'returning', 'inscribing'].indexOf(phase) >= 0
    this.setData(Object.assign({ btnLabel: label, btnHidden: hidden }, p))
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
    // 摇动阶段：点画布任意处 = 补一次有效晃动（工具模拟不了加速度计的兜底）
    if (this._phase === 'shaking') { this.addShakeHit(); return }
    // 待机时点/拖到铜钱 = 想起卦：等价点「摇卦起卦」按钮
    if (this._phase === 'idle' && this.pickCoin(t.clientX, t.clientY)) {
      this.triggerShake()
      return
    }
    // 装钱态：抓住任意一枚 = 拿起三钱整体（一起提起），拖动整体平移+渐聚拢
    if (this._phase === 'loading') {
      const coin = this.pickCoin(t.clientX, t.clientY)
      if (coin) {
        const rest = this._coins.filter((c) => !c.loaded)
        const cx = rest.reduce((s, c) => s + c.mesh.position.x, 0) / rest.length
        const cz = rest.reduce((s, c) => s + c.mesh.position.z, 0) / rest.length
        this._dragGroup = {
          cx, cz,
          offs: rest.map((c) => ({ c, ox: c.mesh.position.x - cx, oz: c.mesh.position.z - cz }))
        }
        this._touchId = t.identifier
        this._dragLX = t.clientX   // 像素增量拖动的基准
        this._dragLY = t.clientY
        this._dragDist = this._camera.position.distanceTo(coin.mesh.position)
        rest.forEach((c) => { c.mesh.position.y = FLOOR_Y + GROUP_LIFT })
        return
      }
      // 没抓到钱：落回手势拨壳（装钱期壳仍可随意翻动，保持竖直观赏）
    }
    if (this._phase !== 'idle' && this._phase !== 'loading') return   // 其余仪式阶段壳由流程接管
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
    if (this._dragGroup) {                // 拖钱整体：平移 + 越近洞口越聚拢
      const t = (e.touches || []).filter((x) => x.identifier === this._touchId)[0]
      if (t) this.moveGroupOnTable(t.clientX, t.clientY)
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
    if (this._dragGroup) {                // 松手：在洞口即入壳，否则落回桌面
      const still = (e.touches || []).some((x) => x.identifier === this._touchId)
      if (!still) this.releaseGroup()
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

  // ====== 装钱：屏幕空间拾取 / 三钱整体拖动 / 聚拢入壳 ======
  // 教训：本环境 Raycaster.intersectObjects 对模型 mesh 全 miss（矩阵已刷新仍 0 命中，
  // 壳同样 miss，疑为 threejs-miniprogram 构建裁剪），弃用几何求交改纯数学：
  // 拾取 = 投影铜钱中心到屏幕算距离；拖动 = 像素增量 × 该深度处世界/像素比。
  // 三钱看作一个整体：抓任意一枚全部跟随，拖近洞口间距线性收紧（洞口处最紧）。
  pickCoin(cx, cy) {
    this._camera.updateMatrixWorld()
    const v = new THREE.Vector3()
    let best = null
    let bestD = PICK_PX
    for (const c of this._coins) {
      if (c.loaded) continue
      v.copy(c.mesh.position).project(this._camera)
      const sx = (v.x + 1) / 2 * this._winW
      const sy = (1 - v.y) / 2 * this._winH
      const d = Math.sqrt((sx - cx) * (sx - cx) + (sy - cy) * (sy - cy))
      if (d < bestD) { bestD = d; best = c }
    }
    return best
  },

  // 拖钱过程中壳的后仰角：簇心距壳心越近越仰，GROUP_ENTER 处到满角（拖远回正，可逆）
  tiltForDist(d) {
    const p = 1 - clamp((d - GROUP_ENTER) / (GROUP_FAR - GROUP_ENTER), 0, 1)
    return LOAD_ANGLE * p
  },

  // 整体拖动三钱：像素增量 → 世界增量平移簇心；间距、壳后仰都随「距洞口距离」联动
  moveGroupOnTable(cx, cy) {
    const k = 2 * Math.tan(this._camera.fov * Math.PI / 360) * this._dragDist / this._winH
    const g = this._dragGroup
    g.cx = clamp(g.cx + (cx - this._dragLX) * k, -1.3, 1.3)
    g.cz = clamp(g.cz + (cy - this._dragLY) * k, -0.3, 1.5)
    this._dragLX = cx
    this._dragLY = cy
    // 聚拢系数：簇心距壳心 GROUP_FAR 外=原间距，GROUP_ENTER 内=最紧（线性过渡）
    const c0 = this._shellPivot.position
    const d = Math.sqrt((g.cx - c0.x) * (g.cx - c0.x) + (g.cz - c0.z) * (g.cz - c0.z))
    const s = GROUP_TIGHT + (1 - GROUP_TIGHT) * clamp((d - GROUP_ENTER) / (GROUP_FAR - GROUP_ENTER), 0, 1)
    this._tiltTarget = this.tiltForDist(d)   // 壳随拖钱渐后仰（update 里指数趋近，自带缓冲）
    g.offs.forEach((o) => {
      o.c.mesh.position.x = clamp(g.cx + o.ox * s, -1.3, 1.3)
      o.c.mesh.position.z = clamp(g.cz + o.oz * s, -0.3, 1.5)
    })
    if (d < GROUP_ENTER) this.enterShell()   // 拖到洞口：三钱依次跳入
  },

  // 松手：簇心已在洞口 → 直接入壳；否则三钱落回桌面（保持当前聚拢间距，壳按距离回正）
  releaseGroup() {
    const g = this._dragGroup
    this._dragGroup = null
    if (!g) return
    const c0 = this._shellPivot.position
    const d = Math.sqrt((g.cx - c0.x) * (g.cx - c0.x) + (g.cz - c0.z) * (g.cz - c0.z))
    this._tiltTarget = this.tiltForDist(d)
    if (d < GROUP_ENTER) this.enterShell()
    else g.offs.forEach((o) => { o.c.mesh.position.y = FLOOR_Y })
  },

  // 三钱整体入壳：从当前位置依次起跳（抛物线弧+微缩放），全部落定后壳立正
  // （立正时机在 update 里等动画做完，见「三钱全部跳完」分支）
  enterShell() {
    this._dragGroup = null
    this._tiltTarget = LOAD_ANGLE   // 入壳瞬间后仰锁定满角，张口接钱
    const c0 = this._shellPivot.position
    let i = 0
    this._coins.forEach((c) => {
      if (c.loaded) return
      c.loaded = true
      const from = c.mesh.position.clone()
      const to = new THREE.Vector3(c0.x + rand(-0.18, 0.18), c0.y - 0.35, c0.z + rand(-0.18, 0.18))
      // 双控制点：C1 起点正上方（先提起），C2 壳口上方·碗心前方（越沿后垂直落入）
      const c1 = new THREE.Vector3(from.x, from.y + HOP_UP, from.z)
      const c2 = new THREE.Vector3(to.x, to.y + HOP_OVER, to.z + HOP_FWD)
      c.anim = { from, to, c1, c2, t: -i * HOP_STAGGER }   // t<0 = 排队起跳，三钱一前一后
      i += 1
    })
    this._loadCount = 3
    this.updateBtn({ loadCount: 3, tip: '三钱入壳…' })
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
  // 强停本实例：杀渲染循环/传感器，释放 GL 上下文（onUnload 与热重载杀旧实例共用）
  stopLoopHard() {
    this._running = false
    this._destroyed = true
    this.stopAcc()
    if (this._renderer) {
      try {
        this._renderer.dispose()
        if (this._renderer.forceContextLoss) this._renderer.forceContextLoss()
      } catch (e) { /* 上下文已失效则忽略 */ }
      this._renderer = null
    }
  },
  onUnload() {
    this.stopLoopHard()
    this._inscribe = null
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

// 落定后判面：盘面法线（local +Z = 字面「乾隆通宝」，glb 实证）世界方向 n.y < 0
// ⇒ 字面朝下 = 背面朝上
function isBackUp(c) {
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(c.mesh.quaternion)
  return n.y < 0
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
// 平滑插值（smoothstep）：仪式转壳起步/收尾缓，中段快
function ease01(t) { return t * t * (3 - 2 * t) }
