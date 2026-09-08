/**
 * 认证/身份相关的接口契约。
 *
 * 与 tsa-api 的 VerifyPhoneVO 对齐；改任何一个字段都要同步后端 dto 与 docs/API.md。
 */
export interface VerifyPhoneResult {
  /** true=命中乡会名册（此时带 token），false=非乡会用户（正常业务结果，非报错） */
  verified: boolean
  /** 乡会身份令牌（仅 verified=true 时下发），后续详情接口放 X-Assoc-Token 请求头 */
  token?: string
  /** 名册姓名 */
  name?: string
  /** 乡会职务 */
  role?: string
}