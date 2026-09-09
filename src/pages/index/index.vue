<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import { noticeApi } from '@/api/notice'
import { eventApi } from '@/api/event'
import { formatDate, formatRelative } from '@/utils/format'
import type { NoticeItem } from '@/types/notice'
import type { ProvinceStat } from '@/types/member'

/** 首页只做取数与展示,不做业务判断 —— 见 docs/DEVELOPMENT.md §3 */

/** 当前页面路径（用于底部 tab bar 高亮） */
const activePage = ref('/pages/index/index')

const notices = ref<NoticeItem[]>([])
const topProvinces = ref<ProvinceStat[]>([])
const memberTotal = ref(0)
const upcomingCount = ref(0)

const load = async () => {
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

// 地图已移出 tabBar(原生 map 组件在 tab 页常驻会漏绘到其他页面),改用 navigateTo 入栈打开
const goMap = () => uni.navigateTo({ url: '/pages/map/index' })
const goNotice = (id: string) => uni.navigateTo({ url: `/pages/notice/detail?id=${id}` })
const goFoundation = (tab: 'rewards' | 'donations') =>
  uni.navigateTo({ url: `/pages/foundation/index?tab=${tab}` })

const onTabChange = (e: { value: string }) => {
  activePage.value = e.value
  uni.navigateTo({ url: e.value })
}

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

    <!-- 基金会 -->
    <view class="section-title">
      <text>校友基金会</text>
    </view>

    <!-- 左右双卡片 -->
    <view class="foundation__cards-row">
      <view class="foundation__card-link" @click="goFoundation('rewards')">
        <view class="foundation__card-header">
          <text class="foundation__card-title">校内奖励与表彰</text>
          <t-icon name="book-filled" size="44rpx" color="var(--td-brand-color)" />
        </view>
        <view class="foundation__bullet-list">
          <text class="foundation__bullet">• 奖学金颁发</text>
          <text class="foundation__bullet">• 优秀负责人表彰</text>
          <text class="foundation__bullet">• 校园活动支持</text>
        </view>
        <text class="foundation__see-more">查看详情 ›</text>
      </view>

      <view class="foundation__card-link" @click="goFoundation('donations')">
        <view class="foundation__card-header">
          <text class="foundation__card-title">捐赠与帮助致谢</text>
          <t-icon name="animation-1" size="44rpx" color="var(--td-warning-color)" />
        </view>
        <view class="foundation__bullet-list">
          <text class="foundation__bullet">• 捐赠公示</text>
          <text class="foundation__bullet">• 帮助致谢</text>
        </view>
        <text class="foundation__see-more">查看详情 ›</text>
      </view>
    </view>

    <!-- 滚动提示条 -->
    <t-notice-bar
      :visible="true"
      :prefix-icon="false"
      :marquee="{ speed: 80, loop: -1, delay: 0 }"
      content="校友基金会年度捐赠额持续攀升，感谢各界乡贤的大力支持！"
    />

    <view class="home__foot">
      <text class="text-placeholder">本页面数据来自本地 mock,切换真后端只需改 .env 一个变量</text>
    </view>

    <!-- 底部悬浮胶囊导航 -->
    <t-tab-bar
      :value="activePage"
      @change="onTabChange"
      shape="round"
      safe-area-inset-bottom
      t-class="bottom-bar"
    >
      <t-tab-bar-item value="/pages/index/index" url="/pages/index/index" icon="home">
        首页
      </t-tab-bar-item>
      <t-tab-bar-item value="/pages/community/index" url="/pages/community/index" icon="chat">
        社区
      </t-tab-bar-item>
      <t-tab-bar-item value="/pages/event/list" url="/pages/event/list" icon="app">
        事件
      </t-tab-bar-item>
      <t-tab-bar-item value="/pages/mine/index" url="/pages/mine/index" icon="user-filled">
        我的
      </t-tab-bar-item>
    </t-tab-bar>
  </view>
</template>

<style lang="less" scoped>
.home {
  /* padding 计入 100vh,避免页面多出 40rpx 滚动空间(同社区页修复) */
  box-sizing: border-box;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
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

/* ── 基金会双卡片 ─────────────────────────── */
.foundation__cards-row {
  display: flex;
  gap: 24rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.foundation__card-link {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 28rpx 24rpx 20rpx;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-large);
  /* 覆盖全局 .card 的 margin-bottom,由 row 控制间距 */
  margin-bottom: 0;
}
.foundation__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.foundation__card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.foundation__bullet-list {
  flex: 1;
  margin-top: 20rpx;
}
.foundation__bullet {
  display: block;
  font-size: 28rpx;
  color: var(--td-text-color-secondary);
  line-height: 2.2;
}
.foundation__see-more {
  display: block;
  text-align: right;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--td-brand-color);
}

.bottom-bar {
  /* TDesign 内置 fixed + round + safe-area 样式,不需要额外定位 */
}
</style>
