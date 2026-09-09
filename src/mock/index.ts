import type { RequestOptions } from '@/utils/request'
import { ASSOC_TOKEN_HEADER } from '@/utils/request'
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
import type { FoundationRewardItem, FoundationDonationItem, RewardRecord, DonationRecord } from '@/types/foundation'
import { delay } from './delay'
import membersRaw from './data/members.json'
import eventsRaw from './data/events.json'
import noticesRaw from './data/notices.json'
import rewardsRaw from './data/foundation-rewards.json'
import donationsRaw from './data/foundation-donations.json'
import rewardsExpanded from './data/foundation-rewards-expanded.json'
import donationsExpanded from './data/foundation-donations-expanded.json'

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
const rewards = rewardsRaw as FoundationRewardItem[]
const donations = donationsRaw as FoundationDonationItem[]

// ---------- 投影:全量成员 → 地图轻量点 ----------
/**
 * 300 条全字段约 180 KB,地图接口只取渲染必需的 8 个字段,压到约 40 KB。
 * 后端实现 /members/map-data 时同样应该只 SELECT 这些列。
 */
const toMapPoint = (m: MemberDetail): MemberMapPoint => ({
    id: m.id,
    name: m.name,
    avatarUrl: m.avatarUrl,
    lat: m.lat,
    lng: m.lng,
    province: m.province,
    city: m.city,
    industry: m.industry,
  });

/** 显式列举,而不是解构丢弃 —— 契约变化时这里会第一时间暴露,而不是悄悄多传字段 */
const toListItem = (m: MemberDetail): MemberListItem => ({
    id: m.id,
    name: m.name,
    avatarUrl: m.avatarUrl,
    lat: m.lat,
    lng: m.lng,
    province: m.province,
    city: m.city,
    industry: m.industry,
    district: m.district,
    company: m.company,
    title: m.title,
    graduationYear: m.graduationYear,
  });

// ---------- 各接口的 mock 实现 ----------
const pageMembers = (data: MemberQuery = {}): PageResult<MemberListItem> => {
  const { page = 1, pageSize = 20, province, city, industry, keyword } = data;

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

const countByProvince = (): ProvinceStat[] => {
  const map = new Map<string, number>();
  for (const m of members) map.set(m.province, (map.get(m.province) ?? 0) + 1)
  return [...map.entries()]
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count)
}

const pageEvents = (data: EventQuery = {}): PageResult<EventListItem> => {
  const { page = 1, pageSize = 10, status, city } = data;
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
const toEventListItem = (e: EventDetail): EventListItem => ({
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
  });

/** 当前登录成员。mock 阶段固定返回第一条,让「我的」页面有内容可看 */
const currentUser = (): MemberDetail | null => members[0] ?? null;

/**
 * 详情投影:显式列举字段(契约变化第一时间暴露),并按隐私规则
 * contactVisible=false 时**剔除** wechatId/phone,与真实后端行为一致。
 */
const toDetailProjection = (m: MemberDetail): MemberDetail => {
  const detail: MemberDetail = {
    id: m.id,
    name: m.name,
    avatarUrl: m.avatarUrl,
    gender: m.gender,
    province: m.province,
    city: m.city,
    district: m.district,
    country: m.country,
    lat: m.lat,
    lng: m.lng,
    industry: m.industry,
    company: m.company,
    title: m.title,
    school: m.school,
    major: m.major,
    graduationYear: m.graduationYear,
    seniority: m.seniority,
    intro: m.intro,
    contactVisible: m.contactVisible,
    createdAt: m.createdAt,
  };
  if (m.contactVisible) {
    detail.wechatId = m.wechatId
    detail.phone = m.phone
  }
  return detail
}

// ---------- 乡会身份 mock ----------
/** mock 阶段固定令牌:verify-phone 下发它,详情接口认它 */
const MOCK_ASSOC_TOKEN = 'mock-assoc-token'

// ---------- 路由表 ----------
type Handler = (opts: RequestOptions) => unknown

const staticRoutes: Record<string, Handler> = {
  'GET /tsa/members/map-data': () => members.map(toMapPoint),
  'GET /tsa/members': (o) => pageMembers((o.data ?? {}) as MemberQuery),
  'GET /tsa/members/stats/province': () => countByProvince(),
  'GET /tsa/events': (o) => pageEvents((o.data ?? {}) as EventQuery),
  'GET /tsa/notices': () => notices.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned)),
  'GET /tsa/foundation': () => ({ rewards, donations }),
  'GET /tsa/foundation/rewards': () => {
    const records = rewardsExpanded as RewardRecord[]
    return {
      categories: [...new Set(records.map((r) => r.categoryName))],
      records,
    }
  },
  'GET /tsa/foundation/donations': () => {
    const all = donationsExpanded as DonationRecord[]
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },
  'GET /tsa/user/me': () => currentUser(),
  'POST /tsa/auth/verify-phone': (o) => {
    // mock 验证不了真实微信链路,职责是跑通「闸门与拒绝态」——
    // 除哨兵值外一律视为命中,拒绝路径用 mock-external-phone 手测
    const code = (o.data as Record<string, unknown> | undefined)?.code as string | undefined
    if (!code) return { code: 400, message: '缺少手机号授权码', data: null }
    if (code === 'mock-external-phone') return { verified: false }
    return {
      verified: true,
      token: MOCK_ASSOC_TOKEN,
      name: members[0]?.name ?? '测试会员',
      role: '会员',
    }
  },
}

