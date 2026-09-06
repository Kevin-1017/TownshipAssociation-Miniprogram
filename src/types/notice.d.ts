export interface NoticeItem {
  id: string
  title: string
  summary: string
  content: string
  publishedAt: string
  /** 是否置顶,首页排序用 */
  pinned: boolean
}
