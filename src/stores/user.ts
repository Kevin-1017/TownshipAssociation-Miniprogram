import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TOKEN_KEY, ASSOC_STORAGE_KEY } from '@/utils/request'
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
 * 登录态与当前会员资料。
 *
 * assoc(乡会身份)与 token(微信登录)是**两套并存的身份**:一期微信登录还是 mock 假登录、
 * 乡会身份靠 getPhoneNumber 核验，二期登录闭环后 assoc 并入登录态。
 * 因此 logout 只清登录 token，绝不动 assoc。
 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
  const profile = ref<MemberDetail | null>(null)

  const isLogin = computed(() => !!token.value)
  const displayName = computed(() => profile.value?.name ?? '未登录的乡友')

  // ---------- 乡会身份（跨页面共享：地图弹窗标识/详情页闸门/我的页都可能读，且需持久化） ----------

  /** 从 storage 恢复：JSON 串反序列化失败（脏数据）时静默当作未核验 */
  function readAssocStorage(): AssocIdentity | null {
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

  function saveAssoc(res: VerifyPhoneResult) {
    if (!res.verified || !res.token) return
    const identity: AssocIdentity = { token: res.token, name: res.name, role: res.role }
    assoc.value = identity
    uni.setStorageSync(ASSOC_STORAGE_KEY, JSON.stringify(identity))
  }

  /** 清乡会身份：核验失败 / 后端 1301（身份过期）时调用 */
  function clearAssoc() {
    assoc.value = null
    uni.removeStorageSync(ASSOC_STORAGE_KEY)
  }

  function setToken(t: string) {
    token.value = t
    uni.setStorageSync(TOKEN_KEY, t)
  }

  /** 用微信登录返回的 code 换取 token。mock 阶段 code 不校验 */
  async function loginWithCode(code: string) {
    const res = await authApi.wechatLogin(code)
    setToken(res.token)
    profile.value = res.user
  }

  async function fetchProfile() {
    if (!isLogin.value) return
    profile.value = await authApi.getProfile()
  }

  function logout() {
    authApi.logout()
    token.value = ''
    profile.value = null
    // 注意：不清 assoc —— 乡会身份与登录态一期解耦（见文件头注释）
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
    logout,
  }
})