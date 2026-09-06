/**
 * 生成 src/mock/data/members.json —— 300 条潮汕乡贤模拟数据。
 *
 * 用法:node scripts/gen-mock.mjs
 *
 * 为什么是 .mjs 而不是 .ts:项目没有装 ts-node / tsx,preset 的 TypeScript 4.9
 * 也无法直接跑 .ts 脚本。用原生 ESM 可以让这个脚本零依赖直接运行,
 * 学生改完数据 `node scripts/gen-mock.mjs` 一条命令重新生成。
 *
 * 为什么用带种子的伪随机而不是 Math.random():
 *   随机数据会让 bug 无法复现 —— 上一秒能复现的渲染问题,重新生成后就没了。
 *   固定种子保证每次输出完全一致,同时看起来仍然是真实分布。
 *
 * ★ 分布刻意不均匀。潮汕乡会的真实人口结构是「本地极密 + 珠三角极密 + 全国散点」,
 *   均匀撒点会让地图看不出任何信息,也让点聚合演示不出效果。
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/mock/data/members.json')

// ---------- 确定性伪随机(mulberry32) ----------
const SEED = 20260906
function makeRng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = makeRng(SEED)
const pick = (arr) => arr[Math.floor(rng() * arr.length)]
const intBetween = (min, max) => min + Math.floor(rng() * (max - min + 1))
/** 坐标扰动:避免几百个点完全叠在同一像素上 */
const jitter = (v, deg) => v + (rng() - 0.5) * 2 * deg

// ---------- 家乡:汕头 ----------
// 坐标为 GCJ-02(腾讯/高德地图拾取器出来的即是),与微信 map 底图同坐标系。
// 详见 docs/MAP.md 的坐标系一节。
const HOMETOWN = {
  province: '广东省',
  city: '汕头市',
  // 六区一县,各自有中心点,扰动幅度小(同一市内本来就该密)
  districts: [
    { name: '金平区', lat: 23.3537, lng: 116.6819 }, // 老城中心
    { name: '龙湖区', lat: 23.3767, lng: 116.7207 },
    { name: '澄海区', lat: 23.4656, lng: 116.7576 }, // 玩具之都
    { name: '潮阳区', lat: 23.2575, lng: 116.6015 }, // 内衣针织
    { name: '潮南区', lat: 23.2498, lng: 116.4351 },
    { name: '濠江区', lat: 23.2856, lng: 116.7103 },
    { name: '南澳县', lat: 23.4212, lng: 117.0247 }, // 海岛,人少
  ],
}

/** 其他城市:省 / 市 / 中心坐标 / 本地主导产业(code 对齐 src/constants/industry.ts) */
const CITIES = {
  // 潮汕本地(同乡会成员老家或家属所在地)
  chaozhou: {
    province: '广东省',
    city: '潮州市',
    lat: 23.657,
    lng: 116.622,
    industry: 'manufacture',
    note: '陶瓷',
  },
  jieyang: {
    province: '广东省',
    city: '揭阳市',
    lat: 23.5498,
    lng: 116.3728,
    industry: 'manufacture',
    note: '五金电镀',
  },
  // 珠三角 —— 潮商在外最集中的区域
  guangzhou: { province: '广东省', city: '广州市', lat: 23.1291, lng: 113.2644, industry: 'trade' },
  shenzhen: {
    province: '广东省',
    city: '深圳市',
    lat: 22.5431,
    lng: 114.0579,
    industry: 'internet',
  },
  dongguan: {
    province: '广东省',
    city: '东莞市',
    lat: 23.0207,
    lng: 113.7518,
    industry: 'manufacture',
  },
  foshan: {
    province: '广东省',
    city: '佛山市',
    lat: 23.0218,
    lng: 113.1219,
    industry: 'construction',
  },
  zhuhai: { province: '广东省', city: '珠海市', lat: 22.2707, lng: 113.5768, industry: 'trade' },
  zhongshan: {
    province: '广东省',
    city: '中山市',
    lat: 22.517,
    lng: 113.393,
    industry: 'manufacture',
  },
  huizhou: {
    province: '广东省',
    city: '惠州市',
    lat: 23.1135,
    lng: 114.4161,
    industry: 'manufacture',
  },
  // 长三角
  shanghai: {
    province: '上海市',
    city: '上海市',
    lat: 31.2304,
    lng: 121.4737,
    industry: 'finance',
  },
  hangzhou: {
    province: '浙江省',
    city: '杭州市',
    lat: 30.2741,
    lng: 120.1551,
    industry: 'internet',
  },
  ningbo: { province: '浙江省', city: '宁波市', lat: 29.8683, lng: 121.544, industry: 'trade' },
  wenzhou: { province: '浙江省', city: '温州市', lat: 28.0, lng: 120.6994, industry: 'trade' },
  nanjing: {
    province: '江苏省',
    city: '南京市',
    lat: 32.0603,
    lng: 118.7969,
    industry: 'education',
  },
  suzhou: {
    province: '江苏省',
    city: '苏州市',
    lat: 31.2989,
    lng: 120.5853,
    industry: 'manufacture',
  },
  // 京津冀
  beijing: { province: '北京市', city: '北京市', lat: 39.9042, lng: 116.4074, industry: 'civil' },
  tianjin: {
    province: '天津市',
    city: '天津市',
    lat: 39.3434,
    lng: 117.3616,
    industry: 'logistics',
  },
  // 其他省会 —— 稀疏散点,用于演示地图缩放
  chengdu: { province: '四川省', city: '成都市', lat: 30.5728, lng: 104.0668, industry: 'food' },
  wuhan: { province: '湖北省', city: '武汉市', lat: 30.5928, lng: 114.3055, industry: 'education' },
  changsha: { province: '湖南省', city: '长沙市', lat: 28.2278, lng: 112.9388, industry: 'media' },
  xiamen: { province: '福建省', city: '厦门市', lat: 24.4798, lng: 118.0894, industry: 'trade' },
  fuzhou: { province: '福建省', city: '福州市', lat: 26.0745, lng: 119.2965, industry: 'trade' },
  kunming: {
    province: '云南省',
    city: '昆明市',
    lat: 24.8801,
    lng: 102.8329,
    industry: 'agriculture',
  },
  xian: {
    province: '陕西省',
    city: '西安市',
    lat: 34.3416,
    lng: 108.9398,
    industry: 'construction',
  },
}

