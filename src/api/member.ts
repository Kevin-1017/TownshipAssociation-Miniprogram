import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type {
  MemberDetail,
  MemberListItem,
  MemberMapPoint,
  MemberQuery,
  ProvinceStat,
} from '@/types/member'

/**
 * 成员相关的接口声明。
 *
 * 这一层只回答「有哪些接口、参数和返回值是什么」,不关心底下是 mock 还是真后端。
 * 新增接口请同步更新 docs/API.md 与 src/mock/index.ts 的路由表 —— 三处不一致
 * 是这类分层最容易出的问题。
 */
export const memberApi = {
  /** 地图专用:返回全部成员的轻量坐标点,不分页 */
  getMapData: () => request<MemberMapPoint[]>({ url: '/members/map-data', showLoading: false }),

  getList: (params: MemberQuery = {}) =>
    request<PageResult<MemberListItem>>({ url: '/members', data: params }),

  getDetail: (id: string) => request<MemberDetail>({ url: `/members/${id}` }),

  /** 按省统计成员数。第一阶段供排行榜用,将来供地图区域着色 */
  getProvinceStats: () => request<ProvinceStat[]>({ url: '/members/stats/province' }),
}
