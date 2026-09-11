import type { PageQuery } from './api'

export type CommunityType = 'food' | 'campus'

/** 评论项 */
export interface CommentItem {
  id: string
  author: string
  avatar?: string
  content: string
  createTime: string // ISO 8601
  likes: number
}

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
  /** 评论列表(仅详情返回) */
  commentsList?: CommentItem[]
  /** 菜系名(仅美食基地动态携带;将来上后端字典后再换成枚举) */
  cuisine?: string
  /** 所在地区(仅美食基地动态携带,供筛选) */
  region?: CommunityRegion
}

/** 列表查询条件(用 type 别名,隐式索引签名可传给 request() —— 见 types/api.d.ts) */
export type CommunityQuery = PageQuery & {
  type?: CommunityType
  cuisine?: string
  region?: CommunityRegion
  keyword?: string
}

/** 发布动态请求体(无登录:author 为自由填写的昵称) */
export interface CommunityPostPayload {
  type: CommunityType
  author: string
  avatar?: string
  title: string
  content: string
  images?: string[]
  cuisine?: string
  region?: CommunityRegion
}

/** 发表评论请求体 */
export interface CommentPayload {
  author: string
  avatar?: string
  content: string
}
