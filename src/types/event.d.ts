import type { PageQuery } from './api'

/** 事件状态,与后端字典一致 */
export type EventStatus = 'upcoming' | 'ongoing' | 'past' | 'cancelled'

export interface EventListItem {
  id: string
  title: string
  cover: string
  /** 事件时间,ISO 8601 字符串(不要传时间戳,避免时区歧义) */
  startTime: string
  endTime: string
  city: string
  address: string
  /** 已报名人数 */
  registeredCount: number
  /** 人数上限,0 表示不限 */
  quota: number
  status: EventStatus
}

export interface EventDetail extends EventListItem {
  /** 富文本正文。小程序端要用 rich-text 组件渲染,不能直接 v-html */
  content: string
  organizer: string
  contactPhone: string
  /** 事件举办地坐标,用于地图与将来的路线规划(GCJ-02) */
  lat: number
  lng: number
}

/** type 别名而非 interface —— 见 types/api.d.ts 里 PageQuery 的注释 */
export type EventQuery = PageQuery & {
  status?: EventStatus
  city?: string
}
