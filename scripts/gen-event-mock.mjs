/**
 * 生成大量活动 mock 数据，用于列表页虚拟滚动演示。
 *
 * 用法: node scripts/gen-event-mock.mjs [数量]
 * 默认生成 120 条,覆盖 2020-2026 各年。
 */

const cities = [
  '汕头市',
  '广州市',
  '深圳市',
  '东莞市',
  '佛山市',
  '潮州市',
  '揭阳市',
  '梅州市',
  '珠海市',
  '中山市',
  '惠州市',
  '江门市',
  '上海市',
  '北京市',
  '杭州市',
  '南京市',
  '成都市',
  '武汉市',
  '长沙市',
  '厦门市',
]

const industries = [
  '信息技术',
  '制造业',
  '教育',
  '医疗',
  '金融',
  '建筑',
  '餐饮',
  '文化',
  '法律',
  '房地产',
  '物流',
  '农业',
]

const titles = [
  '{year} 年度潮阳潮南校友会春节联谊大会',
  '乡贤企业行 · {city}{industry}产业带参访',
  '潮汕文化讲座: {theme}',
  '{city}同乡联谊会 · 中秋特别场',
  '青年乡贤创业分享会',
  '助学计划: {city}奖助学金发放仪式',
  '乡友圆桌: {theme}',
  '潮乐雅集 · 传统音乐演奏沙龙',
  '侨批与潮人文化研究研讨会',
  '{year}春季足球邀请赛',
  '乡贤表彰大会暨年度盛典',
  '潮汕工夫茶品鉴文化交流活动',
  '乡企对接洽谈会',
  '{city}新人新业交流沙龙',
  '潮汕美食文化节',
  '校友返乡寻根之旅',
  '乡会理事会换届选举大会',
  '潮剧演出与文化传承论坛',
  '{industry}行业领袖论坛',
  '海外潮籍青年探亲交流团来访',
]

const themes = [
  '从侨批看潮人下南洋',
  '应届生与转行者的秋夜夜话',
  '数字化转型与传统产业升级',
  '新生代潮商的精神传承',
  '一带一路中的潮汕力量',
  '潮菜走向世界的机遇与挑战',
]

const addresses = [
  '金平区海滨路 xx 号 · 国际大酒店宴会厅',
  '濠江区滨海大道 xxx 号 · 文化中心',
  '龙湖区天山路 xx 号会议室',
  '澄海区 XX 产业园 · 三楼多功能厅',
  '潮安区 XX 文化广场',
  '浮洋镇 XX 礼堂',
  'XX 中学大礼堂',
  'XX 商会大厦 x 楼会议厅',
  'XX 茶空间(报名后发送具体地址)',
  'XX 大学报告厅',
]

const organizers = [
  '乡会秘书处',
  '青年工作委',
  '文化委',
  '体育委',
  '助学基金',
  '在沪乡贤联络组',
  '在广州乡贤联络组',
  '在深圳乡贤联络组',
  '理事会',
]

// ---------- 工具函数 ----------
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)]
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/** 生成 ISO 8601 日期字符串 */
function isoDate(year, month, day, hour, minute) {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`
}

/** 根据状态推算 quota */
function makeQuota(status) {
  if (status === 'past') return rand(30, 200)
  if (status === 'cancelled') return 0
  return rand(20, 300)
}

// ---------- 核心生成逻辑 ----------
function generate(count = 120) {
  const events = []

  for (let i = 0; i < count; i++) {
    const year = rand(2020, 2026)
    const month = rand(1, 12)
    const day = rand(1, 28)
    const hour = rand(8, 18)
    const minute = rand(0, 59)

    let status
    const now = new Date()
    const evtDate = new Date(year, month - 1, day, hour, minute)
    if (evtDate > now) {
      status = rand(0, 4) === 0 ? 'upcoming' : 'upcoming'
    } else {
      status = rand(0, 3) === 0 ? 'past' : 'past'
    }

    const titleTemplate = pick(titles)
    const title = titleTemplate
      .replace('{year}', year)
      .replace('{city}', pick(cities))
      .replace('{industry}', pick(industries))
      .replace('{theme}', pick(themes))

    events.push({
      id: `e${String(i + 1).padStart(3, '0')}`,
      title,
      cover: '',
      startTime: isoDate(year, month, day, hour, minute),
      endTime: isoDate(year, month, day, hour + 2, minute),
      city: pick(cities),
      address: pick(addresses),
      registeredCount: rand(0, 200),
      quota: makeQuota(status),
      status,
      organizer: pick(organizers),
      contactPhone: `0${rand(10, 99)}-${rand(1000, 9999)}xxxx`,
      lat: rand(2200, 3200) / 100,
      lng: rand(11200, 12200) / 100,
      content: `这是一段关于"${title}"的介绍。\n\n活动详情将在报名成功后通过短信通知。`,
    })
  }

  // 按开始时间从近到远排序
  events.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

  return events
}

console.log(JSON.stringify(generate(Number(process.argv[2]) || 120), null, 2))
