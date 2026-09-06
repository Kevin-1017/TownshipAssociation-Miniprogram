import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TOKEN_KEY } from '@/utils/request'
import { authApi } from '@/api/auth'
import type { MemberDetail } from '@/types/member'

/** 登录态与当前会员资料 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
  const profile = ref<MemberDetail | null>(null)

  const isLogin = computed(() => !!token.value)
  const displayName = computed(() => profile.value?.name ?? '未登录的乡友')

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
  }

  return { token, profile, isLogin, displayName, setToken, loginWithCode, fetchProfile, logout }
})
