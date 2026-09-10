import type { CommunityPost } from '@/types/community'

/**
 * 用户发布的动态:mock 阶段没有发布接口,先落本地 Storage,
 * 列表页 onShow 时与静态 mock 数据合并展示。
 * 联调后整份删除,改走 api/community.ts。
 */

const USER_POSTS_KEY = 'community_user_posts'

/** 读用户动态:Storage 里可能被改坏,解析失败时按空列表兜底而不是让页面崩 */
export const loadUserPosts = (): CommunityPost[] => {
  try {
    const raw = uni.getStorageSync(USER_POSTS_KEY)
    return Array.isArray(raw) ? (raw as CommunityPost[]) : []
  } catch {
    return []
  }
}

/** 新动态插到最前:列表按时间倒序,存的时候保持有序,读侧就不用再排 */
export const appendUserPost = (post: CommunityPost): void => {
  uni.setStorageSync(USER_POSTS_KEY, [post, ...loadUserPosts()])
}
