import type { Result } from '@/types/api'
// mock 模块:开发期按需加载,生产构建通过 condition 剔除 (vue/tsconfig 的 moduleResolution 保证)
import { mockDispatch } from '@/mock'

export interface RequestOptions {
  /** 不含 baseURL,例如 '/members/map-data' */
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  /** 默认 true。地图静默刷新等场景传 false,避免每次闪 loading */
  showLoading?: boolean
  loadingText?: string
  /** 默认 false。为 true 时所有自动 toast 都跳过,由调用方自处理错误表现
   *  (详情页捕 1301 转「授权闸门」就是这种场景) */
  silentError?: boolean
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
/** 后端 API 前缀。uploadFile/buildFileUrl 也用它,故导出(勿再引出第二份 BASE_URL) */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

/** 当前是否走 mock 分发。登录链路(store)与调试面板都靠它判断,常量本身不导出 */
export const isMockMode = (): boolean => USE_MOCK

export const TOKEN_KEY = 'tsa_token'

// ---------- 乡会身份（传输契约常量放这里：这是项目唯一的网络出口） ----------
/** 乡会身份请求头:verify-phone 核验成功后签发的会话令牌 */
export const ASSOC_TOKEN_HEADER = 'X-Assoc-Token'
/** 本地存储 key:存 { token, name, role } 的 JSON 串,与登录 token 独立(一期两套身份并存) */
export const ASSOC_STORAGE_KEY = 'tsa_assoc'

/** 业务码约定,与 tsa-api 的 Result<T> 对齐。详见 docs/API.md */
export const CODE_SUCCESS = 200
export const CODE_UNAUTHORIZED = 401
/** 1301:查看资料仅限乡会会员(身份未核验/token 失效)。区别于网络异常,页面要能识别并自愈 */
export const CODE_ASSOC_ONLY = 1301
/** 1302:微信换号失败(code 无效/已消费/限频),可引导重新授权 */
export const CODE_PHONE_VERIFY_FAILED = 1302
/** 1303:微信登录失败(code 无效/已消费/风控/上游异常),稍后重试即可,不是登录失效 */
export const CODE_WECHAT_LOGIN_FAILED = 1303
/** 1306:登录/核验限频超限(IP 固定 60s 窗口),稍后重试即可 */
export const CODE_TOO_MANY_REQUESTS = 1306

/** 业务错误:携带业务码,让页面能按 code 分支处理(如 1301 → 亮授权闸门) */
export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 唯一网络出口。
 *
 * ★ 为什么不用 `await uni.request(...)` 而要自己包 Promise:
 *   @dcloudio/types 里同时存在两套 promisify 约定 ——
 *     PromisifySuccessResult        → Promise<Result>
 *     PromisifySuccessResultLegacy  → Promise<[any, Result]>
 *   走哪一套取决于 uni-app 版本与平台配置。显式传 success/fail 回调
 *   能把返回值形状锁死在自己手里,不受版本影响。
 *   这条已记入 docs/DEVELOPMENT.md §6.2。
 */
const rawRequest = <T>(opts: RequestOptions): Promise<Result<T>> => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(TOKEN_KEY)
    uni.request({
      url: API_BASE_URL + opts.url,
      method: opts.method ?? 'GET',
      data: opts.data as UniApp.RequestOptions['data'],
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.header,
      },
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        resolve(res.data as Result<T>)
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })
}

/**
 * 统一拆壳:页面永远只拿到 data,不需要写 try-catch,也不需要碰 code/message。
 * 这是 mock 与真后端能无感切换的关键 —— 两边给的是同一个壳。
 */
const unwrap = <T>(res: Result<T>, silentError: boolean): T => {
  if (res.code === CODE_SUCCESS) return res.data

  if (res.code === CODE_UNAUTHORIZED) {
    // 401 这里只抛壳、不弹 toast:清态/跳转/toast 全部挪到 withRelogin 的自愈失败分支 ——
    // 能被静默重登救回来的 401,用户应当全程无感(计划 F1)
    throw new ApiError(res.code, res.message)
  }

  if (!silentError) {
    uni.showToast({ title: res.message || '请求失败', icon: 'none' })
  }
  // 抛 ApiError 而非笼统 Error:1301(身份过期)这类码页面上要按 code 分支处理,
  // 不能与网络异常混为一谈。silentError 场景下页面自行 catch 并决定表现
  throw new ApiError(res.code, res.message)
}

// ---------- 登录态自愈(401 → 静默重登 → 重放) ----------

