<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import { useMemberFilterStore } from '@/stores/memberFilter'
import TsaMemberCard from '@/components/TsaMemberCard/TsaMemberCard.vue'
import TsaFilterBar from '@/components/TsaFilterBar/TsaFilterBar.vue'
import type { MemberListItem } from '@/types/member'

/**
 * 乡贤名录。
 *
 * ★ 本页与地图页共用 useMemberFilterStore:在地图上筛「深圳市 / 互联网」,
 *   切到底部「乡贤」tab,列表就是同一批人。这是本项目选 Pinia 的唯一硬性理由,
 *   判断标准写在 docs/DEVELOPMENT.md。
 *
 * 注意:当前分页是 mock 层在做切片。真后端就绪后,筛选应改成带参数请求接口,
 * 而不是继续把全量拉到前端过滤 —— 成员到几千人时全量下发会拖垮首屏。
 */

const PAGE_SIZE = 20

const store = useMemberFilterStore()

const list = ref<MemberListItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const finished = ref(false)
const showFilter = ref(false)

const fetchPage = async (reset = false) => {
  if (loading.value) return;
  if (reset) {
    page.value = 1
    finished.value = false
    list.value = []
  }
  loading.value = true
  try {
    const res = await memberApi.getList({
      page: page.value,
      pageSize: PAGE_SIZE,
      province: store.province || undefined,
      city: store.city || undefined,
      industry: store.industry || undefined,
      keyword: store.keyword || undefined,
    })
    list.value = reset ? res.list : [...list.value, ...res.list]
    total.value = res.total
    finished.value = list.value.length >= res.total
    if (!finished.value) page.value += 1
  } finally {
    loading.value = false
  }
}

const onFilterConfirm = () => {
  showFilter.value = false
  fetchPage(true)
}

const clearFilter = () => {
  store.reset()
  fetchPage(true)
}

const goDetail = (m: MemberListItem) => {
  uni.navigateTo({ url: `/pages/member/detail?id=${m.id}` })
}

// 从详情页返回、或从地图页切过来时,按当前筛选重新取数
onShow(() => fetchPage(true))

onReachBottom(() => {
  if (!finished.value) fetchPage()
})
</script>

<template>
  <view class="page">
    <!-- 顶部筛选条:与地图页共享同一个 store,所以两边筛选结果始终一致 -->
    <view class="mlist__bar">
      <view class="mlist__filter" @click="showFilter = true">
        <text class="mlist__filter-text">{{ store.label || '筛选乡贤' }}</text>
        <text class="mlist__filter-arrow">⌄</text>
      </view>
      <text v-if="store.isActive" class="mlist__clear" @click="clearFilter">清除</text>
    </view>

    <view class="mlist__count">
      <text class="text-secondary">共 {{ total }} 位乡贤</text>
    </view>

    <TsaMemberCard v-for="m in list" :key="m.id" :member="m" @click="goDetail" />

    <view v-if="loading" class="mlist__more">
      <t-loading theme="circular" size="36rpx" text="加载中" />
    </view>
    <view v-else-if="list.length === 0" class="mlist__empty">
      <t-empty description="没有符合条件的乡贤,换个筛选条件试试" />
    </view>
    <view v-else-if="finished" class="mlist__more">
      <text class="text-placeholder">已经到底了</text>
    </view>

    <t-popup v-model:visible="showFilter" placement="bottom">
      <TsaFilterBar :all-points="[]" @confirm="onFilterConfirm" />
    </t-popup>
  </view>
</template>

<style lang="less" scoped>
.mlist__bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  background: #fff;
}
.mlist__filter {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  background: var(--td-bg-color-page);
  border-radius: 40rpx;
}
.mlist__filter-text {
  font-size: 26rpx;
  color: var(--td-text-color-primary);
}
.mlist__filter-arrow {
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.mlist__clear {
  font-size: 26rpx;
  color: var(--td-brand-color);
}
.mlist__count {
  padding: 20rpx 24rpx 8rpx;
}
.mlist__more {
  display: flex;
  justify-content: center;
  padding: 30rpx 0 50rpx;
}
.mlist__empty {
  padding-top: 120rpx;
}

/* 给列表项统一留左右边距 */
.page > :deep(.member-card) {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
</style>
