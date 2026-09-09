/**
 * 行业字典 —— 前端筛选器的唯一数据源。
 *
 * 与后端约定:数据库存 code,不存中文名。新增行业只改这里 + 后端字典表。
 * 学生练习 L1 任务(加一个筛选项)时只需要动这个数组。
 */
export interface IndustryOption {
  code: string
  label: string
}

export const INDUSTRIES: IndustryOption[] = [
  { code: 'trade', label: '商贸' },
  { code: 'food', label: '餐饮食品' },
  { code: 'manufacture', label: '制造业' },
  { code: 'internet', label: '互联网' },
  { code: 'construction', label: '建筑房地产' },
  { code: 'finance', label: '金融' },
  { code: 'logistics', label: '物流' },
  { code: 'education', label: '教育' },
  { code: 'medical', label: '医疗' },
  { code: 'civil', label: '公务员' },
  { code: 'student', label: '学生' },
  { code: 'other', label: '其他' },
]

export const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.code, i.label]),
)

export const industryLabel = (code: string): string => {
  return INDUSTRY_LABELS[code] ?? code;
}