/**
 * 静默重登三态(修订 A4,[FE] 契约;定义从 stores/user.ts 挪来 —— 它是 AuthHook
 * 契约的一半,而 request 不许 import stores,类型也不能反着依赖):
 * ok=已换新 token,值得重放;retryable=1303/1306/网络抖动,登录态未必死,稍后可重试;
 * invalid=wechat-login 400 或其它终错。只有 invalid 允许清态+switchTab+失效 toast。
 */
export type SilentLoginState = 'ok' | 'retryable' | 'invalid'

export interface AuthHook {
  /**
   * 静默重登(内部走 silentLogin({force:true})),返回三态。
   * 为什么不是 boolean:压平后 'retryable' 也会走 handleAuthExpired —— 被限频/微信抖动时
   * 旧 token 多半还活着,却把用户从正在看的页面硬踢回「我的」+「登录已失效」假提示(修订 A4)。
   */
  relogin: () => Promise<SilentLoginState>
  /** 清登录态:store 的 clearToken,ref+storage 双清 —— 禁止在 request 层裸 removeStorageSync */
  clearSession: () => void
}

// 由 App.vue onLaunch 注入。为什么用钩子而不是 import store:
// request→stores→api→request 会成循环 import(本文件 :109 注释的教训同源)
let authHook: AuthHook | null = null

export const setAuthHook = (hook: AuthHook): void => {
  authHook = hook
}

/** 单飞:N 个并发 401 只触发一次重登 —— 一次 wx.login + 一次 wechat-login */
let reloginPromise: Promise<SilentLoginState> | null = null

const reloginOnce = async (): Promise<SilentLoginState> => {
  const hook = authHook
  // handler 缺失(App.vue 未注入 = 接线事故,运行时不可达):无从判断真实态,保守走终错出口
  if (!hook) return 'invalid'
  reloginPromise ??= Promise.resolve()
    .then(() => hook.relogin())
    .finally(() => {
      reloginPromise = null
    })
  try {
    return await reloginPromise
  } catch (err) {
    // 契约上 relogin 绝不 throw(silentLogin 全兜底),真 throw 也是接线 bug,同上按终错处理
    console.error('[request] 静默重登异常', err)
    return 'invalid'
  }
}

/** 「登录通道繁忙」节流窗口:单飞失败时 N 个并发 401 会各自 rethrow 原错误,不节流就叠弹互相盖脸 */
const BUSY_TOAST_GAP_MS = 5000
let lastBusyToastAt = 0

/** retryable 的出口:不清态、不 switchTab(token 未必死,下一条请求还可能自愈),只按节流提示稍后重试 */
const notifyLoginBusy = (silentError: boolean): void => {
  if (silentError) return
  const now = Date.now()
  if (now - lastBusyToastAt < BUSY_TOAST_GAP_MS) return
  lastBusyToastAt = now
  uni.showToast({ title: '登录通道繁忙,请稍后重试', icon: 'none' })
}

/** 终错(invalid)/二次 401 的统一出口:清态 → 跳「我的」→ toast(除非 silent) → 把原错误抛回调用方 */
const handleAuthExpired = (err: unknown, silentError: boolean): never => {
  // 必须走 store 的 clearSession:setToken 是 ref+storage 双写,只清 storage 的话
  // isLogin 恒真 → 每个受保护请求都会「重登(快路径秒回)→ 重放 → 401」死循环(修订 A2)
  authHook?.clearSession()
  // 我的页现在是原生 tab 页,navigateTo 会直接 fail,只能用 switchTab
  uni.switchTab({ url: '/pages/mine/index' })
  if (!silentError) {
    uni.showToast({ title: '登录已失效,请重新登录', icon: 'none' })
  }
  throw err
}

/**
 * 401 自愈骨架,request 与 uploadFile 共用(两处各写一遍迟早漂移):
 * run() 抛 ApiError(401) → 单飞重登 → 成功则重放一次。重放能带上新 token,
 * 是因为 rawRequest/dispatch 都在调用时现读 storage。
 * 重登失败按三态分流(修订 A4):retryable 只 toast+抛回原错误,invalid 才走清态+跳转。
 * /tsa/auth/** 前缀豁免:wechat-login/logout 自身 401 时重登必然再 401,不成守卫就成环。
 */
const withRelogin = async <T>(
  url: string,
  silentError: boolean,
  run: () => Promise<T>,
): Promise<T> => {
  const attempt = async (retried: boolean): Promise<T> => {
    try {
      return await run()
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === CODE_UNAUTHORIZED &&
        !url.startsWith('/tsa/auth/')
      ) {
        console.warn('[request] 401,尝试静默重登重放:', url)
        if (!retried) {
          const state = await reloginOnce()
          if (state === 'ok') return attempt(true)
          if (state === 'retryable') {
            // 1303/1306/网络抖动:登录态未必失效,清态+跳转会误导(修订 A4)
            notifyLoginBusy(silentError)
            throw err
          }
        }
        // invalid,或重登报成功但重放仍 401(拿到的 token 照样被拒):按会话真失效收口
        return handleAuthExpired(err, silentError)
      }
      throw err
    }
  }
  return attempt(false)
}

