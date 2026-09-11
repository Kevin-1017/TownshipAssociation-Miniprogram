/** 基金会校内奖励与表彰条目 */
export interface FoundationRewardItem {
  id: string
  label: string // 如"年度奖学金""校园活动支持"
  amount: number // 金额(元),前端格式化展示
  sponsor: string // 赞助人/捐赠方名称
}

/** 基金会捐赠与帮助致谢条目 */
export interface FoundationDonationItem {
  id: string
  donorName: string // 捐赠人姓名
  amount: number // 捐赠金额(元)
  date: string // ISO 8601
}

/* ── 详情页用扩展类型 ─────────────────────────── */

/** 奖项类别（首页固定，也可由后端返回） */
export interface RewardCategory {
  id: string
  name: string // 如"年度奖学金颁发"
}

/** 获奖记录（含获奖人） */
export interface RewardRecord {
  id: string
  categoryId: string // 所属类别
  categoryName: string
  recipient: string // 获奖人姓名
  amount?: number // 奖金金额(元)
}

/** 捐赠记录（带完整信息） */
export interface DonationRecord {
  id: string
  donorName: string
  amount: number // 捐赠金额(元)
  date: string
}
