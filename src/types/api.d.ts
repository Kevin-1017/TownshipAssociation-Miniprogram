/**
 * 后端统一响应壳 —— 这是与 tsa-api 的**契约**,不是随便定的。
 *
 * 将来 Spring Boot 侧必须返回同样形状:
 *   { "code": 0, "message": "ok", "data": {...} }
 *
 * 原因见 docs/API.md。小程序的 utils/request.ts 依赖这个形状做统一拆壳,
 * 页面因此永远只拿到 data,不需要处理 code/message。
 */
export interface Result<T> {
  /** 0 = 成功;非 0 为业务错误码,见 docs/API.md 错误码表 */
  code: number
  message: string
  data: T
}

/** 分页响应 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * 用 type 而不是 interface:TS 只在**类型别名**上推导隐式索引签名。
 * request() 的 data 参数是 Record<string, unknown>,若这里是 interface,
 * 传参会报 "Index signature is missing"。
 */
export type PageQuery = {
  page?: number
  pageSize?: number
}
