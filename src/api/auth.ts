import { request, TOKEN_KEY } from '@/utils/request'
import type { MemberDetail } from '@/types/member'

export interface LoginResult {
  token: string
  user: MemberDetail | null
}

export const authApi = {
  /**
   * 微信一键登录。
   *
   * ★ mock 阶段这个接口不校验 code,直接发假 token —— 「我的」页面因此可以完整跑通,
   *   但**不代表登录逻辑已验证**。真实链路要等 tsa-api 提供 code2session,
   *   见 docs/API.md 的「鉴权」一节。
   */
  wechatLogin: (code: string) =>
    request<LoginResult>({ url: '/auth/wechat-login', method: 'POST', data: { code } }),

  getProfile: () => request<MemberDetail | null>({ url: '/user/me' }),

  /** 本地登出:只清本地 token,不需要请求后端 */
  logout: () => {
    uni.removeStorageSync(TOKEN_KEY)
  },
}
