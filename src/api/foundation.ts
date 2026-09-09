import { request } from '@/utils/request'
import type { FoundationRewardItem, FoundationDonationItem, RewardRecord, DonationRecord } from '@/types/foundation'

export const foundationApi = {
  /** 基金会数据:校内奖励 + 捐赠鸣谢,首页展示不拆分 */
  getData: () =>
    request<{ rewards: FoundationRewardItem[]; donations: FoundationDonationItem[] }>({
      url: '/tsa/foundation',
      showLoading: false,
    }),

  /** 奖励明细(含获奖人):详情页 tab0 用 */
  getRewards: () =>
    request<{ categories: string[]; records: RewardRecord[] }>({
      url: '/tsa/foundation/rewards',
      showLoading: false,
    }),

  /** 捐赠明细:详情页 tab1 用 */
  getDonations: () =>
    request<DonationRecord[]>({
      url: '/tsa/foundation/donations',
      showLoading: false,
    }),
}
