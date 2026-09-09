<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { foundationApi } from '@/api/foundation'
import type { RewardRecord, DonationRecord } from '@/types/foundation'
import { formatAmount, formatDate } from '@/utils/format'

/** 校友基金会详情页 —— tabs 切换奖励与捐赠 */

const activeTab = ref<'rewards' | 'donations'>('rewards')

// ---------- 数据 ----------
const rewardRecords = ref<RewardRecord[]>([])
const donationRecords = ref<DonationRecord[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const rewardRes = await foundationApi.getRewards()
    rewardRecords.value = rewardRes.records ?? []
    donationRecords.value = (await foundationApi.getDonations()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  } catch {
    // 详情页失败不影响首页展示,控制台留痕即可
    console.error('[foundation/detail] 数据加载失败')
  } finally {
    loading.value = false
  }
}

// 从 URL 参数读取初始 tab
onLoad((query) => {
  const tab = (query as Record<string, string>)?.tab
  if (tab === 'rewards' || tab === 'donations') {
    activeTab.value = tab
  }
  uni.setNavigationBarTitle({ title: '校友基金会' })
  load()
})

// ---------- 事件 ----------
const onTabsChange = (value: string | number) => {
  activeTab.value = value as 'rewards' | 'donations'
  uni.setStorageSync('foundation_tab', value)
}

/** 按类别分组获奖记录（返回数组避免 v-for 直接遍历对象 key 的 Vue 警告） */
const groupedRewards = computed(() =>
  Object.entries(rewardRecords.value.reduce((groups, r) => {
    if (!groups[r.categoryName]) groups[r.categoryName] = []
    groups[r.categoryName].push(r)
    return groups
  }, {} as Record<string, RewardRecord[]>)).map(([category, records]) => ({ category, records })),
)
</script>

<template>
  <view class="page foundation-detail">
    <!-- Tab 切换 -->
    <t-tabs v-model:value="activeTab" t-class="custom-tabs">
      <t-tab-panel label="校内奖励与表彰" value="rewards" />
      <t-tab-panel label="捐赠与帮助致谢" value="donations" />
    </t-tabs>

    <!-- 加载中 -->
    <view v-if="loading" class="foundation-detail__loading">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>

    <!-- Tab 0: 校内奖励 -->
    <view v-else-if="activeTab === 'rewards'" class="foundation-detail__tab">
      <view v-for="{ category, records } in groupedRewards" :key="category" class="foundation-detail__group">
        <view class="foundation-detail__group-title">{{ category }}</view>
        <view v-for="r in records" :key="r.id" class="card foundation-detail__item foundation-detail__item--top">
          <view class="row row--between">
            <text class="foundation-detail__name">{{ r.recipient }}</text>
            <text v-if="r.amount" class="foundation-detail__amount">{{ formatAmount(r.amount) }}</text>
          </view>
          <text class="foundation-detail__sub">所属项目 · {{ r.categoryName }}</text>
        </view>
      </view>
      <view v-if="groupedRewards.length === 0" class="foundation-detail__empty">暂无数据</view>
    </view>

    <!-- Tab 1: 捐赠致谢 -->
    <view v-else class="foundation-detail__tab">
      <view v-for="d in donationRecords" :key="d.id" class="card foundation-detail__item foundation-detail__item--top">
        <view class="row row--between">
          <text class="foundation-detail__name">{{ d.donorName }}</text>
          <text class="foundation-detail__amount">{{ formatAmount(d.amount) }}</text>
        </view>
        <text class="foundation-detail__sub">捐赠日期：{{ formatDate(d.date) }}</text>
      </view>
      <view v-if="donationRecords.length === 0" class="foundation-detail__empty">暂无数据</view>
    </view>
  </view>
</template>

<style lang="less" scoped>
.foundation-detail {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background: var(--td-bg-color-page);
}

.foundation-detail__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.foundation-detail__tab {
  flex: 1;
  overflow-y: auto;
}

.foundation-detail__group {
  margin-bottom: 32rpx;
}

.foundation-detail__group-title {
  padding: 20rpx 28rpx 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--td-text-color-secondary);
}

.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}

.foundation-detail__item {
  display: flex;
  flex-direction: column;
}
.foundation-detail__item--top {
  margin-top: 20rpx;
}

.foundation-detail__name {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.foundation-detail__amount {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--td-warning-color);
}

.foundation-detail__sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}

.foundation-detail__empty {
  padding: 80rpx 0;
  text-align: center;
  font-size: 28rpx;
  color: var(--td-text-color-placeholder);
}
</style>
