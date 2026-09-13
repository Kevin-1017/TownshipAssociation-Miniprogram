import { request } from '@/utils/request'
import type { RequestOptions } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type { EventDetail, EventListItem, EventQuery } from '@/types/event'

/** 展示控制透传:首页/事件列表要「失败降级空态」,不许弹 toast 打脸(与 api/member 同款) */
type SilentReadOptions = Partial<Pick<RequestOptions, 'showLoading' | 'silentError'>>

export const eventApi = {
  /** C5:公开接口,page/pageSize(默认 10,钳 1..50)/year 筛选,排序 start_time DESC */
  getList: (params: EventQuery = {}, opts?: SilentReadOptions) =>
    request<PageResult<EventListItem>>({ url: '/tsa/events', data: params, ...opts }),

  /** C6:查无返回业务码 1002(网络层会按壳 toast,详情页自行 catch 兜空态) */
  getDetail: (id: string) => request<EventDetail>({ url: `/tsa/events/${id}` }),

  // 报名接口(register)已删 —— D2 定案本期不做报名,activity_registration 表继续闲置
}
