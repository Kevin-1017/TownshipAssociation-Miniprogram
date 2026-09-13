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
import type { EventDetail, EventListItem, EventQuery, EventStatus } from '@/types/event'
import type { NoticeItem } from '@/types/notice'
import type {
  FoundationRewardItem,
  FoundationDonationItem,
  RewardRecord,
  DonationRecord,
} from '@/types/foundation'
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
/**
 * events.json 是 D2 改造前的旧行形状(city/quota/content 等字段仍躺在数据里,
 * 等秘书处整理时自然会补 summary/article_url)。mock 只投影契约 C5/C6 用到的列。
 */
interface RawEventRow {
  id: string
  title: string
  cover: string
  startTime: string
  summary?: string
  articleUrl?: string | null
}
const events = eventsRaw as RawEventRow[]
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
})

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
})

// ---------- 各接口的 mock 实现 ----------
const pageMembers = (data: MemberQuery = {}): PageResult<MemberListItem> => {
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

const countByProvince = (): ProvinceStat[] => {
  const map = new Map<string, number>()
  for (const m of members) map.set(m.province, (map.get(m.province) ?? 0) + 1)
  return [...map.entries()]
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count)
}

/** C5:status 由服务端比较 start_time 与当前时间派生(客户端时间不可信的教训不变) */
const deriveEventStatus = (startTime: string): EventStatus =>
  new Date(startTime).getTime() > Date.now() ? 'upcoming' : 'past'

/** 列表投影显式列举字段(契约变化这里第一时间暴露);summary/articleUrl 见 RawEventRow 注释 */
const toEventListItem = (e: RawEventRow): EventListItem => ({
  id: e.id,
  title: e.title,
  cover: e.cover,
  summary: e.summary ?? null,
  startTime: e.startTime,
  status: deriveEventStatus(e.startTime),
})

/** C6:详情形状与列表不同源(status 只在列表),不能 spread 列表投影带出多余键 */
const toEventDetail = (e: RawEventRow): EventDetail => ({
  id: e.id,
  title: e.title,
  cover: e.cover,
  summary: e.summary ?? null,
  startTime: e.startTime,
  articleUrl: e.articleUrl ?? null,
})

/**
 * C5 语义:page(默认1)/pageSize(默认10,钳 1..50)/year(按 start_time 年份);
 * 排序 start_time DESC —— 旧「未开始置顶」的排序随 status 筛选一起作废,与后端对齐。
 */
const pageEvents = (data: EventQuery = {}): PageResult<EventListItem> => {
  const { page = 1, pageSize = 10, year } = data
  const size = Math.min(Math.max(pageSize, 1), 50)
  let list = events.filter((e) => {
    if (year && new Date(e.startTime).getFullYear() !== year) return false
    return true
  })
  list = list.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  const total = list.length
  list = list.slice((page - 1) * size, page * size)
  return { list: list.map(toEventListItem), total, page, pageSize: size }
}

/** 当前登录成员。MOCK_PROFILE_NULL(m2)控制「已登录有档案/无档案」两态 */
const currentUser = (): MemberDetail | null => (MOCK_PROFILE_NULL ? null : (members[0] ?? null))

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
  }
  if (m.contactVisible) {
    detail.wechatId = m.wechatId
    detail.phone = m.phone
  }
  return detail
}

// ---------- 乡会身份 mock ----------
/** mock 阶段固定令牌:verify-phone 下发它,详情接口认它 */
const MOCK_ASSOC_TOKEN = 'mock-assoc-token'

// ---------- 微信登录态 mock（契约 m1/m2/m3） ----------
/**
 * 「已登录无档案」演练开关(本期所有新用户的初始态):
 * true 时 wechat-login 的 data.user 与 user/me 都回 null,可在纯 mock 下走查
 * displayName「点击完善资料」→ profile 页无档案提示这条链路。验收完记得改回 false。
 */
const MOCK_PROFILE_NULL = false

/** mock wechat-login 签发的令牌;request 的 mock 分支会把 storage token 拼成 Bearer 带头,与这里比对 */
const MOCK_LOGIN_TOKEN = 'mock-token-for-development-only'

/**
 * 受保护接口的登录态校验(m1):头不对就回 401 壳 —— 与真后端 Sa-Token 拦截器同语义。
 * 没有它,「401 → 静默重登 → 重放」整条自愈链路在 USE_MOCK=true 下演练不到(计划 §9.12)。
 */
const requireLoginBearer = (
  o: RequestOptions,
): { code: number; message: string; data: null } | null =>
  (o.header ?? {})['Authorization'] === `Bearer ${MOCK_LOGIN_TOKEN}`
    ? null
    : { code: 401, message: '未登录或登录已过期', data: null }

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
  'GET /tsa/user/me': (o) => requireLoginBearer(o) ?? currentUser(),
  // C3:无守卫、无 token 幂等 200 data:null(mock 无服务端会话可注销,直接回空壳)
  'POST /tsa/auth/logout': () => null,
  // C7 假合并:合法头时返回 currentUser() 按请求体覆盖后的 MemberDetail。
  // 无档案(MOCK_PROFILE_NULL)时真后端会 INSERT 待审行;mock 直接拿 members[0] 打底覆盖,
  // 只为让 profile 页在纯 mock 下能走通「提交→回显」,不模拟 status 语义
  'PUT /tsa/user/profile': (o) => {
    const denied = requireLoginBearer(o)
    if (denied) return denied
    const patch = (o.data ?? {}) as Partial<MemberDetail>
    return { ...members[0], ...patch }
  },
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
    handler: (m) => {
      const e = events.find((x) => x.id === m[1])
      // C6:查无回 1002 壳,不能再「200 + data:null」装成功
      if (!e) return { code: 1002, message: '数据不存在', data: null }
      return toEventDetail(e)
    },
  },
  {
    method: 'GET',
    pattern: /^\/tsa\/notices\/(n\d{3})$/,
    handler: (m) => notices.find((x) => x.id === m[1]) ?? null,
  },
  // 登录在 mock 阶段是假接口:不校验 code,直接发假 token;user 跟随 m2 开关回 null(新用户无档案态)
  {
    method: 'POST',
    pattern: /^\/tsa\/auth\/wechat-login$/,
    handler: () => ({ token: MOCK_LOGIN_TOKEN, user: currentUser() }),
  },
]

const matchDynamic = (key: string): Handler | undefined => {
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

  const result = handler(opts)
  // handler 可返回 data(包 200 壳),也可返回完整 {code,message,data} 壳
  // 模拟业务错误(1301/1002/400)。判断标准:带 code 键的按壳原样透传
  if (result !== null && typeof result === 'object' && 'code' in (result as object)) {
    return result as Result<T>
  }
  return { code: 200, message: 'ok', data: result as T }
}
