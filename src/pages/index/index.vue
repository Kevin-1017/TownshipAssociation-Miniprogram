<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import { eventApi } from '@/api/event'
import { formatDate } from '@/utils/format'
import type { EventListItem } from '@/types/event'
import type { ProvinceStat } from '@/types/member'

/** 首页只做取数与展示,不做业务判断 —— 见 docs/DEVELOPMENT.md §3 */

/** 本页路径:tab bar 高亮;tab 页常驻缓存,返回时按它复位 */
const OWN_PATH = '/pages/index/index'
const noticeContent = [
  '王宇彬先生捐赠助力广工潮阳潮南校友会',
  '坤坤爱心捐赠200万，创造乡会捐赠历史',
]

/** 负责人风采 —— 仅本页展示用,不接口化 */
interface LeaderShowcase {
  name: string
  role: string
}
/**
 * 暂无负责人照片资源,轮播内容先用「姓氏首字头像」兜底
 * (与 TsaMemberCard 的头像策略一致,避免 image 域名白名单问题),后续换图只改这里。
 */
const LEADERS: LeaderShowcase[] = [
  { name: '谢锐丹', role: '龙洞乡会会长' },
  { name: '沈娟', role: '龙洞乡会副会长' },
  { name: '郭纯琪', role: '龙洞乡会副会长' },
  { name: '苏强忠', role: '龙洞乡会基金会负责人' },
  { name: '卢强泽', role: '龙洞乡会负责人' },
  { name: '萧婷晓', role: '大学城乡会会长' },
  { name: '方家文', role: '大学城乡会副会长' },
  { name: '张培爱', role: '大学城乡会副会长' },
  { name: '江宏华', role: '大学城乡会基金会负责人' },
  { name: '许嘉婷', role: '大学城乡会负责人' },
]
/** 当前页面路径（用于底部 tab bar 高亮） */
const activePage = ref(OWN_PATH)

const events = ref<EventListItem[]>([])
const topProvinces = ref<ProvinceStat[]>([])
const memberTotal = ref(0)
const upcomingCount = ref(0)
/** 负责人风采轮播当前下标,驱动字幕与缩放 */
const leaderIndex = ref(0)

/** 首页只展示最新两条,排序口径与事件页一致(按开始时间从近到远) */
const latestEvents = computed(() =>
  [...events.value]
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 2),
)

/** 当前轮播到的负责人:字幕文字跟着 swiper 的 current 走 */
const currentLeader = computed(() => LEADERS[leaderIndex.value])

const load = async () => {
  const [stats, eventList] = await Promise.all([
    memberApi.getProvinceStats(),
    eventApi.getList({ pageSize: 50 }),
  ])
  topProvinces.value = stats
  memberTotal.value = stats.reduce((s, p) => s + p.count, 0)
  events.value = eventList.list
  upcomingCount.value = eventList.list.filter((e) => e.status === 'upcoming').length
}

// 地图已移出 tabBar(原生 map 组件在 tab 页常驻会漏绘到其他页面),改用 navigateTo 入栈打开
const goMap = () => uni.navigateTo({ url: '/pages/map/index' })
// 事件列表是 tab 页,只能用 switchTab 互切
const goEventList = () => uni.switchTab({ url: '/pages/event/list' })
const goEventDetail = (id: string) => uni.navigateTo({ url: `/pages/event/detail?id=${id}` })
const goFoundation = (tab: 'rewards' | 'donations') =>
  uni.navigateTo({ url: `/pages/foundation/index?tab=${tab}` })

// 轮播切换后同步下标,字幕与相邻项缩放都跟着它变
const onLeaderChange = (e: CustomEvent) => {
  leaderIndex.value = (e.detail as { current: number })?.current ?? 0
}

const onTabChange = (e: { value: string }) => {
  // 四个 tab 已登记进 pages.json 的 tabBar.list,只能用 switchTab 互切
  uni.switchTab({ url: e.value })
}

// 用 onShow 而不是 onMounted:从地图页返回时也要刷新统计
onShow(() => {
  // tab 页不卸载:离开前不改高亮,返回时复位成本页;原生 tab bar 每次都要藏
  activePage.value = OWN_PATH
  uni.hideTabBar()
  load()
})
</script>

