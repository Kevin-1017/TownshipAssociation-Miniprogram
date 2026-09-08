import { request, TOKEN_KEY } from '@/utils/request'
import type { VerifyPhoneResult } from '@/types/auth'
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
    request<LoginResult>({ url: '/tsa/auth/wechat-login', method: 'POST', data: { code } }),

  /**
   * 乡会身份核验:把 getPhoneNumber 按钮的动态 code 交给后端换手机号、比对乡会名册。
   *
   * ★ 这个 code 与 wechatLogin 的 code **不是同一个**:
   *   这里来自 <button open-type="getPhoneNumber"> 的 getphonenumber 回调,
   *   5 分钟有效、严格一次性,禁止缓存或对同一 code 重试。
   * 未命中名册是正常业务结果(verified=false,HTTP 200),不是报错。
   */
  verifyPhone: (code: string) =>
    request<VerifyPhoneResult>({
      url: '/tsa/auth/verify-phone',
      method: 'POST',
      data: { code },
      loadingText: '身份核验中',
    }),

  getProfile: () => request<MemberDetail | null>({ url: '/tsa/user/me' }),

  /** 本地登出:只清本地 token,不需要请求后端 */
  logout: () => {
    uni.removeStorageSync(TOKEN_KEY)
  },
}
