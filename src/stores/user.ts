import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  TOKEN_KEY,
  ASSOC_STORAGE_KEY,
  ApiError,
  isMockMode,
  CODE_WECHAT_LOGIN_FAILED,
  CODE_TOO_MANY_REQUESTS,
} from '@/utils/request'
import type { SilentLoginState } from '@/utils/request'
import { authApi } from '@/api/auth'
import type { VerifyPhoneResult } from '@/types/auth'
import type { MemberDetail } from '@/types/member'

/** 已核验的乡会身份（持久化形状，与 storage 里存的一致） */
interface AssocIdentity {
  token: string
  name?: string
  role?: string
}

/**
 * 静默登录三态(修订 A4,[FE] 契约):ok / retryable / invalid。
 * 类型定义放在 utils/request(AuthHook 契约的一半,request 不能反依赖 store),
 * 这里 re-export 维持 `import { SilentLoginState } from '@/stores/user'` 的旧引用路径。
 */
export type { SilentLoginState }

/**
 * 取 wx.login 的 code。
 * ★ 与 request.ts rawRequest 同款教训:@dcloudio/types 的 Promise 约定随版本/平台漂移,
 *   这里用 success/fail 回调用法把返回值形状锁死。
 */
const wxLoginCode = (): Promise<string> =>
  new Promise((resolve, reject) => {
    uni.login({
      success: (res) => {
        if (res.code) {
          resolve(res.code)
          return
        }
        reject(new Error(`uni.login 未返回 code(${res.errMsg ?? 'unknown'})`))
      },
      fail: (err) => {
        // 静默链路不弹脸,失败原因(errno 在 errMsg 里)只留控制台给排查用
        console.warn('[user] uni.login 失败', err)
        reject(new Error('uni.login 失败'))
      },
    })
  })

/**
 * 微信登录态与当前会员资料。
 *
 * 微信登录态(Authorization: Bearer,loginId=裸 openid):
 * App 冷启动由 silentLogin 自动建立;后端重启导致旧 token 失效时,
 * 受保护接口的 401 由 request 层调 silentLogin({force:true})(跳过快路径,修订 A1)无感修复。
 *
 * assoc(乡会身份)是**另一套并存的身份**:verify-phone 核验签发、1301 链路,
 * 与登录态互不通用 —— logout/clearToken 只清微信侧,绝不动 assoc。
 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
  const profile = ref<MemberDetail | null>(null)

  const isLogin = computed(() => !!token.value)
  /** 三态:未登录 / 已登录未建档(本期所有新用户)/ 有档案 */
  const displayName = computed(() => {
    if (!isLogin.value) return '未登录的乡友'
    // trim+|| 而不是 ??:C7 建档分支允许 name 落空串(只改过手机号/头像的提交),
    // ?? 兜不住 '',名字行会渲染成空白、引导语永久消失
    const name = profile.value?.name?.trim()
    return name || '点击完善资料'
  })

  // ---------- 乡会身份（跨页面共享：地图弹窗标识/详情页闸门/我的页都可能读，且需持久化） ----------

  /** 从 storage 恢复：JSON 串反序列化失败（脏数据）时静默当作未核验 */
  const readAssocStorage = (): AssocIdentity | null => {
    try {
      const raw = uni.getStorageSync(ASSOC_STORAGE_KEY) as string
      if (!raw) return null
      const parsed = JSON.parse(raw) as AssocIdentity
      return parsed?.token ? parsed : null
    } catch {
      return null
    }
  }

  const assoc = ref<AssocIdentity | null>(readAssocStorage())
  const isAssocVerified = computed(() => !!assoc.value?.token)

  const saveAssoc = (res: VerifyPhoneResult) => {
    if (!res.verified || !res.token) return
    const identity: AssocIdentity = { token: res.token, name: res.name, role: res.role }
    assoc.value = identity
    uni.setStorageSync(ASSOC_STORAGE_KEY, JSON.stringify(identity))
  }

  /** 清乡会身份：核验失败 / 后端 1301（身份过期）时调用 */
  const clearAssoc = () => {
    assoc.value = null
    uni.removeStorageSync(ASSOC_STORAGE_KEY)
  }

  const setToken = (t: string) => {
    token.value = t
    uni.setStorageSync(TOKEN_KEY, t)
  }

  /** 用微信登录返回的 code 换取 token。mock 阶段 code 不校验 */
  const loginWithCode = async (code: string) => {
    const res = await authApi.wechatLogin(code)
    setToken(res.token)
    profile.value = res.user
  }

  const fetchProfile = async () => {
    if (!isLogin.value) return
    profile.value = await authApi.getProfile()
  }

  // ---------- 静默登录 ----------

  /** 单飞:冷启动、我的页按钮、request 层自愈共享同一次 wx.login + wechat-login */
  let silentLoginPending: Promise<SilentLoginState> | null = null

  const doSilentLogin = async (): Promise<SilentLoginState> => {
    try {
      const code = isMockMode() ? 'mock-code' : await wxLoginCode()
      await loginWithCode(code)
      return 'ok'
    } catch (err) {
      // 契约:绝不 throw、绝不 toast —— 这链路每次冷启动都跑,失败表现由调用方按三态决定
      console.warn('[user] silentLogin 失败', err)
      if (err instanceof ApiError) {
        // 1303 微信侧抖动 / 1306 限频:等一等就能成,当「登录失效」清态提示会误导(修订 A4)
        if (err.code === CODE_WECHAT_LOGIN_FAILED || err.code === CODE_TOO_MANY_REQUESTS) {
          return 'retryable'
        }
        return 'invalid' // 400(凭证无效)等终错
      }
      return 'retryable' // 无壳的网络/transport 异常:登录态未必失效,不清态
    }
  }

  const silentLogin = (opts?: { force?: boolean }): Promise<SilentLoginState> => {
    // 快路径只保护「主动登录」场景:isLogin 只看 storage 有无 token,后端重启后
    // 旧 token 已死但标志仍真 —— 401 自愈必须 force 跳过,否则重放用的是同一枚死 token(修订 A1)
    if (!opts?.force && isLogin.value) return Promise.resolve('ok')
    silentLoginPending ??= doSilentLogin().finally(() => {
      silentLoginPending = null
    })
    return silentLoginPending
  }

  /**
   * 契约钉住的布尔便捷位(仅 'ok' → true)。
   * request 层 401 自愈钩子已改接 silentLogin({force:true}) 直通三态 ——
   * retryable(1303/1306/网络抖动)不能当登录失效处理,布尔压不下这个区分(修订 A4)。
   */
  const relogin = async (): Promise<boolean> => (await silentLogin({ force: true })) === 'ok'

  /**
   * 清微信登录态的唯一出口:ref+storage 双写必须一起清(修订 A2)——
   * 漏清 ref 则 isLogin 恒真,受保护接口陷入「重登(秒回)→ 重放 → 401」死循环。
   */
  const clearToken = () => {
    token.value = ''
    uni.removeStorageSync(TOKEN_KEY)
    profile.value = null
  }

  /** 登出:先请求服务端注销会话(api 层吞错,绝不阻塞),再清本地;assoc 不动(两套身份解耦) */
  const logout = async () => {
    await authApi.logout()
    clearToken()
  }

  return {
    token,
    profile,
    isLogin,
    displayName,
    assoc,
    isAssocVerified,
    saveAssoc,
    clearAssoc,
    setToken,
    loginWithCode,
    fetchProfile,
    silentLogin,
    relogin,
    clearToken,
    logout,
  }
})