/**
 * 区域配额 —— 合计 300。
 * 潮汕本地给最高权重,是为了让 join-cluster 聚合效果肉眼可见。
 */
const QUOTA = [
  { key: '__hometown__', weight: 92 },
  { key: 'chaozhou', weight: 14 },
  { key: 'jieyang', weight: 14 }, // 潮汕本地 120 = 40%
  { key: 'guangzhou', weight: 26 },
  { key: 'shenzhen', weight: 26 },
  { key: 'dongguan', weight: 16 },
  { key: 'foshan', weight: 10 },
  { key: 'zhuhai', weight: 6 },
  { key: 'zhongshan', weight: 5 },
  { key: 'huizhou', weight: 10 }, // 珠三角 99 = 33%
  { key: 'shanghai', weight: 14 },
  { key: 'hangzhou', weight: 7 },
  { key: 'ningbo', weight: 4 },
  { key: 'wenzhou', weight: 3 },
  { key: 'suzhou', weight: 5 },
  { key: 'nanjing', weight: 3 }, // 长三角 36 = 12%
  { key: 'beijing', weight: 16 },
  { key: 'tianjin', weight: 8 }, // 京津冀 24 = 8%
  { key: 'chengdu', weight: 4 },
  { key: 'wuhan', weight: 3 },
  { key: 'changsha', weight: 3 },
  { key: 'xiamen', weight: 4 },
  { key: 'fuzhou', weight: 3 },
  { key: 'kunming', weight: 2 },
  { key: 'xian', weight: 2 }, // 其他省会 21 = 7%
]

// 合计必须为 300。自检在文件末尾。

// ---------- 姓名:潮汕大姓 + 常见取名用字 ----------
// 潮汕地区陈、林、黄、郑、王、李、张、吴、刘、谢、蔡、许、杨、周、郭占比高
const SURNAMES = [
  '陈',
  '林',
  '黄',
  '郑',
  '王',
  '李',
  '张',
  '吴',
  '刘',
  '谢',
  '蔡',
  '许',
  '杨',
  '周',
  '郭',
  '方',
  '罗',
  '苏',
  '叶',
  '文',
  '庄',
  '余',
  '卢',
  '杜',
  '曾',
  '彭',
  '萧',
  '江',
  '沈',
  '韩',
]
const GIVEN_1 = [
  '建',
  '志',
  '家',
  '晓',
  '伟',
  '丽',
  '杰',
  '敏',
  '静',
  '磊',
  '婷',
  '强',
  '斌',
  '超',
  '燕',
  '珊',
  '彬',
  '宏',
  '锐',
  '佳',
  '嘉',
  '泽',
  '培',
  '炳',
  '松',
  '南',
  '玩',
  '爱',
  '纯',
  '8',
]
const GIVEN_2 = [
  '国',
  '华',
  '明',
  '鑫',
  '涛',
  '燕',
  '娜',
  '丹',
  '琪',
  '宇',
  '轩',
  '豪',
  '博',
  '文',
  '武',
  '贤',
  '忠',
  '孝',
  '和',
  '顺',
  '兴',
  '旺',
  '发',
  '财',
  '福',
  '禄',
  '寿',
  '喜',
  '安',
  '乐',
]
const GIVEN_SOLO = ['婷', '磊', '娟', '毅', '悦', '菲', '坤', '澜', '群', '航']

