<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { eventApi } from '@/api/event'
import { formatMonthDay } from '@/utils/format'
import type { EventListItem, EventStatus } from '@/types/event'

/**
 * 活动列表 —— 第一阶段「半真实」:能看,不能报名。
 * 报名要写接口且涉及并发与幂等(名额超卖),留给第二阶段,见计划第十四节。
 */

const TABS: Array<{ label: string; value: EventStatus | '' }> = [
  { label: '全部', value: '' },
  { label: '待开始', value: 'upcoming' },
  { label: '已结束', value: 'past' },
]

const list = ref<EventListItem[]>([])
const active = ref<EventStatus | ''>('')
const loading = ref(false)

function statusLabel(s: EventStatus) {
  return { upcoming: '待开始', ongoing: '进行中', past: '已结束', cancelled: '已取消' }[s]
}
function statusTheme(s: EventStatus) {
  return s === 'upcoming' ? 'primary' : s === 'cancelled' ? 'danger' : 'default'
}

async function load() {
  loading.value = true
  try {
    const res = await eventApi.getList({
      pageSize: 50,
      status: active.value || undefined,
    })
    list.value = res.list
  } finally {
    loading.value = false
  }
}

function switchTab(v: EventStatus | '') {
  active.value = v
  load()
}

const goDetail = (id: string) => uni.navigateTo({ url: `/pages/event/detail?id=${id}` })

onShow(load)
</script>

<template>
  <view class="page elist">
    <view class="elist__tabs">
      <text
        v-for="t in TABS"
        :key="t.value"
        class="elist__tab"
        :class="{ 'is-on': active === t.value }"
        @click="switchTab(t.value)"
      >
        {{ t.label }}
      </text>
    </view>

    <view v-for="e in list" :key="e.id" class="card elist__item" @click="goDetail(e.id)">
      <view class="row row--between">
        <t-tag :theme="statusTheme(e.status)" variant="light" size="small">
          {{ statusLabel(e.status) }}
        </t-tag>
        <text class="text-placeholder">{{ e.city }}</text>
      </view>

      <text class="elist__title ellipsis-2">{{ e.title }}</text>
      <text class="elist__time">{{ formatMonthDay(e.startTime) }} 开始</text>
      <text class="elist__addr ellipsis">{{ e.address }}</text>

      <view class="row row--between elist__foot">
        <text class="text-secondary">
          已报 {{ e.registeredCount }}
          <text v-if="e.quota">/ {{ e.quota }}</text>
          人
        </text>
        <text class="elist__btn" :class="{ 'is-off': e.status !== 'upcoming' }">
          {{ e.status === 'upcoming' ? '查看详情' : '查看回顾' }}
        </text>
      </view>
    </view>

    <view v-if="!loading && list.length === 0" class="elist__empty">
      <t-empty description="这个状态下还没有活动" />
    </view>
    <view v-if="loading" class="elist__loading">
      <t-loading theme="circular" size="40rpx" text="加载中" />
    </view>
  </view>
</template>

<style lang="less" scoped>
.elist__tabs {
  display: flex;
  gap: 16rpx;
  padding: 24rpx;
  background: #fff;
}
.elist__tab {
  padding: 10rpx 30rpx;
  font-size: 26rpx;
  border-radius: 30rpx;
  background: var(--td-bg-color-page);
  color: var(--td-text-color-secondary);
}
.elist__tab.is-on {
  background: var(--td-brand-color);
  color: #fff;
}
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.elist__title {
  display: block;
  margin-top: 16rpx;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.45;
}
.elist__time {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: var(--td-brand-color);
}
.elist__addr {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--td-text-color-secondary);
}
.elist__foot {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1px solid var(--td-border-level-1-color);
}
.elist__btn {
  font-size: 26rpx;
  color: var(--td-brand-color);
}
.elist__btn.is-off {
  color: var(--td-text-color-placeholder);
}
.elist__empty {
  padding-top: 120rpx;
}
.elist__loading {
  display: flex;
  justify-content: center;
  padding: 40rpx 0;
}
</style>