/** 带路径参数的接口,如 GET /members/m0001 */
const dynamicRoutes: Array<{
  method: string
  pattern: RegExp
  handler: (m: RegExpMatchArray, o: RequestOptions) => unknown
}> = [
  {
    method: 'GET',
    pattern: /^\/tsa\/members\/(m\d{4})$/,
    handler: (m, o) => {
      // 成员详情是乡会用户专享:mock 里用 X-Assoc-Token 头模拟 1301 闸门,
      // 未核验(无头/令牌不符)返回业务错误壳,与真实后端同语义
      const auth = (o.header ?? {})[ASSOC_TOKEN_HEADER]
      if (auth !== MOCK_ASSOC_TOKEN) {
        return { code: 1301, message: '查看资料仅限乡会会员', data: null }
      }
      const member = members.find((x) => x.id === m[1])
      if (!member) return { code: 1002, message: '数据不存在', data: null }
      return toDetailProjection(member)
    },
  },
  {
    method: 'GET',
    pattern: /^\/tsa\/events\/(e\d{3})$/,
    handler: (m) => events.find((x) => x.id === m[1]) ?? null,
  },
  {
    method: 'GET',
    pattern: /^\/tsa\/notices\/(n\d{3})$/,
    handler: (m) => notices.find((x) => x.id === m[1]) ?? null,
  },
  // 登录/注册在 mock 阶段是假接口:不校验 code,直接发一个假 token
  {
    method: 'POST',
    pattern: /^\/tsa\/auth\/wechat-login$/,
    handler: () => ({ token: 'mock-token-for-development-only', user: currentUser() }),
  },
]

const matchDynamic = (key: string): Handler | undefined => {
  const [method, path] = key.split(' ');
  for (const r of dynamicRoutes) {
    if (r.method !== method) continue
    const matched = path.match(r.pattern)
    if (matched) return (opts) => r.handler(matched, opts)
  }
  return undefined
}

export async function mockDispatch<T>(opts: RequestOptions): Promise<Result<T>> {
  await delay();
  const key = `${opts.method ?? 'GET'} ${opts.url}`
  const handler = staticRoutes[key] ?? matchDynamic(key)

  if (!handler) {
    // 这条警告是有意留的:页面调了 mock 没实现的接口时,不能静默返回 undefined,
    // 否则学生只会看到「数据怎么是空的」,查半天。
    console.warn(`[mock] 未定义的接口: ${key}`)
    return { code: 404, message: `mock 未实现: ${key}`, data: null as unknown as T }
  }

  const result = handler(opts)
  // handler 可返回 data(包 200 壳),也可返回完整 {code,message,data} 壳
  // 模拟业务错误(1301/1002/400)。判断标准:带 code 键的按壳原样透传
  if (result !== null && typeof result === 'object' && 'code' in (result as object)) {
    return result as Result<T>
  }
  return { code: 200, message: 'ok', data: result as T }
}
