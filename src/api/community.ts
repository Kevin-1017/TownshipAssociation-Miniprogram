import { request } from '@/utils/request'
import type { PageResult } from '@/types/api'
import type {
  CommentItem,
  CommentPayload,
  CommunityPost,
  CommunityPostPayload,
  CommunityQuery,
} from '@/types/community'

/**
 * 社区动态接口(美食基地 / 校园广场)。
 *
 * 一期无登录:发布与评论的作者为表单自由填写的昵称,点赞只做计数自增。
 * 后端契约见 docs/API.md;mock 路由见 src/mock/index.ts,三处需同步。
 */
export const communityApi = {
  /** 动态分页列表:按发布时间倒序,支持 type/cuisine/region/keyword 筛选 */
  getList: (params: CommunityQuery = {}) =>
    request<PageResult<CommunityPost>>({ url: '/tsa/community/posts', data: params, showLoading: false }),

  /** 动态详情:含评论列表 commentsList */
  getDetail: (id: string) =>
    request<CommunityPost>({ url: `/tsa/community/posts/${id}`, showLoading: false }),

  /** 发布动态,返回新动态 id(字符串) */
  publish: (payload: CommunityPostPayload) =>
    request<string>({
      url: '/tsa/community/posts',
      method: 'POST',
      data: payload as unknown as Record<string, unknown>,
      loadingText: '发布中',
    }),

  /** 点赞 +1,返回点赞后的总数 */
  like: (id: string) =>
    request<number>({ url: `/tsa/community/posts/${id}/like`, method: 'POST', showLoading: false }),

  /** 发表评论,返回新建的评论对象 */
  addComment: (id: string, payload: CommentPayload) =>
    request<CommentItem>({
      url: `/tsa/community/posts/${id}/comments`,
      method: 'POST',
      data: payload as unknown as Record<string, unknown>,
      loadingText: '发送中',
    }),
}
