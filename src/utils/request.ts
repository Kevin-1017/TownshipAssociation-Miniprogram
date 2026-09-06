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
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE_URL = import.meta.env.VITE_API_BASE_URL

export const TOKEN_KEY = 'tsa_token'

/** 业务码约定,与 tsa-api 的 Result<T> 对齐。详见 docs/API.md */
export const CODE_SUCCESS = 0
export const CODE_UNAUTHORIZED = 401

/**
 * 唯一网络出口。
 *
 * ★ 为什么不用 `await uni.request(...)` 而要自己包 Promise:
 *   @dcloudio/types 里同时存在两套 promisify 约定 ——
 *     PromisifySuccessResult        → Promise<Result>
 *     PromisifySuccessResultLegacy  → Promise<[any, Result]>
 *   走哪一套取决于 uni-app 版本与平台配置。显式传 success/fail 回调
 *   能把返回值形状锁死在自己手里,不受版本影响。
 *   这条已记入 docs/FAQ.md。
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
function unwrap<T>(res: Result<T>): T {
  if (res.code === CODE_SUCCESS) return res.data

  if (res.code === CODE_UNAUTHORIZED) {
    uni.removeStorageSync(TOKEN_KEY)
    uni.navigateTo({ url: '/pages/mine/index' })
  }

  uni.showToast({ title: res.message || '请求失败', icon: 'none' })
  throw new Error(res.message)
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const { showLoading = true, loadingText = '加载中' } = options

  // mock 分支用动态 import:生产构建时 USE_MOCK 为 false,
  // 整个 src/mock/ 目录会被 tree-shake 掉,不进包体。
  if (USE_MOCK) {
    const { mockDispatch } = await import('@/mock')
    return unwrap(await mockDispatch<T>(options))
  }

  if (showLoading) uni.showLoading({ title: loadingText, mask: true })
  try {
    return unwrap(await rawRequest<T>(options))
  } catch (err) {
    uni.showToast({ title: '网络异常,请稍后重试', icon: 'none' })
    console.error('[request]', options.method ?? 'GET', options.url, err)
    throw err
  } finally {
    if (showLoading) uni.hideLoading()
  }
}
