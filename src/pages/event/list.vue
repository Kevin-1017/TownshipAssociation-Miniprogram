<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import { eventApi } from '@/api/event'
import { buildFileUrl } from '@/utils/request'
import { formatFull } from '@/utils/format'
import type { EventListItem } from '@/types/event'
import WindowedScrollView from './components/WindowedScrollView.vue'

/**
 * 事件列表 —— 虚拟窗口化列表。
 *
 * 数据走 GET /tsa/events(C5,公开):pageSize=50 顺序翻页累计至 total,
 * 封顶 10 页(500 条)防后端 total 异常时死循环;失败降级空列表 + t-empty,
 * 本页 silentError/showLoading 全静默 —— tab 页每次 onShow 都刷,弹脸会打断浏览。
 * 年份过滤保持客户端做(全量已在手,没必要为过滤再发请求)。
 *
 * 布局:顶部「全部」按钮 + 起止年份选择器(t-picker,年份列 2000~动态上限);
 * 下方虚拟滚动区渲染事件卡片(左图、右标题 + 发布时间),点卡片进详情。
 * 年份上限 = max(当年, 已拉取数据最大事件年) —— 不硬编码,跨年新事件不会掉出筛选范围;
 * 范围为默认区间(未手动调过)时「全部」选中,任一变化则取消选中。
 */

/** 本页路径:tab bar 高亮;tab 页常驻缓存,返回时按它复位 */
const OWN_PATH = '/pages/event/list'
/** 每页拉 50 条 = C5 的 pageSize 钳制上限,翻页次数最少 */
const FETCH_SIZE = 50
/** 翻页封顶:500 条对乡会事件绰绰有余,total 异常时防死循环 */
const MAX_PAGES = 10
/** 年份范围下限:本会事件不涉及 2000 年前 */
const YEAR_MIN = 2000
/**
 * 年份上限不能像旧版那样硬编码 2026:2027-01-01 起新插的活动会在首页出现
 * (latestEvents 不做年份过滤)却永远落不进列表的 picker 区间,用户无法自救。
 * 兜底取当年,再被已拉取数据的最大 startTime 年份抬高(upcoming 活动开始时间可到明年)——
 * 见 computed yearMax。
 */
const CURRENT_YEAR = new Date().getFullYear()

// ---------- 状态 ----------
/** 当前页面路径(底部 tab bar 高亮) */
const activePage = ref(OWN_PATH)
const allEvents = ref<EventListItem[]>([])
const isLoading = ref(false)

const startYear = ref(String(YEAR_MIN))
const endYear = ref(String(CURRENT_YEAR))
/** 用户从未手动调过区间:每次全量拉取后 endYear 跟随动态上限;调过则尊重其选择 */
const isRangeUntouched = ref(true)
const pickerVisible = ref(false)
/** 当前正在选择的是哪一侧 */
const pickerSide = ref<'start' | 'end'>('start')
const scrollY = ref(0)

// ---------- computed:派生状态 ----------
/** 年份上限:当年与已拉取数据最大事件年取大(数据里出现更晚年份时 picker 选项随之延长) */
const yearMax = computed(() =>
  allEvents.value.reduce(
    (m, e) => Math.max(m, new Date(e.startTime).getFullYear()),
    CURRENT_YEAR,
  ),
)

/** 选择器选项:单列年份 YEAR_MIN~yearMax,数据加载后跟着上限重算 */
const yearOptions = computed(() =>
  Array.from({ length: yearMax.value - YEAR_MIN + 1 }, (_, i) => ({
    label: `${YEAR_MIN + i}年`,
    value: String(YEAR_MIN + i),
  })),
)

/** 「全部」是否选中:范围等于当前(动态)默认区间 */
const isAll = computed(
  () => startYear.value === String(YEAR_MIN) && endYear.value === String(yearMax.value),
)

/** picker 的当前值由正在选择的一侧决定 */
const pickerValue = computed(() => [pickerSide.value === 'start' ? startYear.value : endYear.value])

const filtered = computed(() =>
  allEvents.value.filter((e) => {
    const y = new Date(e.startTime).getFullYear()
    return y >= Number(startYear.value) && y <= Number(endYear.value)
  }),
)

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

/** 空列表时的提示:拉取中给 spinner,失败/确认没数据才给 t-empty(不然「失败」长得像「没有」) */
const isEmptyDone = computed(() => !isLoading.value && filtered.value.length === 0)