function makeName() {
  const s = pick(SURNAMES)
  const mode = rng()
  if (mode < 0.45) return s + pick(GIVEN_1) + pick(GIVEN_2)
  if (mode < 0.8) return s + pick(GIVEN_SOLO)
  return s + pick(GIVEN_1) + pick(GIVEN_1)
}

// ---------- 公司 / 职位 / 学校 / 专业 ----------
const COMPANY_MID = [
  '腾',
  '达',
  '顺',
  '通',
  '瑞',
  '和',
  '泰',
  '鑫',
  '隆',
  '嘉',
  '恒',
  '晟',
  '荣',
  '盛',
  '发',
]
// 字号用汕头本地地名,比随机汉字更有说服力
const COMPANY_HEAD = [
  '潮汕',
  '汕头',
  '潮商',
  '濠江',
  '澄海',
  '潮阳',
  '南澳',
  '韩江',
  '礐石',
  '榕江',
]

// 组织形式与产业词分开构造,避免出现「实业实业有限公司」这类重复字。
function makeCompany(industry) {
  const head = pick(COMPANY_HEAD)
  const mid = pick(COMPANY_MID)
  const r = rng()
  if (r < 0.6) return head + mid + industryCompanyWord(industry) + '有限公司'
  if (r < 0.85) return head + mid + industryCompanyWord(industry) + '集团有限公司'
  return head + mid + '股份有限公司'
}
function industryCompanyWord(code) {
  return (
    {
      trade: '商贸',
      food: '食品',
      manufacture: '实业',
      internet: '网络',
      construction: '置业',
      finance: '投资',
      logistics: '物流',
      education: '教育',
      medical: '医药',
      civil: '咨询',
      student: '信息',
      other: '发展',
      media: '文化',
      agriculture: '农业',
    }[code] ?? '发展'
  )
}

const TITLES = [
  '总经理',
  '董事长',
  '副总经理',
  '运营总监',
  '技术负责人',
  '市场部经理',
  '创始人',
  '合伙人',
  '财务总监',
  '产品经理',
]
const STUDENT_TITLES = ['在校生', '研究生', '应届生']

const SCHOOLS_LOCAL = [
  '汕头大学',
  '广东以色列理工学院',
  '汕头职业技术学院',
  '韩山师范学院',
  '广东工业大学',
]
const SCHOOLS_FAR = [
  '中山大学',
  '华南理工大学',
  '暨南大学',
  '哈尔滨工业大学(深圳)',
  '清华大学',
  '复旦大学',
  '上海交通大学',
  '浙江大学',
  '厦门大学',
  '武汉大学',
]
const MAJORS = [
  '计算机科学与技术',
  '工商管理',
  '国际贸易',
  '机械工程',
  '电子信息工程',
  '金融学',
  '市场营销',
  '土木工程',
  '食品科学与工程',
  '中医学',
  '法学',
  '视觉传达设计',
  '会计学',
]

const INDUSTRIES_POOL = [
  'trade',
  'trade',
  'trade',
  'trade',
  'food',
  'food',
  'food',
  'manufacture',
  'manufacture',
  'manufacture',
  'manufacture',
  'internet',
  'internet',
  'construction',
  'finance',
  'logistics',
  'education',
  'medical',
  'civil',
  'other',
  'student',
]

// ---------- 生成 ----------
const BIOS = [
  '在外的汕头人,逢年过节总要回厝边吃一碗粿条。',
  '做实业十几年,愿意带刚毕业的老乡入门。',
  '常年往返广深,业务方向是供应链与品牌出海。',
  '毕业后留在本地,关注乡会的青少年助学项目。',
  '喜欢工夫茶,周末常在乡会会所冲茶聊天。',
  '从家族生意转型做电商,正在摸索新渠道。',
  '医务工作者,乡会义诊活动的固定志愿者。',
  '做物流出身,熟悉潮汕各地仓配网络。',
]

const members = []
let uid = 0

