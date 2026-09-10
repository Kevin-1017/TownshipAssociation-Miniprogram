export type CommunityType = 'food' | 'campus'

/**
 * 所在地区:标准值为两个校区;发布表单选「其他」时存自由文本,
 * `(string & {})` 用于在放宽类型的同时保留两个字面量的编辑期补全。
 */
export type CommunityRegion = 'longdong' | 'daxuecheng' | (string & {})

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
  /** 菜系名(仅美食基地动态携带;将来上后端字典后再换成枚举) */
  cuisine?: string
  /** 所在地区(仅美食基地动态携带,供筛选) */
  region?: CommunityRegion
}
