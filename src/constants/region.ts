/**
 * 行政区划筛选字典(第一阶段只做前端筛选,不接腾讯位置服务的区划接口)。
 *
 * 只收录 mock 数据里真实出现的省市,保证筛选器每个选项都筛得出东西 ——
 * 空选项对学生是最糟糕的调试体验。第二阶段接入后端区划接口后删除本文件。
 */
export interface CityOption {
  code: string
  label: string
}

export interface ProvinceOption extends CityOption {
  cities: CityOption[]
}

/** 汕头下辖六区一县,家乡本地成员按这个细分 */
export const SHANTOU_DISTRICTS: CityOption[] = [
  { code: 'jinping', label: '金平区' },
  { code: 'longhu', label: '龙湖区' },
  { code: 'chenghai', label: '澄海区' },
  { code: 'chaoyang', label: '潮阳区' },
  { code: 'chaonan', label: '潮南区' },
  { code: 'haojiang', label: '濠江区' },
  { code: 'nanao', label: '南澳县' },
]

export const PROVINCES: ProvinceOption[] = [
  {
    code: 'guangdong',
    label: '广东省',
    cities: [
      { code: 'shantou', label: '汕头市' },
      { code: 'chaozhou', label: '潮州市' },
      { code: 'jieyang', label: '揭阳市' },
      { code: 'guangzhou', label: '广州市' },
      { code: 'shenzhen', label: '深圳市' },
      { code: 'dongguan', label: '东莞市' },
      { code: 'foshan', label: '佛山市' },
      { code: 'zhuhai', label: '珠海市' },
      { code: 'zhongshan', label: '中山市' },
      { code: 'huizhou', label: '惠州市' },
    ],
  },
  {
    code: 'shanghai',
    label: '上海市',
    cities: [{ code: 'shanghai', label: '上海市' }],
  },
  {
    code: 'zhejiang',
    label: '浙江省',
    cities: [
      { code: 'hangzhou', label: '杭州市' },
      { code: 'ningbo', label: '宁波市' },
      { code: 'wenzhou', label: '温州市' },
    ],
  },
  {
    code: 'jiangsu',
    label: '江苏省',
    cities: [
      { code: 'nanjing', label: '南京市' },
      { code: 'suzhou', label: '苏州市' },
    ],
  },
  {
    code: 'beijing',
    label: '北京市',
    cities: [{ code: 'beijing', label: '北京市' }],
  },
  {
    code: 'tianjin',
    label: '天津市',
    cities: [{ code: 'tianjin', label: '天津市' }],
  },
  {
    code: 'sichuan',
    label: '四川省',
    cities: [{ code: 'chengdu', label: '成都市' }],
  },
  {
    code: 'hubei',
    label: '湖北省',
    cities: [{ code: 'wuhan', label: '武汉市' }],
  },
  {
    code: 'hunan',
    label: '湖南省',
    cities: [{ code: 'changsha', label: '长沙市' }],
  },
  {
    code: 'fujian',
    label: '福建省',
    cities: [
      { code: 'xiamen', label: '厦门市' },
      { code: 'fuzhou', label: '福州市' },
    ],
  },
  {
    code: 'yunnan',
    label: '云南省',
    cities: [{ code: 'kunming', label: '昆明市' }],
  },
  {
    code: 'shaanxi',
    label: '陕西省',
    cities: [{ code: 'xian', label: '西安市' }],
  },
]

/** 扁平化的「省 / 市」选项,给不支持级联的控件用 */
export function flatCityOptions(): Array<CityOption & { provinceLabel: string }> {
  return PROVINCES.flatMap((p) => p.cities.map((c) => ({ ...c, provinceLabel: p.label })))
}
