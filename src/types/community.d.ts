export type CommunityType = 'food' | 'campus'

export interface CommunityPost {
  id: string
  type: CommunityType
  author: string
  avatar: string
  title: string
  content: string
  /** 图片 URL 数组 */
  images: string[]
  /** 发布时间,ISO 8601 字符串 */
  publishTime: string
  likes: number
  comments: number
}
