import type { PageQuery } from './api'

/** 成员性别:0 未知 1 男 2 女 —— 与后端字典保持一致 */
export type Gender = 0 | 1 | 2

/**
 * 地图专用轻量结构。
 * 刻意只保留渲染必需字段:300 个标记点的传输体控制在几十 KB,
 * 后端实现这个接口时同样只 SELECT 这些列。
 */
export interface MemberMapPoint {
  id: string
  name: string
  avatarUrl: string
  lat: number
  lng: number
  province: string
  city: string
  industry: string
}

/** 列表项:地图点 + 展示用的补充字段 */
export interface MemberListItem extends MemberMapPoint {
  /** 区/县。汕头:金平区 龙湖区 澄海区 潮阳区 潮南区 濠江区 南澳县 */
  district: string
  company: string
  title: string
  graduationYear: number
}

/** 详情:全字段 */
export interface MemberDetail extends MemberListItem {
  gender: Gender
  major: string
  /** 毕业院校 —— mock 的关键词搜索会命中它 */
  school: string
  /** 毕业至今年数,由生成脚本算好,前端不再计算 */
  seniority: number
  /** 个人简介。后端字段名同为 intro */
  intro: string
  /** 联系方式是否对外可见 —— 前端据此决定是否渲染,后端必须同样做权限过滤 */
  contactVisible: boolean
  wechatId?: string
  phone?: string
  /** 入会时间 = 后端 createdAt,ISO 8601 字符串 */
  createdAt: string
  /**
   * 第一阶段恒为 '中国'。
   * 预留它是因为潮汕是最大侨乡之一、海外潮籍乡亲约 1500 万,
   * 第二阶段要展示海外分布。现在留字段,届时不返工。
   */
  country: string
}

/** type 别名而非 interface —— 见 types/api.d.ts 里 PageQuery 的注释 */
export type MemberQuery = PageQuery & {
  province?: string
  city?: string
  industry?: string
  /** 按姓名 / 公司 / 学校 模糊匹配 */
  keyword?: string
}

/** 按省统计的成员数,用于地图区域着色与排行榜(第二阶段) */
export interface ProvinceStat {
  province: string
  count: number
}
