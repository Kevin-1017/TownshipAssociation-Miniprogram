import { request, ASSOC_TOKEN_HEADER, ASSOC_STORAGE_KEY } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type {
  MemberDetail,
  MemberListItem,
  MemberMapPoint,
  MemberQuery,
  ProvinceStat,
} from '@/types/member'

/** 读取已核验的乡会身份令牌(没有则空串)。api 层直读 storage 有先例:authApi.logout 同款 */
function assocTokenFromStorage(): string {
  try {
    const raw = uni.getStorageSync(ASSOC_STORAGE_KEY) as string
    const parsed = raw ? (JSON.parse(raw) as { token?: string }) : null
    return parsed?.token ?? ''
  } catch {
    return ''
  }
}

/**
 * 成员相关的接口声明。
 *
 * 这一层只回答「有哪些接口、参数和返回值是什么」,不关心底下是 mock 还是真后端。
 * 新增接口请同步更新 docs/API.md 与 src/mock/index.ts 的路由表 —— 三处不一致
 * 是这类分层最容易出的问题。
 */
export const memberApi = {
  /** 地图专用:返回全部成员的轻量坐标点,不分页 */
  getMapData: () => request<MemberMapPoint[]>({ url: '/tsa/members/map-data', showLoading: false }),

  getList: (params: MemberQuery = {}) =>
    request<PageResult<MemberListItem>>({ url: '/tsa/members', data: params }),

  /**
   * 成员详情(乡会用户专享):带 X-Assoc-Token 头。
   * silentError=true —— 1301(未核验/身份过期)由详情页静默接管转「授权闸门」,
   * 不走统一 toast,「身份过期」不能表现为「网络异常」。
   */
  getDetail: (id: string) =>
    request<MemberDetail>({
      url: `/tsa/members/${id}`,
      header: { [ASSOC_TOKEN_HEADER]: assocTokenFromStorage() },
      silentError: true,
    }),

  /** 按省统计成员数。第一阶段供排行榜用,将来供地图区域着色 */
  getProvinceStats: () => request<ProvinceStat[]>({ url: '/tsa/members/stats/province' }),
}
