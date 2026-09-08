import type { Result } from '@/types/api'

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
const BASE_URL = import.meta.env.VITE_API_BASE_URL

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
function rawRequest<T>(opts: RequestOptions): Promise<Result<T>> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(TOKEN_KEY)
    uni.request({
      url: BASE_URL + opts.url,
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
function unwrap<T>(res: Result<T>, silentError: boolean): T {
  if (res.code === CODE_SUCCESS) return res.data

  if (res.code === CODE_UNAUTHORIZED) {
    // 401 是全局登录事件:无论谁触发都清 token 跳登录页,不受 silentError 影响
    uni.removeStorageSync(TOKEN_KEY)
    uni.navigateTo({ url: '/pages/mine/index' })
  }

  if (!silentError) {
    uni.showToast({ title: res.message || '请求失败', icon: 'none' })
  }
  // 抛 ApiError 而非笼统 Error:1301(身份过期)这类码页面上要按 code 分支处理,
  // 不能与网络异常混为一谈。silentError 场景下页面自行 catch 并决定表现
  throw new ApiError(res.code, res.message)
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const { showLoading = true, loadingText = '加载中', silentError = false } = options

  // mock 分支用动态 import:生产构建时 USE_MOCK 为 false,
  // 整个 src/mock/ 目录会被 tree-shake 掉,不进包体。
  if (USE_MOCK) {
    const { mockDispatch } = await import('@/mock')
    return unwrap(await mockDispatch<T>(options), silentError)
  }

  if (showLoading) uni.showLoading({ title: loadingText, mask: true })
  try {
    return unwrap(await rawRequest<T>(options), silentError)
  } catch (err) {
    if (!silentError) {
      uni.showToast({ title: '网络异常,请稍后重试', icon: 'none' })
    }
    console.error('[request]', options.method ?? 'GET', options.url, err)
    throw err
  } finally {
    if (showLoading) uni.hideLoading()
  }
}
