<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { formatRelative } from '@/utils/format'
import { communityApi } from '@/api/community'
import type { CommunityPost } from '@/types/community'
import VirtualList from './components/VirtualList.vue'

/**
 * 校园广场 —— 社区子页面(动态类型固定为 campus)。
 * 与美食基地拆成两份文件维护:两栏目的筛选口径、卡片样式后续会各自演化,
 * 共用一个参数化页面只会让分支越积越多。
 */

const searchKeyword = ref('')
const scrollY = ref(0)

// ---------- 动态数据 ----------
const allPosts = ref<CommunityPost[]>([])

/** 校园广场一期不分页,一次拉满(后端 pageSize 上限 100);返回本页时由 onShow 重拉 */
const fetchPosts = async () => {
  const res = await communityApi.getList({ type: 'campus', pageSize: 100 })
  allPosts.value = res.list
}

// ---------- 虚拟列表参数 ----------
const sysInfo = uni.getSystemInfoSync()
/** 列表项高度(px):卡片 160rpx,按设计稿换算 */
const ITEM_HEIGHT = Math.ceil((160 * sysInfo.windowWidth) / 750)
const VIEWPORT_HEIGHT = sysInfo.windowHeight || 600
const BUFFER_SIZE = 3
const PAGESIZE = Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + BUFFER_SIZE * 2

// ---------- 过滤 & 排序 ----------
const filteredPosts = computed(() =>
  [...allPosts.value]
    .filter((p) => p.type === 'campus')
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
  uni.navigateTo({ url: '/pages/community/publish-campus' })
}

const onSearch = () => {
  if (!searchKeyword.value.trim()) return
  uni.showToast({ title: '搜索: ' + searchKeyword.value, icon: 'none' })
}

const goDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/community/detail?id=${id}` })
}

// ---------- 生命周期 ----------
// 从发布页 navigateBack 回来时组件不销毁、setup 不重跑,新发的动态只能靠 onShow 重新拉
onShow(() => {
  fetchPosts()
})
</script>

<template>
  <view class="page campus">
    <!-- 吸顶搜索栏 -->
    <view class="campus__header">
      <view class="campus__search">
        <input
          v-model="searchKeyword"
          class="campus__search-input"
          placeholder="搜索校园动态"
          confirm-type="search"
          @confirm="onSearch"
        />
        <view class="campus__search-btn" @click="onSearch">搜索</view>
      </view>
      <view class="campus__publish" @click="onPublish">
        <t-icon name="add-circle-filled" size="48rpx" />
      </view>
    </view>

    <!-- 占位 -->
    <view class="campus__header-holder" />

    <!-- 列表 -->
    <VirtualList
      class="campus__scroll"
      :total-height="totalHeight"
      :top-height="topHeight"
      :bottom-height="bottomHeight"
      @scroll="handleScroll"
    >
      <view
        v-for="post in items"
        :key="post.id"
        class="campus__item"
        :style="{ marginBottom: '16rpx' }"
        @click="goDetail(post.id)"
      >
        <image
          v-if="post.avatar"
          class="campus__item-avatar"
          mode="aspectFill"
          :src="post.avatar"
        />
        <view v-else class="campus__item-avatar-placeholder">
          {{ post.author.slice(0, 1) }}
        </view>
        <view class="campus__item-body">
          <text class="campus__item-title ellipsis">{{ post.title }}</text>
          <text class="campus__item-content ellipsis-2">{{ post.content }}</text>
          <view class="campus__item-meta">
            <text class="campus__item-author">{{ post.author }}</text>
            <text class="campus__item-time">{{ formatRelative(post.publishTime) }}</text>
            <text class="campus__item-stat">赞 {{ post.likes }}</text>
            <text class="campus__item-stat">评 {{ post.comments }}</text>
          </view>
        </view>
      </view>
    </VirtualList>
  </view>
</template>

<style lang="less" scoped>
.campus {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

/* ---- 吸顶搜索栏 ---- */
.campus__header {
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
.campus__header-holder {
  height: 120rpx;
  flex-shrink: 0;
}
.campus__search {
  flex: 1;
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 8rpx 0 24rpx;
  border-radius: 36rpx;
  background: var(--td-bg-color-page);
}
.campus__search-input {
  flex: 1;
  height: 100%;
  font-size: 28rpx;
  color: var(--td-text-color-primary);
}
.campus__search-btn {
  padding: 0 24rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 28rpx;
  font-size: 26rpx;
  color: #fff;
  background: var(--td-brand-color);
}
.campus__publish {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  color: var(--td-brand-color);
}

/* ---- 滚动宿主 ---- */
.campus__scroll {
  flex: 1;
  min-height: 0;
}

/* ---- 列表项 ---- */
.campus__item {
  margin-left: 24rpx;
  margin-right: 24rpx;
  padding: 24rpx;
  display: flex;
  gap: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.campus__item-avatar,
.campus__item-avatar-placeholder {
  width: 80rpx;
  height: 80rpx;
  border-radius: 40rpx;
  flex-shrink: 0;
}
.campus__item-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-size: 34rpx;
}
.campus__item-body {
  flex: 1;
  min-width: 0;
}
.campus__item-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.campus__item-content {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}
.campus__item-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
</style>
