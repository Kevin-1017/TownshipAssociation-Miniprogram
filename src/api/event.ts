import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type { EventDetail, EventListItem, EventQuery } from '@/types/event'

export const eventApi = {
  getList: (params: EventQuery = {}) =>
    request<PageResult<EventListItem>>({ url: '/events', data: params }),

  getDetail: (id: string) => request<EventDetail>({ url: `/events/${id}` }),

  /** 第二阶段实现:报名需要后端做并发与幂等控制 */
  register: (id: string) =>
    request<{ ok: boolean }>({ url: `/events/${id}/register`, method: 'POST' }),
}
