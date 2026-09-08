import { request } from '@/utils/request'
import type { NoticeItem } from '@/types/notice'

export const noticeApi = {
  /** 公告数量有限,第一阶段不分页,置顶由后端排好序返回 */
  getList: () => request<NoticeItem[]>({ url: '/tsa/notices', showLoading: false }),
  getDetail: (id: string) => request<NoticeItem>({ url: `/tsa/notices/${id}` }),
}
