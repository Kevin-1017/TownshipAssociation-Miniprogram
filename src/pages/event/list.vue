<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { formatFull } from '@/utils/format'
import type { EventListItem } from '@/types/event'
import WindowedScrollView from './components/WindowedScrollView.vue'

/** 本页路径：tab bar 高亮；tab 页常驻缓存，返回时按它复位 */
const OWN_PATH = '/pages/event/list'

/** 当前页面路径（底部 tab bar 高亮） */
const activePage = ref(OWN_PATH)

const onTabChange = (e: { value: string }) => {
  // 四个 tab 已登记进 pages.json 的 tabBar.list，只能用 switchTab 互切
  uni.switchTab({ url: e.value })
}

/**
 * 事件列表 —— 虚拟窗口化列表。
 *
 * 布局:顶部「全部」按钮 + 起止年份选择器(t-picker,年份列 2000-2026);
 * 下方虚拟滚动区渲染事件卡片(左图、右标题 + 发布时间)。
 * 年份范围为默认值(2000-2026)时「全部」选中,任一变化则取消选中。
 */

// ---------- 静态数据 ----------
import eventsRaw from '@/mock/data/events.json'

const allEvents = ref<EventListItem[]>(eventsRaw as unknown as EventListItem[])

// 排序:按开始时间从近到远
allEvents.value.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

// ---------- 年份范围 ----------
const YEAR_MIN = 2000
const YEAR_MAX = 2026

/** 选择器选项:单列年份 2000-2026 */
const yearOptions = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => ({
  label: `${YEAR_MIN + i}年`,
  value: String(YEAR_MIN + i),
}))

// ---------- 状态 ----------
const startYear = ref(String(YEAR_MIN))
const endYear = ref(String(YEAR_MAX))
const pickerVisible = ref(false)
/** 当前正在选择的是哪一侧 */
const pickerSide = ref<'start' | 'end'>('start')
const scrollY = ref(0)

/** 「全部」是否选中:范围等于默认值 */
const isAll = computed(
  () => startYear.value === String(YEAR_MIN) && endYear.value === String(YEAR_MAX),
)

/** picker 的当前值由正在选择的一侧决定 */
const pickerValue = computed(() => [pickerSide.value === 'start' ? startYear.value : endYear.value])

const openPicker = (side: 'start' | 'end') => {
  pickerSide.value = side
  pickerVisible.value = true
}

const onPickerChange = (e: { value: string[] }) => {
  const v = e.value?.[0]
  if (!v) return
  if (pickerSide.value === 'start') {
    startYear.value = v
    // 开始年份不允许超过结束年份,超过则同步
    if (Number(v) > Number(endYear.value)) endYear.value = v
  } else {
    endYear.value = v
    if (Number(v) < Number(startYear.value)) startYear.value = v
  }
  scrollY.value = 0
  pickerVisible.value = false
}

const pickAll = () => {
  startYear.value = String(YEAR_MIN)
  endYear.value = String(YEAR_MAX)
  scrollY.value = 0
}

// ---------- 虚拟列表参数 ----------
const sysInfo = uni.getSystemInfoSync()
/** 列表顶部额外留白(px),避免第一项紧贴吸顶栏;24rpx 按设计稿换算 */
const TOP_PADDING = Math.ceil((24 * sysInfo.windowWidth) / 750)
/** 每项高度(px):卡片 200rpx + 间距 16rpx,按屏宽 750 设计稿换算 */
const ITEM_HEIGHT = Math.ceil(((200 + 16) * sysInfo.windowWidth) / 750)
const VIEWPORT_HEIGHT = sysInfo.windowHeight || 600
const BUFFER_SIZE = 3
/** 一屏能容纳的条数 + 上下缓冲 */
const PAGESIZE = Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + BUFFER_SIZE * 2

// ---------- 过滤 & 计算可见范围 ----------
const filtered = computed(() =>
  allEvents.value.filter((e) => {
    const y = new Date(e.startTime).getFullYear()
    return y >= Number(startYear.value) && y <= Number(endYear.value)
  }),
)

/** 可见区间的起始索引 */
const startIdx = computed(() => {
  const base = Math.floor(scrollY.value / ITEM_HEIGHT)
  return Math.max(0, base - BUFFER_SIZE)
})

const endIdx = computed(() =>
  Math.min(filtered.value.length, startIdx.value + PAGESIZE + BUFFER_SIZE),
)

const scrollHeight = computed(() => `${filtered.value.length * ITEM_HEIGHT + TOP_PADDING}px`)
const topHeight = computed(() => `${startIdx.value * ITEM_HEIGHT + TOP_PADDING}px`)
const bottomHeight = computed(() => `${(filtered.value.length - endIdx.value) * ITEM_HEIGHT}px`)

const items = computed(() => filtered.value.slice(startIdx.value, endIdx.value))