<template>
  <view class="page home">
    <!-- 乡会简介 -->
    <view class="home__hero">
      <text class="home__hero-title">广工潮阳潮南校友会</text>
      <text class="home__hero-sub">同是一方水土人 相逢异方倍亲切</text>
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

    <!-- 乡会事件:标题行不压白底(同「校友基金会」区头),「更多」切到事件 tab -->
    <view class="home__events-head">
      <text class="home__events-title">乡会事件</text>
      <view class="home__events-more" @click="goEventList">
        <text>更多</text>
        <t-icon name="chevron-right" size="28rpx" color="var(--td-text-color-placeholder)" />
      </view>
    </view>
    <view class="home__events">
      <view v-if="latestEvents.length === 0" class="home__events-loading">
        <t-loading theme="circular" size="40rpx" text="加载中" />
      </view>
      <view
        v-for="(e, i) in latestEvents"
        :key="e.id"
        class="home__event"
        :class="{ 'home__event--divided': i > 0 }"
        @click="goEventDetail(e.id)"
      >
        <image
          v-if="e.cover"
          class="home__event__cover"
          mode="aspectFill"
          :src="e.cover"
          lazy-load
        />
        <view v-else class="home__event__cover home__event__cover--empty" />
        <view class="home__event__body">
          <text class="home__event__name ellipsis-2">{{ e.title }}</text>
          <text class="home__event__time">{{ formatDate(e.startTime) }}</text>
        </view>
      </view>
    </view>

    <!-- 基金会 -->
    <view class="section-title section-title--compact">
      <text>校友基金会</text>
    </view>

    <!-- 滚动提示条 -->
    <t-notice-bar
      theme="info"
      :visible="true"
      direction="vertical"
      :interval="3000"
      :content="noticeContent"
      prefix-icon="sound"
    />

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

    <!-- 负责人风采:卡片式轮播(露边 + 相邻项缩小),字幕跟随当前项切换 -->
    <view class="section-title section-title--compact leaders__head">
      <text>负责人风采</text>
    </view>
    <swiper
      class="leaders__swiper"
      circular
      :autoplay="true"
      :interval="4000"
      :duration="400"
      :current="leaderIndex"
      previous-margin="250rpx"
      next-margin="250rpx"
      @change="onLeaderChange"
    >
      <swiper-item v-for="(l, i) in LEADERS" :key="l.name">
        <view class="leaders__slide">
          <view class="leaders__photo" :class="{ 'leaders__photo--active': i === leaderIndex }">
            <!-- 照片素材未到位,先用姓氏首字头像兜底(同乡贤列表的头像策略) -->
            <text class="leaders__initial">{{ l.name.slice(0, 1) }}</text>
          </view>
        </view>
      </swiper-item>
    </swiper>
    <view class="leaders__dots">
      <view
        v-for="(l, i) in LEADERS"
        :key="l.name"
        class="leaders__dot"
        :class="{ 'leaders__dot--active': i === leaderIndex }"
      />
    </view>
    <view class="leaders__caption">
      <text class="leaders__caption-name">{{ currentLeader.name }}</text>
      <text class="leaders__caption-role">{{ currentLeader.role }}</text>
    </view>

    <view class="home__foot">
      <text class="text-placeholder">本页面数据来自本地 mock,切换真后端只需改 .env 一个变量</text>
    </view>

    <!-- 底部悬浮胶囊导航:theme="tag" 选中项带胶囊底色,split=false 去分隔线;文字放默认插槽显示在图标下方 -->
    <t-tab-bar :value="activePage" shape="round" theme="tag" :split="false" @change="onTabChange">
      <t-tab-bar-item value="/pages/index/index" icon="home">首页</t-tab-bar-item>
      <t-tab-bar-item value="/pages/community/index" icon="chat">社区</t-tab-bar-item>
      <t-tab-bar-item value="/pages/event/list" icon="app">事件</t-tab-bar-item>
      <t-tab-bar-item value="/pages/mine/index" icon="user">我的</t-tab-bar-item>
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

.section-title--compact {
  margin-left: 24rpx;
  margin-right: 24rpx;
  margin-bottom: 14rpx;
  padding-bottom: 0;
  padding-top: 0;
}

/* ── 乡会事件:区头(页面灰底)+ 白卡片正文,最新两条(左图右文) ── */
.home__events-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 28rpx 24rpx 16rpx;
}
.home__events-title {
  padding: 0 24rpx 0;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.home__events-more {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: var(--td-text-color-placeholder);
}
.home__events {
  /* 上间距由区头提供,这里不再留 */
  margin: 0 24rpx 20rpx;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-large);
  overflow: hidden;
}
.home__events-loading {
  display: flex;
  justify-content: center;
  padding: 32rpx 0;
}
.home__event {
  display: flex;
  padding: 24rpx;
}
.home__event--divided {
  border-top: 1rpx solid var(--td-border-level-1-color);
}
.home__event__cover {
  width: 180rpx;
  height: 132rpx;
  flex-shrink: 0;
  border-radius: var(--td-radius-default);
}
.home__event__cover--empty {
  background: var(--td-bg-color-secondarycontainer, #ededed);
}
.home__event__body {
  flex: 1;
  min-height: 132rpx;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.home__event__name {
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.45;
  color: var(--td-text-color-primary);
}
.home__event__time {
  font-size: 24rpx;
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
  margin-top: 14rpx;
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

/* ── 负责人风采:卡片式轮播(露边+相邻缩小)+ 联动字幕 ── */
.leaders__head {
  /* 上方双卡片不带下间距,由区头自己补足与上一块的间隔 */
  margin-top: 28rpx;
}
.leaders__swiper {
  height: 320rpx;
}
.leaders__slide {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.leaders__photo {
  width: 100%;
  height: 260rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 与页头 hero 同款渐变:照片素材到位前,头像卡直接用品牌色底 */
  background: linear-gradient(160deg, #0052d9 0%, #2f7bff 100%);
  border-radius: var(--td-radius-large);
  /* 非当前项整体缩小,即参考组件 scale-candidate 的「卡片主题」两侧效果 */
  transform: scale(0.85);
  transition: transform 0.3s ease;
}
.leaders__photo--active {
  transform: scale(1);
}
.leaders__initial {
  font-size: 96rpx;
  font-weight: 700;
  color: #fff;
}
.leaders__dots {
  display: flex;
  justify-content: center;
  gap: 12rpx;
  margin-top: 8rpx;
}
.leaders__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--td-border-level-1-color);
}
.leaders__dot--active {
  background: var(--td-brand-color);
}
.leaders__caption {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12rpx;
  margin: 20rpx 24rpx 0;
  padding: 26rpx 24rpx;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-large);
}
.leaders__caption-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.leaders__caption-role {
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
}
</style>