// ---------- 方法 ----------
const onTabChange = (e: { value: string }) => {
  // 四个 tab 已登记进 pages.json 的 tabBar.list,只能用 switchTab 互切
  uni.switchTab({ url: e.value })
}

/** 后端 cover 可能是 /tsa/files 相对路径或外链,buildFileUrl 统一成可渲染地址 */
const coverSrc = (cover: string | null): string => (cover ? buildFileUrl(cover) : '')

const goDetail = (id: string) => {
  // 详情页在 D2 后是真页面(封面+摘要+跳公众号文章),navigateTo 入栈
  uni.navigateTo({ url: `/pages/event/detail?id=${id}` })
}

const openPicker = (side: 'start' | 'end') => {
  pickerSide.value = side
  pickerVisible.value = true
}

const onPickerChange = (e: { value: string[] }) => {
  const v = e.value?.[0]
  if (!v) return
  // 用户手动定过区间后,不再被后续拉取的动态上限覆盖(否则选「2020-2020」会被默默拉回全range)
  isRangeUntouched.value = false
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
  endYear.value = String(yearMax.value)
  // 点「全部」= 交还给动态上限,之后的拉取继续跟随
  isRangeUntouched.value = true
  scrollY.value = 0
}

const handleScroll = (_e: CustomEvent) => {
  scrollY.value = (_e.detail as { scrollTop: number })?.scrollTop ?? 0
}

/**
 * 全量拉取(年份过滤在客户端,所以一次拿完)。
 * 旧版这里直接 import mock/events.json —— 生产构建会带 100 条假事件进包
 * (「联调三大坑」同款),现在无论 mock/真后端都走 eventApi。
 */
const loadEvents = async () => {
  if (isLoading.value) return
  isLoading.value = true
  try {
    const acc: EventListItem[] = []
    let total = Infinity
    for (let page = 1; page <= MAX_PAGES && acc.length < total; page++) {
      const res = await eventApi.getList(
        { page, pageSize: FETCH_SIZE },
        { showLoading: false, silentError: true },
      )
      total = res.total
      acc.push(...res.list)
      // 后端回空页(数据比 total 少)直接停,防无限累加
      if (res.list.length === 0) break
    }
    // 后端排序已是 start_time DESC,本地再排一次只为翻页拼接后绝对稳序
    acc.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    allEvents.value = acc
  } catch (err) {
    // 拉取失败:降级空列表(t-empty 兜表现),保留旧数据反而误导「这些是真事件」
    console.warn('[eventList] 事件拉取失败', err)
    allEvents.value = []
  } finally {
    isLoading.value = false
    // 未手动调过区间时,结束年份锚到新的动态上限(数据里出现更晚年份 → 立即可见);
    // 失败降级空列表同理(上限回落到当年,与空数据自洽)
    if (isRangeUntouched.value) endYear.value = String(yearMax.value)
  }
}

// ---------- 生命周期 ----------
onShow(() => {
  // tab 页不卸载:返回时把高亮复位成本页,并藏掉原生 tab bar(只留悬浮胶囊)
  activePage.value = OWN_PATH
  uni.hideTabBar()
  loadEvents()
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
      <view v-for="e in items" :key="e.id" class="card item-card" @click="goDetail(e.id)">
        <image
          v-if="e.cover"
          class="item-card__cover"
          mode="aspectFill"
          :src="coverSrc(e.cover)"
          lazy-load
        />
        <view v-else class="item-card__cover-placeholder" />

        <view class="item-card__body">
          <text class="item-card__title ellipsis-2">{{ e.title }}</text>
          <text class="item-card__time text-secondary">{{ formatFull(e.startTime) }}</text>
        </view>
      </view>
    </WindowedScrollView>

    <!-- 拉取中转圈;完成(含失败降级)后仍为空才是真「空」 -->
    <view v-if="filtered.length === 0 && isLoading" class="elist__empty">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>
    <view v-else-if="isEmptyDone" class="elist__empty">
      <t-empty description="该时间范围内暂无事件" />
    </view>

    <!-- 年份选择器:单列,YEAR_MIN~yearMax(上限随数据动态延长) -->
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
      <t-tab-bar-item value="/pages/community/index" icon="chat">广场</t-tab-bar-item>
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
  border-radius: var(--td-radius-round);
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
  border-radius: var(--td-radius-round);
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
  border-radius: var(--td-radius-large);
  overflow: hidden;
}
.item-card__cover {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  border-radius: var(--td-radius-large) 0 0 var(--td-radius-large);
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
  display: flex;
  justify-content: center;
}
</style>
