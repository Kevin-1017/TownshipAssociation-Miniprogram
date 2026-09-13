import type { PageQuery } from './api'

/**
 * 事件状态 —— C5 契约只剩两态,由后端拿 start_time 与当前时间派生(不落库)。
 * 旧的 ongoing/cancelled 随「报名」一起砍掉(D2:本期不做报名,事件只读)。
 */
export type EventStatus = 'upcoming' | 'past'

/**
 * 列表项 = 后端 EventListVO。
 * 正文不进小程序(D2 定案:详情靠跳公众号文章),所以没有 content/organizer/lat/lng;
 * 报名/名额字段(registeredCount/quota)随 activity_registration 一起继续躺表,不下发。
 */
export interface EventListItem {
  id: string
  title: string
  /** 封面;null = 秘书处还没传,渲染占位块 */
  cover: string | null
  /** 一句话简介(activity.summary 列);null = 未填 */
  summary: string | null
  /** 事件时间,ISO 8601 字符串(不要传时间戳,避免时区歧义) */
  startTime: string
  status: EventStatus
}

/**
 * 详情 = C6 形状。刻意不 extends EventListItem:status 只在列表下发(C5),
 * EventDetailVO 没有这个键 —— 继承会让消费方读到 undefined 而 TS 不报错。
 */
export interface EventDetail {
  id: string
  title: string
  /** 封面;null = 秘书处还没传,渲染占位块 */
  cover: string | null
  /** 一句话简介(activity.summary 列);null = 未填 */
  summary: string | null
  /** 事件时间,ISO 8601 字符串(不要传时间戳,避免时区歧义) */
  startTime: string
  /**
   * 公众号文章永久链接(/s/xxx)。wx.openOfficialAccountArticle 的目标地址,
   * null = 正文整理中,详情页按钮置灰。
   */
  articleUrl: string | null
}

/**
 * type 别名而非 interface —— 见 types/api.d.ts 里 PageQuery 的注释。
 * year 按 start_time 年份筛选(4 位数字),不传即全部;
 * 旧的 status/city 筛选随字段一起从契约里删了。
 */
export type EventQuery = PageQuery & {
  year?: number
}