// ---------- 滚动回调 ----------
const handleScroll = (_e: CustomEvent) => {
  scrollY.value = (_e.detail as { scrollTop: number })?.scrollTop ?? 0
}

// ---------- 生命周期 ----------
onShow(() => {
  // tab 页不卸载:返回时把高亮复位成本页,并藏掉原生 tab bar(只留悬浮胶囊)
  activePage.value = OWN_PATH
  uni.hideTabBar()
})
</script>

<template>
  <view class="page elist">
    <!-- 顶部:全部按钮 + 起止年份选择(fixed 吸顶,正好在胶囊/导航栏下方) -->
    <view class="elist__bar">
      <text class="elist__pill" :class="{ 'elist__pill--active': isAll }" @click="pickAll">
        全部
      </text>

      <view class="elist__range">
        <view class="elist__range-side" @click="openPicker('start')">{{ startYear }}年</view>
        <t-icon class="elist__range-icon" name="swap-right" size="32rpx" />
        <view class="elist__range-side elist__range-side--right" @click="openPicker('end')">
          {{ endYear }}年
        </view>
      </view>
    </view>
    <!-- fixed 脱流后的等高占位:60rpx 内容 + 上下 24rpx padding -->
    <view class="elist__bar-holder" />

    <!-- 虚拟列表容器:flex 拉伸写在宿主节点上(小程序自定义组件的宿主是真实节点) -->
    <WindowedScrollView
      class="elist__scroll"
      :total-height="scrollHeight"
      :top-height="topHeight"
      :bottom-height="bottomHeight"
      @scroll="handleScroll"
    >
      <view
        v-for="e in items"
        :key="e.id"
        class="card item-card"
      >
        <image v-if="e.cover" class="item-card__cover" mode="aspectFill" :src="e.cover" lazy-load />
        <view v-else class="item-card__cover-placeholder" />

        <view class="item-card__body">
          <text class="item-card__title ellipsis-2">{{ e.title }}</text>
          <text class="item-card__time text-secondary">{{ formatFull(e.startTime) }}</text>
        </view>
      </view>
    </WindowedScrollView>

    <!-- 空状态 -->
    <view v-if="filtered.length === 0" class="elist__empty">
      <t-empty description="该时间范围内暂无事件" />
    </view>

    <!-- 年份选择器:单列,2000-2026 -->
    <t-picker
      :value="pickerValue"
      :visible="pickerVisible"
      title="选择时间"
      cancel-btn="取消"
      confirm-btn="确认"
      @update:visible="pickerVisible = $event"
      @change="onPickerChange"
      @cancel="pickerVisible = false"
    >
      <t-picker-item :options="yearOptions" />
    </t-picker>

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
.elist {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

/* ---- 顶部栏:吸顶在胶囊/导航栏下方 ---- */
.elist__bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
  background: #fff;
}
.elist__bar-holder {
  /* fixed 脱流后占位:60rpx 内容 + 上下 24rpx padding */
  height: 108rpx;
  flex-shrink: 0;
}
.elist__pill {
  height: 60rpx;
  line-height: 60rpx;
  padding: 0 30rpx;
  font-size: 26rpx;
  border-radius: 30rpx;
  white-space: nowrap;
  background: var(--td-bg-color-page);
  color: var(--td-text-color-secondary);
}
.elist__pill--active {
  background: var(--td-brand-color);
  color: #fff;
}

/* ---- 起止年份选择 ---- */
.elist__range {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60rpx;
  padding: 0 24rpx;
  border-radius: 30rpx;
  background: var(--td-bg-color-page);
}
.elist__range-side {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.elist__range-icon {
  color: var(--td-text-color-placeholder);
}

/* ---- 虚拟列表宿主节点:撑满剩余高度 ---- */
.elist__scroll {
  flex: 1;
  min-height: 0;
}

/* ---- 卡片 ---- */
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
  /* 覆盖全局 .card 的 20rpx;必须与 ITEM_HEIGHT 里的间距 16rpx 保持一致,虚拟列表才不会错位 */
  margin-bottom: 16rpx;
  /* 覆盖全局 .card 的 padding,保证实际高度与 ITEM_HEIGHT 换算一致 */
  padding: 0;
  display: flex;
  /* stretch:让右侧 body 撑满卡片高度(由封面 200rpx 决定),body 内的 space-between 才能把标题顶、时间底 */
  align-items: stretch;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.item-card__cover {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  border-radius: 16rpx 0 0 16rpx;
}
.item-card__cover-placeholder {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  background: #e8e8e8;
}
.item-card__body {
  flex: 1;
  padding: 24rpx 24rpx 24rpx 20rpx;
  display: flex;
  flex-direction: column;
  /* 标题在卡片顶部、时间在底部,与首页事件卡一致 */
  justify-content: space-between;
}
.item-card__title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.45;
}
.item-card__time {
  font-size: 24rpx;
}

.elist__empty {
  padding-top: 120rpx;
}
</style>
