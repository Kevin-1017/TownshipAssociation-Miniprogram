import { request } from '@/utils/request'
import type { VerifyPhoneResult } from '@/types/auth'
import type { MemberDetail } from '@/types/member'

export interface LoginResult {
  token: string
  /** null = 已登录但还没建档(本期所有新用户的初始态),契约 C1 要求该键恒出现在 JSON 里 */
  user: MemberDetail | null
}

export const authApi = {
  /**
   * 微信一键登录:把 wx.login 的 code 交给后端换 openid(真模式经 jscode2session,
   * login-mock-mode 下回固定 mock openid),换回 Sa-Token 登录态。
   *
   * ★ 必须静默:这调用在每次冷启动都会发生(App.vue → silentLogin),后端未起时
   *   弹脸 loading/toast 与「失败仅 console.warn」直接矛盾;失败表现由调用方
   *   按 silentLogin 的三态返回值决定(修订 A3)。
   */
  wechatLogin: (code: string) =>
    request<LoginResult>({
      url: '/tsa/auth/wechat-login',
      method: 'POST',
      data: { code },
      showLoading: false,
      silentError: true,
    }),

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

  /**
   * 当前登录会员资料(本人视角),data 可为 null = 已登录未建档。
   * 静默:onShow 会反复拉,避免闪 loading/双 toast;token 失效由 request 层 401 自愈兜。
   */
  getProfile: () =>
    request<MemberDetail | null>({ url: '/tsa/user/me', showLoading: false, silentError: true }),

  /**
   * 服务端注销(契约 C3):只注销当前 Bearer 会话,assoc 会话 loginId 不同、不受影响;
   * 无 token 也幂等 200。fire-and-forget —— 后端不可达时吞错照常返回,
   * 不能因网络问题把用户困在「已登录」。本地 storage 清理不在 api 层做,统一收口在 store。
   */
  logout: async (): Promise<void> => {
    try {
      await request<null>({
        url: '/tsa/auth/logout',
        method: 'POST',
        showLoading: false,
        silentError: true,
      })
    } catch {
      // 注销失败说明会话本就不可达/已死,本地清理由 store.logout 无条件完成
    }
  },
}
