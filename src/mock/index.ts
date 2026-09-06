import type { RequestOptions } from '@/utils/request'
import type { Result, PageResult } from '@/types/api'
import type {
  MemberDetail,
  MemberListItem,
  MemberMapPoint,
  MemberQuery,
  ProvinceStat,
} from '@/types/member'
import type { EventDetail, EventListItem, EventQuery } from '@/types/event'
import type { NoticeItem } from '@/types/notice'
import { delay } from './delay'
import membersRaw from './data/members.json'
import eventsRaw from './data/events.json'
import noticesRaw from './data/notices.json'

/**
 * 本地 mock 分发器。
 *
 * ★ 刻意模拟真实 HTTP 语义:方法 + 路径匹配、网络延迟、统一 Result 壳、404。
 *   不是为了拟真而拟真 —— 如果 mock 直接返回对象而真接口返回 {code,data},
 *   页面代码就得写两套,mock 的价值就没了。
 *
 * 路由表的 key 与 docs/API.md 里的接口清单一一对应。后端实现同一批路径时,
 * 把 .env.development 的 VITE_USE_MOCK 改成 false 即可,业务代码零改动。
 */

const members = membersRaw as MemberDetail[]
const events = eventsRaw as EventDetail[]
const notices = noticesRaw as NoticeItem[]

// ---------- 投影:全量成员 → 地图轻量点 ----------
/**
 * 300 条全字段约 180 KB,地图接口只取渲染必需的 8 个字段,压到约 40 KB。
 * 后端实现 /members/map-data 时同样应该只 SELECT 这些列。
 */
function toMapPoint(m: MemberDetail): MemberMapPoint {
  return {
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    lat: m.lat,
    lng: m.lng,
    province: m.province,
    city: m.city,
    industry: m.industry,
  }
}

/** 显式列举,而不是解构丢弃 —— 契约变化时这里会第一时间暴露,而不是悄悄多传字段 */
function toListItem(m: MemberDetail): MemberListItem {
  return {
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    lat: m.lat,
    lng: m.lng,
    province: m.province,
    city: m.city,
    industry: m.industry,
    district: m.district,
    company: m.company,
    title: m.title,
    graduationYear: m.graduationYear,
  }
}

// ---------- 各接口的 mock 实现 ----------
function pageMembers(data: MemberQuery = {}): PageResult<MemberListItem> {
  const { page = 1, pageSize = 20, province, city, industry, keyword } = data

  let list = members.filter((m) => {
    if (province && m.province !== province) return false
    if (city && m.city !== city) return false
    if (industry && m.industry !== industry) return false
    if (keyword) {
      const kw = keyword.trim().toLowerCase()
      const hay = `${m.name}${m.company}${m.school}${m.city}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })

  const total = list.length
  list = list.slice((page - 1) * pageSize, page * pageSize)
  return { list: list.map(toListItem), total, page, pageSize }
}

function countByProvince(): ProvinceStat[] {
  const map = new Map<string, number>()
  for (const m of members) map.set(m.province, (map.get(m.province) ?? 0) + 1)
  return [...map.entries()]
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count)
}

function pageEvents(data: EventQuery = {}): PageResult<EventListItem> {
  const { page = 1, pageSize = 10, status, city } = data
  let list = events.filter((e) => {
    if (status && e.status !== status) return false
    if (city && e.city !== city) return false
    return true
  })
  // 未开始的排前面,越近越前;已结束的按时间倒序
  list = list.sort((a, b) => {
    if ((a.status === 'upcoming') !== (b.status === 'upcoming')) {
      return a.status === 'upcoming' ? -1 : 1
    }
    const d = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    return a.status === 'upcoming' ? d : -d
  })
  const total = list.length
  list = list.slice((page - 1) * pageSize, page * pageSize)
  return {
    total,
    page,
    pageSize,
    list: list.map(toEventListItem),
  }
}

/** 列表接口不返回富文本正文与坐标,详情接口才返回 */
function toEventListItem(e: EventDetail): EventListItem {
  return {
    id: e.id,
    title: e.title,
    cover: e.cover,
    startTime: e.startTime,
    endTime: e.endTime,
    city: e.city,
    address: e.address,
    registeredCount: e.registeredCount,
    quota: e.quota,
    status: e.status,
  }
}

/** 当前登录成员。mock 阶段固定返回第一条,让「我的」页面有内容可看 */
function currentUser(): MemberDetail | null {
  return members[0] ?? null
}

// ---------- 路由表 ----------
type Handler = (opts: RequestOptions) => unknown

const staticRoutes: Record<string, Handler> = {
  'GET /members/map-data': () => members.map(toMapPoint),
  'GET /members': (o) => pageMembers((o.data ?? {}) as MemberQuery),
  'GET /members/stats/province': () => countByProvince(),
  'GET /events': (o) => pageEvents((o.data ?? {}) as EventQuery),
  'GET /notices': () => notices.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned)),
  'GET /user/me': () => currentUser(),
}

/** 带路径参数的接口,如 GET /members/m0001 */
const dynamicRoutes: Array<{
  method: string
  pattern: RegExp
  handler: (m: RegExpMatchArray, o: RequestOptions) => unknown
}> = [
  {
    method: 'GET',
    pattern: /^\/members\/(m\d{4})$/,
    handler: (m) => members.find((x) => x.id === m[1]) ?? null,
  },
  {
    method: 'GET',
    pattern: /^\/events\/(e\d{3})$/,
    handler: (m) => events.find((x) => x.id === m[1]) ?? null,
  },
  {
    method: 'GET',
    pattern: /^\/notices\/(n\d{3})$/,
    handler: (m) => notices.find((x) => x.id === m[1]) ?? null,
  },
  // 登录/注册在 mock 阶段是假接口:不校验 code,直接发一个假 token
  {
    method: 'POST',
    pattern: /^\/auth\/wechat-login$/,
    handler: () => ({ token: 'mock-token-for-development-only', user: currentUser() }),
  },
]

function matchDynamic(key: string): Handler | undefined {
  const [method, path] = key.split(' ')
  for (const r of dynamicRoutes) {
    if (r.method !== method) continue
    const matched = path.match(r.pattern)
    if (matched) return (opts) => r.handler(matched, opts)
  }
  return undefined
}

export async function mockDispatch<T>(opts: RequestOptions): Promise<Result<T>> {
  await delay()
  const key = `${opts.method ?? 'GET'} ${opts.url}`
  const handler = staticRoutes[key] ?? matchDynamic(key)

  if (!handler) {
    // 这条警告是有意留的:页面调了 mock 没实现的接口时,不能静默返回 undefined,
    // 否则学生只会看到「数据怎么是空的」,查半天。
    console.warn(`[mock] 未定义的接口: ${key}`)
    return { code: 404, message: `mock 未实现: ${key}`, data: null as unknown as T }
  }

  return { code: 0, message: 'ok', data: handler(opts) as T }
}
