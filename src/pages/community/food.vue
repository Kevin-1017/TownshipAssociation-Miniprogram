<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { formatRelative } from '@/utils/format'
import { loadUserPosts } from '@/utils/community-posts'
import type { CommunityPost, CommunityRegion } from '@/types/community'
import VirtualList from './components/VirtualList.vue'

import postsRaw from '@/mock/data/community.json'

/**
 * 美食基地 —— 社区子页面(动态类型固定为 food)。
 * 与校园广场拆成两份文件维护:两栏目的筛选口径、卡片样式后续会各自演化,
 * 共用一个参数化页面只会让分支越积越多。
 */

const searchKeyword = ref('')
const scrollY = ref(0)

/** 菜系候选:先写死,后端字典接口就位后改为拉取 */
const CUISINE_OPTIONS = ['潮汕菜', '粤菜', '客家菜', '川菜', '湘菜', '西北菜', '日韩料理', '西餐']
/** 地区候选:与负责人风采的校区口径一致 */
const REGION_OPTIONS: { label: string; value: CommunityRegion }[] = [
  { label: '龙洞', value: 'longdong' },
  { label: '大学城', value: 'daxuecheng' },
]

const filterVisible = ref(false)
/** 已生效的筛选值:列表过滤只看这两份 */
const appliedCuisines = ref<string[]>([])
const appliedRegions = ref<CommunityRegion[]>([])
/** 面板内草稿:点「确定」才写回生效值,拉黑遮罩关闭则丢弃(表单草稿约定) */
const draftCuisines = ref<string[]>([])
const draftRegions = ref<CommunityRegion[]>([])

// ---------- 动态数据 ----------
/** 用户本地发布的动态排在静态 mock 之前;发布后从 publish 页返回时由 onShow 重新拉 */
const buildPosts = (): CommunityPost[] => [
  ...loadUserPosts(),
  ...(postsRaw as unknown as CommunityPost[]),
]
const allPosts = ref<CommunityPost[]>(buildPosts())

// ---------- 虚拟列表参数 ----------
const sysInfo = uni.getSystemInfoSync()
/** 列表项高度(px):卡片 160rpx,按设计稿换算 */
const ITEM_HEIGHT = Math.ceil((160 * sysInfo.windowWidth) / 750)
const VIEWPORT_HEIGHT = sysInfo.windowHeight || 600
const BUFFER_SIZE = 3
const PAGESIZE = Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + BUFFER_SIZE * 2

// ---------- 过滤 & 排序 ----------
/** 筛选按钮是否有生效值(有则高亮,提示用户列表被过滤) */
const hasFilter = computed(
  () => appliedCuisines.value.length > 0 || appliedRegions.value.length > 0,
)

const filteredPosts = computed(() =>
  [...allPosts.value]
    .filter((p) => p.type === 'food')
    // 空数组 = 该维度不限;命中要求动态带上了对应字段
    .filter(
      (p) =>
        appliedCuisines.value.length === 0 ||
        (p.cuisine !== undefined && appliedCuisines.value.includes(p.cuisine)),
    )
    .filter(
      (p) =>
        appliedRegions.value.length === 0 ||
        (p.region !== undefined && appliedRegions.value.includes(p.region)),
    )
    .sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime()),
)

/** 可见区间的起始索引 */
const startIdx = computed(() => {
  const base = Math.floor(scrollY.value / ITEM_HEIGHT)
  return Math.max(0, base - BUFFER_SIZE)
})

const endIdx = computed(() =>
  Math.min(filteredPosts.value.length, startIdx.value + PAGESIZE + BUFFER_SIZE),
)

const totalHeight = computed(() => `${filteredPosts.value.length * ITEM_HEIGHT}px`)
const topHeight = computed(() => `${startIdx.value * ITEM_HEIGHT}px`)
const bottomHeight = computed(
  () => `${(filteredPosts.value.length - endIdx.value) * ITEM_HEIGHT}px`,
)

const items = computed(() => filteredPosts.value.slice(startIdx.value, endIdx.value))

// ---------- 事件 ----------
const handleScroll = (_e: CustomEvent) => {
  scrollY.value = (_e.detail as { scrollTop: number })?.scrollTop ?? 0
}