/**
 * mock 分支也像 rawRequest 那样把 storage token 拼成 Bearer 再进 mockDispatch。
 * 不带这一头,mock 的受保护接口(契约 m1)无从校验身份,
 * 「401 → 静默重登 → 重放」就只能在真后端下演练 —— 双模式对称是本轮整改的前提。
 */
const dispatch = <T>(options: RequestOptions): Promise<Result<T>> => {
  if (!USE_MOCK) return rawRequest<T>(options)
  const token = uni.getStorageSync(TOKEN_KEY)
  const opts: RequestOptions = token
    ? { ...options, header: { Authorization: `Bearer ${token}`, ...options.header } }
    : options
  return mockDispatch<T>(opts)
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const { showLoading = true, loadingText = '加载中', silentError = false } = options
  // loading 包住真分支的整个「请求+重登+重放」循环,中途不闪断;mock 无真实网络等待,不弹
  const showSpin = !USE_MOCK && showLoading
  if (showSpin) uni.showLoading({ title: loadingText, mask: true })
  try {
    return await withRelogin(options.url, silentError, async () => {
      try {
        return unwrap<T>(await dispatch<T>(options), silentError)
      } catch (err) {
        if (!(err instanceof ApiError)) {
          // 没有 Result 壳 = transport 层失败(断网/HTTP 非 200)。业务错的文案 unwrap 已弹过,
          // 不能再叠一层「网络异常」盖掉它 —— 旧代码真分支对所有异常都 toast,两分支表现不一致
          if (!silentError) {
            uni.showToast({ title: '网络异常,请稍后重试', icon: 'none' })
          }
          console.error('[request]', options.method ?? 'GET', options.url, err)
        }
        throw err
      }
    })
  } finally {
    if (showSpin) uni.hideLoading()
  }
}

// ---------- 文件上传(契约 C8/m5:头像与事件封面共用) ----------

/** 与 rawRequest 同源的理由:uni.uploadFile 的 Promise 约定同样被 @dcloudio/types 双形状污染,回调用法锁死返回 */
const rawUpload = (filePath: string): Promise<Result<{ path: string }>> => {
  return new Promise((resolve, reject) => {
    // storage 现读:401 重登后的重放必须拿到新 token,不能复用闭包里的旧值
    const token = uni.getStorageSync(TOKEN_KEY)
    uni.uploadFile({
      url: `${API_BASE_URL}/tsa/files`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        try {
          // uploadFile 的 res.data 是字符串(不像 uni.request 会自动反序列化),自己解析 Result 壳
          resolve(JSON.parse(res.data) as Result<{ path: string }>)
        } catch {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '文件上传失败')),
    })
  })
}

/**
 * 上传图片,成功 resolve 存储相对路径 `/tsa/files/<uuid>.<ext>`(入库用它,展示走 buildFileUrl)。
 * 失败 reject:transport 错为 Error,业务错为 ApiError(400=超限/类型不符),
 * 401 与 request 走同一条单飞重登 + 重放一次的路径。
 */
export const uploadFile = (filePath: string): Promise<string> => {
  if (USE_MOCK) {
    // m5:mock 不落盘,原样回传入参的本地临时路径 —— 选头像→预览链路纯 mock 也能演示
    return Promise.resolve(filePath)
  }
  return withRelogin('/tsa/files', false, async () => {
    try {
      return unwrap<{ path: string }>(await rawUpload(filePath), false).path
    } catch (err) {
      if (!(err instanceof ApiError)) {
        uni.showToast({ title: '网络异常,请稍后重试', icon: 'none' })
        console.error('[upload]', filePath, err)
      }
      throw err
    }
  })
}

/**
 * 存储相对路径(/tsa/files/xxx.jpg)→ 可直接展示的绝对地址。
 * 凡带 scheme 的一律直通:http(s) 绝对址、chooseAvatar/chooseImage 的临时路径
 * (wxfile://、blob:、http://tmp/)、mock 下 uploadFile 回显的本地路径 ——
 * 页面统一先过它,渲染处不需要感知当前是哪种模式。
 */
export const buildFileUrl = (path: string): string => {
  if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path)) return path
  return `${API_BASE_URL}${path}`
}
