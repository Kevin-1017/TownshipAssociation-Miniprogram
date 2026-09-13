import type { Gender } from './member'

/**
 * PUT /tsa/user/profile 请求体(契约 C7)。
 * 全部可选 —— 页面只提交「相对快照有改动」的字段,后端也只更这份白名单
 * (status/province/city/openid 不在其列,审核与归属由秘书处侧维护)。
 *
 * type 别名而非 interface —— request() 的 data 参数是 Record<string, unknown>,
 * interface 没有隐式索引签名,传参会报 "Index signature is missing"。
 */
export type ProfileUpdateRequest = {
  /** ≤32 字符 */
  name?: string
  /** 0 未知/保密 · 1 男 · 2 女 —— 与后端字典一致 */
  gender?: Gender
  phone?: string
  /** ≤32 字符 */
  wechatId?: string
  /** 1950..2100,后端校验 */
  graduationYear?: number
  /** ≤64 字符 */
  major?: string
  /** 个人简介/补充说明,≤200 */
  intro?: string
  /** 上传后的头像地址(buildFileUrl 拼出的绝对址,≤255) */
  avatarUrl?: string
}