const onPublish = () => {
  uni.navigateTo({ url: '/pages/community/publish-food' })
}

const onSearch = () => {
  if (!searchKeyword.value.trim()) return
  uni.showToast({ title: '搜索: ' + searchKeyword.value, icon: 'none' })
}

const goDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/community/detail?id=${id}` })
}

// ---------- 筛选 ----------
const openFilter = () => {
  // 每次打开都以「已生效值」初始化草稿,保证重开面板状态不丢
  draftCuisines.value = [...appliedCuisines.value]
  draftRegions.value = [...appliedRegions.value]
  filterVisible.value = true
}

/** check-tag 是受控组件,选中态由这份数组自己维护:再点一次即取消 */
const onToggleCuisine = (cuisine: string) => {
  draftCuisines.value = draftCuisines.value.includes(cuisine)
    ? draftCuisines.value.filter((c) => c !== cuisine)
    : [...draftCuisines.value, cuisine]
}

const onToggleRegion = (region: CommunityRegion) => {
  draftRegions.value = draftRegions.value.includes(region)
    ? draftRegions.value.filter((r) => r !== region)
    : [...draftRegions.value, region]
}

const onResetFilter = () => {
  draftCuisines.value = []
  draftRegions.value = []
}

const onConfirmFilter = () => {
  appliedCuisines.value = [...draftCuisines.value]
  appliedRegions.value = [...draftRegions.value]
  filterVisible.value = false
  // TODO 联调时:这里把 appliedCuisines/appliedRegions 作为查询参数请求列表接口,替换本地过滤
  scrollY.value = 0
}

// ---------- 生命周期 ----------
// 从发布页 navigateBack 回来时组件不销毁、setup 不重跑,新发的动态只能靠 onShow 重新拉
onShow(() => {
  allPosts.value = buildPosts()
})
</script>

<template>
  <view class="page food">
    <!-- 吸顶搜索栏:筛选按钮在搜索框左边,有生效筛选时高亮 -->
    <view class="food__header">
      <view class="food__filter" :class="{ 'food__filter--active': hasFilter }" @click="openFilter">
        <t-icon name="filter" size="36rpx" />
        <text class="food__filter-text">筛选</text>
      </view>
      <view class="food__search">
        <input
          v-model="searchKeyword"
          class="food__search-input"
          placeholder="搜索美食动态"
          confirm-type="search"
          @confirm="onSearch"
        />
        <view class="food__search-btn" @click="onSearch">搜索</view>
      </view>
      <view class="food__publish" @click="onPublish">
        <t-icon name="add-circle-filled" size="48rpx" />
      </view>
    </view>

    <!-- 占位 -->
    <view class="food__header-holder" />

    <!-- 列表 -->
    <VirtualList
      class="food__scroll"
      :total-height="totalHeight"
      :top-height="topHeight"
      :bottom-height="bottomHeight"
      @scroll="handleScroll"
    >
      <view
        v-for="post in items"
        :key="post.id"
        class="food__item"
        :style="{ marginBottom: '16rpx' }"
        @click="goDetail(post.id)"
      >
        <image v-if="post.avatar" class="food__item-avatar" mode="aspectFill" :src="post.avatar" />
        <view v-else class="food__item-avatar-placeholder">
          {{ post.author.slice(0, 1) }}
        </view>
        <view class="food__item-body">
          <text class="food__item-title ellipsis">{{ post.title }}</text>
          <text class="food__item-content ellipsis-2">{{ post.content }}</text>
          <view class="food__item-meta">
            <text class="food__item-author">{{ post.author }}</text>
            <text class="food__item-time">{{ formatRelative(post.publishTime) }}</text>
            <text class="food__item-stat">赞 {{ post.likes }}</text>
            <text class="food__item-stat">评 {{ post.comments }}</text>
          </view>
        </view>
      </view>
    </VirtualList>

    <!-- 筛选后无结果的空态 -->
    <view v-if="filteredPosts.length === 0" class="food__empty">
      <t-empty description="没有符合条件的动态,试试调整筛选" />
    </view>

    <!-- 筛选弹层:底部抽屉,菜系/地区两组可多选标签 -->
    <t-popup :visible="filterVisible" placement="bottom" @update:visible="filterVisible = $event">
      <view class="food__filter-panel">
        <text class="food__filter-group-title">按菜系</text>
        <view class="food__filter-tags">
          <t-check-tag
            v-for="c in CUISINE_OPTIONS"
            :key="c"
            :content="c"
            shape="round"
            variant="light-outline"
            :checked="draftCuisines.includes(c)"
            @change="onToggleCuisine(c)"
          />
        </view>
        <text class="food__filter-group-title">按地区</text>
        <view class="food__filter-tags">
          <t-check-tag
            v-for="r in REGION_OPTIONS"
            :key="r.value"
            :content="r.label"
            shape="round"
            variant="light-outline"
            :checked="draftRegions.includes(r.value)"
            @change="onToggleRegion(r.value)"
          />
        </view>
        <view class="food__filter-footer">
          <view class="food__filter-btn">
            <t-button variant="outline" block shape="round" @click="onResetFilter">重置</t-button>
          </view>
          <view class="food__filter-btn">
            <t-button theme="primary" block shape="round" @click="onConfirmFilter">确定</t-button>
          </view>
        </view>
      </view>
    </t-popup>
  </view>
</template>

<style lang="less" scoped>
.food {
  position: relative; /* 空态 absolute 的定位基准 */
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

/* ---- 吸顶搜索栏 ---- */
.food__header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
  height: 120rpx;
  box-sizing: border-box;
  background: #fff;
  border-bottom: 1rpx solid var(--td-border-level-1-color);
}
.food__header-holder {
  height: 120rpx;
  flex-shrink: 0;
}
.food__search {
  flex: 1;
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 8rpx 0 24rpx;
  border-radius: 36rpx;
  background: var(--td-bg-color-page);
}
.food__search-input {
  flex: 1;
  height: 100%;
  font-size: 28rpx;
  color: var(--td-text-color-primary);
}
.food__search-btn {
  padding: 0 24rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 28rpx;
  font-size: 26rpx;
  color: #fff;
  background: var(--td-brand-color);
}
.food__publish {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  color: var(--td-brand-color);
}

/* ---- 筛选入口(搜索框左侧) ---- */
.food__filter {
  display: flex;
  align-items: center;
  gap: 4rpx;
  height: 72rpx;
  padding: 0 20rpx;
  flex-shrink: 0;
  border-radius: 36rpx;
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-page);
}
/* 有生效筛选时用品牌色提醒「列表是被过滤过的」 */
.food__filter--active {
  color: var(--td-brand-color);
  background: var(--td-brand-color-focus);
}

/* ---- 筛选空态 ---- */
.food__empty {
  /* 盖在空列表区域上方:列表宿主是 flex:1 的空壳,不能用兄弟节点抢空间 */
  position: absolute;
  top: 240rpx;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

/* ---- 筛选弹层 ---- */
.food__filter-panel {
  /* 底部安全区留白由 t-popup--bottom 自带(padding-bottom: env(...)),这里不能再叠一次 */
  padding: 32rpx;
  border-radius: var(--td-radius-large) var(--td-radius-large) 0 0;
  background: var(--td-bg-color-container);
}
.food__filter-group-title {
  display: block;
  margin: 24rpx 0 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.food__filter-group-title:first-child {
  margin-top: 0;
}
/* check-tag 自动换行铺开,组内间距由 gap 控制 */
.food__filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.food__filter-footer {
  display: flex;
  gap: 24rpx;
  margin-top: 40rpx;
}
.food__filter-btn {
  flex: 1;
}

/* ---- 滚动宿主 ---- */
.food__scroll {
  flex: 1;
  min-height: 0;
}

/* ---- 列表项 ---- */
.food__item {
  margin-left: 24rpx;
  margin-right: 24rpx;
  padding: 24rpx;
  display: flex;
  gap: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.food__item-avatar,
.food__item-avatar-placeholder {
  width: 80rpx;
  height: 80rpx;
  border-radius: 40rpx;
  flex-shrink: 0;
}
.food__item-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-size: 34rpx;
}
.food__item-body {
  flex: 1;
  min-width: 0;
}
.food__item-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.food__item-content {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}
.food__item-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
</style>
