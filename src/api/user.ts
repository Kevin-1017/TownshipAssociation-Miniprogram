import { request } from '@/utils/request'
import type { MemberDetail } from '@/types/member'
import type { ProfileUpdateRequest } from '@/types/user'

/**
 * 当前登录用户(微信 Bearer 会话)的资料写侧。
 * 读侧 GET /tsa/user/me 历史原因在 api/auth.ts(登录链路一体),这里不重复声明。
 */
export const userApi = {
  /**
   * C7 资料真保存:openid 由服务端从 Bearer loginId 推导(请求体没有它);
   * 首次提交 → 后端 INSERT status=0 待审 + source=1,已有行 → 白名单更新。
   * 200 回更新后的本人视角 MemberDetail。
   *
   * silentError=true:保存失败的正确表现是「留在编辑态 + 页面自己 toast」,
   * 网络层壳文案(如参数校验的字段提示)盖不住这个语境;401 仍由 request 层自愈。
   */
  saveProfile: (patch: ProfileUpdateRequest) =>
    request<MemberDetail>({
      url: '/tsa/user/profile',
      method: 'PUT',
      data: { ...patch },
      silentError: true,
    }),
}
