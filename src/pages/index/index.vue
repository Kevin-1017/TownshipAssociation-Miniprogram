<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import { noticeApi } from '@/api/notice'
import { eventApi } from '@/api/event'
import { formatDate, formatRelative } from '@/utils/format'
import type { NoticeItem } from '@/types/notice'
import type { ProvinceStat } from '@/types/member'

/** 首页只做取数与展示,不做业务判断 —— 见 docs/DEVELOPMENT.md §3 */

const notices = ref<NoticeItem[]>([])
const topProvinces = ref<ProvinceStat[]>([])
const memberTotal = ref(0)
const upcomingCount = ref(0)

const today = formatDate(new Date().toISOString())

// 排行榜条宽按最大值归一
const maxCount = computed(() => topProvinces.value[0]?.count || 1)
function barWidth(count: number) {
  return `${Math.max(6, Math.round((count / maxCount.value) * 100))}%`
}

async function load() {
  const [stats, noticeList, events] = await Promise.all([
    memberApi.getProvinceStats(),
    noticeApi.getList(),
    eventApi.getList({ pageSize: 50 }),
  ])
  topProvinces.value = stats
  memberTotal.value = stats.reduce((s, p) => s + p.count, 0)
  notices.value = noticeList
  upcomingCount.value = events.list.filter((e) => e.status === 'upcoming').length
}

const goMap = () => uni.switchTab({ url: '/pages/map/index' })
const goNotice = (id: string) => uni.navigateTo({ url: `/pages/notice/detail?id=${id}` })

// 用 onShow 而不是 onMounted:从地图页返回时也要刷新统计
onShow(load)
</script>

<template>
  <view class="page home">
    <!-- 乡会简介 -->
    <view class="home__hero">
      <text class="home__hero-title">潮阳潮南校友会</text>
      <text class="home__hero-sub">团结潮人,互助乡邻,传承潮汕文化</text>
      <view class="home__hero-stats">
        <view class="home__stat">
          <text class="home__stat-num">{{ memberTotal }}</text>
          <text class="home__stat-label">在册乡贤</text>
        </view>
        <view class="home__stat">
          <text class="home__stat-num">{{ topProvinces.length }}</text>
          <text class="home__stat-label">覆盖省市</text>
        </view>
        <view class="home__stat">
          <text class="home__stat-num">{{ upcomingCount }}</text>
          <text class="home__stat-label">近期事件</text>
        </view>
      </view>
    </view>

    <!-- 核心功能入口:地图 -->
    <view class="home__cta" @click="goMap">
      <view class="home__cta-body">
        <text class="home__cta-title">乡贤分布地图</text>
        <text class="home__cta-desc">看看老乡们都在哪里,支持按省市与行业筛选</text>
      </view>
      <text class="home__cta-arrow">›</text>
    </view>

    <!-- 公告 -->
    <view class="section-title">
      <text>乡会公告</text>
      <text class="section-title__more">共 {{ notices.length }} 条</text>
    </view>
    <view v-if="notices.length === 0" class="card">
      <t-loading theme="circular" size="40rpx" text="加载中" />
    </view>
    <view v-for="n in notices" :key="n.id" class="card home__notice" @click="goNotice(n.id)">
      <view class="row row--between">
        <text class="home__notice-title ellipsis">
          <text v-if="n.pinned" class="home__notice-pin">置顶</text>
          {{ n.title }}
        </text>
        <text class="text-placeholder">{{ formatRelative(n.publishedAt) }}</text>
      </view>
      <text class="home__notice-summary ellipsis-2">{{ n.summary }}</text>
    </view>

    <view class="home__foot">
      <text class="text-placeholder">本页面数据来自本地 mock,切换真后端只需改 .env 一个变量</text>
    </view>
  </view>
</template>

<style lang="less" scoped>
.home {
  padding-bottom: 40rpx;
}
.home__hero {
  padding: 56rpx 40rpx 40rpx;
  background: linear-gradient(160deg, #0052d9 0%, #2f7bff 100%);
  color: #fff;
}
.home__hero-title {
  font-size: 52rpx;
  font-weight: 700;
}
.home__hero-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  opacity: 0.85;
}
.home__hero-stats {
  display: flex;
  margin-top: 36rpx;
}
.home__stat {
  flex: 1;
}
.home__stat-num {
  font-size: 44rpx;
  font-weight: 700;
}
.home__stat-label {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  opacity: 0.8;
}

.home__cta {
  display: flex;
  align-items: center;
  margin: -28rpx 24rpx 0;
  padding: 28rpx;
  background: #fff;
  border-radius: var(--td-radius-large);
  box-shadow: 0 8rpx 24rpx rgba(0, 82, 217, 0.12);
  position: relative;
}
.home__cta-body {
  flex: 1;
}
.home__cta-title {
  font-size: 32rpx;
  font-weight: 600;
}
.home__cta-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--td-text-color-secondary);
}
.home__cta-arrow {
  font-size: 44rpx;
  color: var(--td-brand-color);
}

.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.section-title {
  margin-left: 24rpx;
  margin-right: 24rpx;
}

.home__rank {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
}
.home__rank-name {
  width: 130rpx;
  font-size: 26rpx;
}
.home__rank-bar {
  flex: 1;
  height: 14rpx;
  background: #f0f2f5;
  border-radius: 7rpx;
  overflow: hidden;
}
.home__rank-fill {
  height: 100%;
  background: var(--td-brand-color);
  border-radius: 7rpx;
}
.home__rank-num {
  width: 60rpx;
  text-align: right;
  font-size: 24rpx;
  color: var(--td-text-color-secondary);
}

.home__notice-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  margin-right: 16rpx;
}
.home__notice-pin {
  display: inline-block;
  margin-right: 10rpx;
  padding: 2rpx 10rpx;
  font-size: 20rpx;
  color: #fff;
  background: #d54941;
  border-radius: 6rpx;
}
.home__notice-summary {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--td-text-color-secondary);
}

.home__foot {
  padding: 40rpx 24rpx;
  text-align: center;
}
</style>
