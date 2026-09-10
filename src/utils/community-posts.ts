import type { CommentItem, CommunityPost } from '@/types/community'

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

/**
 * 点赞计数 +1:找到 Storage 中对应帖子并 increment,写回。
 * 未找到则静默忽略(详情页可能读到已删帖)。
 */
export const incrementLikes = (postId: string): void => {
  const posts = loadUserPosts()
  const idx = posts.findIndex((p) => p.id === postId)
  if (idx !== -1) {
    posts[idx].likes += 1
    uni.setStorageSync(USER_POSTS_KEY, posts)
  }
}

/**
 * 追加评论:将新评论插入指定帖子的 commentsList 数组头部,写回 Storage。
 * @param postId 帖子 ID
 * @param comment 新评论对象
 */
export const appendComment = (postId: string, comment: CommentItem): void => {
  const posts = loadUserPosts()
  const idx = posts.findIndex((p) => p.id === postId)
  if (idx !== -1) {
    // 本地引用避免 TS 把 posts[idx] 每次当成新对象(无法收窄)
    const target = posts[idx]
    target.commentsList = [comment, ...(target.commentsList ?? [])]
    target.comments = (target.comments || 0) + 1
    uni.setStorageSync(USER_POSTS_KEY, posts)
  }
}