for (const { key, weight } of QUOTA) {
  for (let i = 0; i < weight; i++) {
    uid += 1
    const isHometown = key === '__hometown__'
    const dist = isHometown ? pick(HOMETOWN.districts) : null
    const c = isHometown ? null : CITIES[key]

    const province = isHometown ? HOMETOWN.province : c.province
    const city = isHometown ? HOMETOWN.city : c.city
    const district = isHometown ? dist.name : ''

    // 家乡本地扰动小(同一区县内),外地扰动大(同城不同区)
    const base = isHometown ? dist : c
    const deg = isHometown ? 0.05 : 0.15
    const lat = Number(jitter(base.lat, deg).toFixed(5))
    const lng = Number(jitter(base.lng, deg).toFixed(5))

    // 学生与本地成员更可能读本地学校;外地从业者更多读省外名校
    const gradYear = intBetween(1996, 2025)
    const isStudent = gradYear >= 2022 && rng() < 0.4
    const industry = isStudent
      ? 'student'
      : isHometown && rng() < 0.5
        ? pick(INDUSTRIES_POOL)
        : pick(INDUSTRIES_POOL)
    const localSchool = rng() < (isHometown ? 0.55 : 0.25)

    const name = makeName()
    const seniority = 2026 - gradYear

    members.push({
      id: `m${String(uid).padStart(4, '0')}`,
      name,
      // 第一阶段不引用外链图片:小程序 image 的域名也要配白名单,徒增报错来源。
      // 空串由页面侧的 TDesign Avatar 首字母兜底渲染。
      avatar: '',
      gender: rng() < 0.68 ? 1 : 2,
      province,
      city,
      district,
      country: '中国',
      lat,
      lng,
      industry,
      company: isStudent
        ? localSchool
          ? pick(SCHOOLS_LOCAL)
          : pick(SCHOOLS_FAR)
        : makeCompany(industry),
      title: isStudent ? pick(STUDENT_TITLES) : pick(TITLES),
      school: localSchool ? pick(SCHOOLS_LOCAL) : pick(SCHOOLS_FAR),
      major: pick(MAJORS),
      graduationYear: gradYear,
      seniority,
      // 联系方式默认不公开 —— 乡会成员隐私红线,第二阶段接后端时这条要落到服务端
      contactVisible: rng() < 0.35,
      wechatId: 'stua_' + String(uid).padStart(4, '0'),
      phone: `13${intBetween(0, 9)}${String(intBetween(10000000, 99999999))}`,
      bio: pick(BIOS),
      joinedAt: `20${intBetween(18, 25)}-${String(intBetween(1, 12)).padStart(2, '0')}-${String(intBetween(1, 28)).padStart(2, '0')}`,
    })
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(members, null, 2) + '\n', 'utf8')

// ---------- 自检:打印分布,防止改了配额却没发现总数不对 ----------
const byProvince = {}
for (const m of members) byProvince[m.province] = (byProvince[m.province] ?? 0) + 1
const shantou = members.filter((m) => m.city === '汕头市').length
const pearl = members.filter((m) =>
  ['广州市', '深圳市', '东莞市', '佛山市', '珠海市', '中山市', '惠州市'].includes(m.city),
).length

console.log(`✅ 已生成 ${members.length} 条 → ${OUT.replace(process.cwd(), '.')}`)
console.log(
  `   汕头本市 ${shantou} 条 / 珠三角七市 ${pearl} 条 / 潮州 ${byProvince['广东省'] ? members.filter((m) => m.city === '潮州市').length : 0} 条`,
)
console.log('   按省分布:')
for (const [p, n] of Object.entries(byProvince).sort((a, b) => b[1] - a[1])) {
  console.log(`     ${p.padEnd(6)} ${String(n).padStart(4)}  ${'█'.repeat(Math.round(n / 3))}`)
}
const ids = new Set(members.map((m) => m.id))
console.log(`   id 唯一性: ${ids.size === members.length ? '✅' : '❌ 有重复'}`)
const badCoord = members.filter((m) => !(m.lat > 3 && m.lat < 54 && m.lng > 73 && m.lng < 136))
console.log(`   坐标越界: ${badCoord.length === 0 ? '✅ 0 条' : `❌ ${badCoord.length} 条`}`)

// 改了 QUOTA 权重却没注意总数,是这类脚本最常见的失误。在这里明确报出来,
// 而不是让地图上的密度悄悄偏离 docs 里写的比例。
const EXPECTED_TOTAL = 300
if (members.length !== EXPECTED_TOTAL) {
  console.error(`\n❌ 总数 ${members.length} ≠ 计划的 ${EXPECTED_TOTAL},请检查 QUOTA 权重之和`)
  process.exitCode = 1
}
