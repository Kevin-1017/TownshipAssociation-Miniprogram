<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { formatRelative } from '@/utils/format'
import { communityApi } from '@/api/community'
import type { CommunityPost } from '@/types/community'

/** 头像色板:基于姓名哈希,同一个作者总是同一种颜色 */
const AVATAR_COLORS = ['#0052d9', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad', '#1abc9c', '#e67e22']

/** 哈希函数:简单字符累加取模 */
const hashName = (name: string): number => {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return h
}

/**
 * 社区动态详情页 —— 承载美食基地 / 校园广场两类动态的通用详情。
 * 按路由 id 从后端拉取帖子详情(含评论列表);拉取失败提示「动态不存在」并返回。
 */

// ---------- refs / reactive:原始状态 ----------
/** 当前浏览的帖子;null 表示加载失败或未找到 */
const post = ref<CommunityPost | null>(null)
/** 点赞态:本地点击后切换为 heart-fill(已赞);一期服务端只加不减 */
const liked = ref(false)
/** 评论输入框文本 */
const commentText = ref('')
/** 正在发表评论的加载态 */
const submitting = ref(false)

// ---------- computed:派生状态 ----------
/** 图片展示:最多 3 张缩略图,多余的不渲染但显示 "+N" */
const displayImages = computed(() => {
  const imgs = post.value?.images ?? []
  return imgs.slice(0, 3)
})

/** 剩余未展示的图片数量 */
const moreCount = computed(() => {
  const imgs = post.value?.images ?? []
  return Math.max(0, imgs.length - 3)
})

// ---------- 方法 ----------
/** 获取作者头像背景色:同名的作者色一致 */
const getInitialColor = (author: string): string => {
  return AVATAR_COLORS[hashName(author)]
}

/** 预览图片:单张大图或多图滑动 */
const onPreviewImage = (src: string) => {
  const imgs = post.value?.images ?? []
  if (!imgs.length) return
  uni.previewImage({ urls: imgs, current: src })
}

/** 点赞:调用后端计数 +1(一期无身份,不支持取消点赞,重复点击就地拦下) */
const onLike = async () => {
  if (!post.value || liked.value) return
  try {
    const newLikes = await communityApi.like(post.value.id)
    liked.value = true
    post.value.likes = newLikes
  } catch {
    // 失败由 request 层统一 toast,这里只吞掉异常避免未处理拒绝
  }
}

/** 提交评论:校验非空 + 防重复点击;成功后把服务端返回的评论插到列表最前 */
const onSubmitComment = async () => {
  const text = commentText.value.trim()
  if (!text || !post.value || submitting.value) return
  submitting.value = true
  try {
    const created = await communityApi.addComment(post.value.id, { author: '我', content: text })
    post.value.commentsList = [created, ...(post.value.commentsList ?? [])]
    post.value.comments += 1
    commentText.value = ''
  } catch {
    // 失败由 request 层统一 toast
  } finally {
    submitting.value = false
  }
}

/** 取消发表(清输入框) */
const onCancelComment = () => {
  commentText.value = ''
}

// ---------- 生命周期 ----------
onLoad(async (options) => {
  const query = options as Record<string, string>
  const id = query?.id
  if (!id) return
  try {
    const detail = await communityApi.getDetail(id)
    post.value = detail
    // 标题设为帖子标题,方便返回时识别来源
    uni.setNavigationBarTitle({ title: detail.title.slice(0, 20) || '动态详情' })
  } catch {
    uni.showToast({ title: '动态不存在', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
  }
})

/** 分享配置 */
onShareAppMessage(() => ({
  title: post.value?.title ?? '校友社区动态',
  imageUrl: post.value?.images?.[0] ?? '',
}))
</script>

<template>
  <view class="page detail">
    <template v-if="post">
      <!-- ---- Hero: 标题 + 作者信息 ---- -->
      <view class="detail__hero">
        <text class="detail__title">{{ post.title }}</text>
        <view class="detail__meta">
          <view class="detail__author-row">
            <view
              class="detail__avatar-placeholder"
              :style="{ color: post.author ? getInitialColor(post.author) : '' }"
            >
              {{ post.author?.[0] ?? '?' }}
            </view>
            <text class="detail__author-name">{{ post.author }}</text>
          </view>
          <text class="detail__time">{{ formatRelative(post.publishTime) }}</text>
          <!-- 菜系/地区标签仅 food 类型显示 -->
          <view v-if="post.type === 'food'" class="detail__tags">
            <t-tag v-if="post.cuisine" size="small" variant="light">
              {{ post.cuisine }}
            </t-tag>
            <t-tag v-if="post.region" size="small" variant="light">
              {{
                post.region === 'longdong'
                  ? '龙洞'
                  : post.region === 'daxuecheng'
                    ? '大学城'
                    : post.region
              }}
            </t-tag>
          </view>
        </view>
      </view>

      <!-- ---- 正文 + 评论输入(合并在一块中无间距) ---- -->
      <view class="card detail__content-card">
        <text class="detail__content">{{ post.content }}</text>

        <!-- ---- 图片预览区 ---- -->
        <view v-if="post.images?.length" class="detail__image-grid">
          <view
            v-for="(imgUrl, i) in displayImages"
            :key="imgUrl"
            class="detail__img-thumb"
            :class="i === 2 && moreCount ? 'detail__img-thumb--more' : ''"
            @click="onPreviewImage(imgUrl)"
          >
            <image class="detail__img-thumb-img" mode="aspectFill" :src="imgUrl" />
            <view v-if="i === 2 && moreCount" class="detail__img-more">+{{ moreCount }}</view>
          </view>
        </view>

        <!-- 评论输入区(在内容卡片内部) -->
        <view v-if="post" class="detail__input-bar-inline">
          <!-- 左边点赞按钮 -->
          <view class="detail__action-btn detail__action-btn--compact" @click="onLike">
            <t-icon
              :name="liked ? 'heart-filled' : 'heart'"
              size="28rpx"
              :color="liked ? '#e74c3c' : 'var(--td-text-color-placeholder)'"
            />
            <text class="detail__action-text">{{ post.likes }}</text>
          </view>
          <input
            v-model="commentText"
            class="detail__input"
            placeholder="说点什么..."
            maxlength="200"
            confirm-type="send"
            :disabled="submitting"
            @confirm="onSubmitComment"
          />
          <view v-if="commentText.trim()" class="detail__btn-clear" @click="onCancelComment">
            <t-icon name="close" size="28rpx" color="var(--td-text-color-secondary)" />
          </view>
          <t-button
            theme="primary"
            size="small"
            shape="round"
            :loading="submitting"
            :disabled="!commentText.trim()"
            @click="onSubmitComment"
          >
            发送
          </t-button>
        </view>
      </view>

      <!-- ---- 评论列表(内容卡片之外,独立展示) ---- -->
      <view v-if="!post.commentsList?.length" class="card detail__empty-comments">
        <t-empty description="暂无评论,来抢沙发吧~" />
      </view>

      <view v-else class="detail__comment-list">
        <!-- 全量展示所有评论 -->
        <template v-for="c in post.commentsList ?? []" :key="c.id">
          <view class="card detail__comment">
            <view
              class="detail__comment-avatar"
              :style="{ color: c.author ? getInitialColor(c.author) : '' }"
            >
              {{ c.author?.[0] ?? '?' }}
            </view>
            <view class="detail__comment-body">
              <view class="detail__comment-header">
                <text class="detail__comment-author">{{ c.author }}</text>
                <text class="detail__comment-time">{{ formatRelative(c.createTime) }}</text>
              </view>
              <text class="detail__comment-text">{{ c.content }}</text>
            </view>
          </view>
        </template>
      </view>

      <!-- 底部占位:给内容卡片内的评论输入栏留空间 -->
      <view class="detail__safe-spacer" />
    </template>

    <!-- 加载中 -->
    <view v-else class="detail__loading">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>
  </view>
</template>

<style lang="less" scoped>
.detail {
  padding-bottom: 40rpx;
  background: #f5f5f5;
  min-height: 100vh;
}

/* ---- Hero ---- */
.detail__hero {
  padding: 40rpx 32rpx 32rpx;
  background: #fff;
}
.detail__title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--td-text-color-primary);
  line-height: 1.5;
}
.detail__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}
.detail__author-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.detail__author-name {
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
}
.detail__time {
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
.detail__tags {
  display: flex;
  gap: 8rpx;
  margin-left: auto;
}
.detail__avatar-placeholder,
.detail__comment-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-brand-color-light);
  font-size: 24rpx;
  font-weight: 600;
  color: var(--td-brand-color);
  flex-shrink: 0;
}

/* ---- 正文+操作栏合并卡片 ---- */
.detail__content-card {
  display: flex;
  flex-direction: column;
}
/* ---- 正文 ---- */
.detail__content {
  display: block;
  font-size: 28rpx;
  line-height: 1.8;
  color: var(--td-text-color-primary);
  white-space: pre-wrap;
}

/* ---- 图片网格(在内容卡片内部,不需要独立 card 边距) ---- */
.detail__image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}
.detail__img-thumb {
  position: relative;
  width: 210rpx;
  height: 210rpx;
  border-radius: 12rpx;
  overflow: hidden;
}
.detail__img-thumb-img {
  width: 100%;
  height: 100%;
}
.detail__img-thumb--more {
  cursor: pointer;
}
.detail__img-more {
  position: absolute;
  right: 8rpx;
  bottom: 8rpx;
  padding: 4rpx 12rpx;
  font-size: 22rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8rpx;
}

/* ---- 操作栏按钮(复用自原操作栏) ---- */
.detail__action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.detail__action-text {
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
/* 紧凑版操作按钮(不撑满):用在输入栏左侧 */
.detail__action-btn--compact {
  flex: none !important;
}

/* ---- 空评论 ---- */
.detail__empty-comments {
  padding: 60rpx 0;
}

/* ---- 评论列表 ---- */
.detail__comment-list {
  padding-bottom: 20rpx;
}
.detail__comment {
  display: flex;
  gap: 16rpx;
  padding: 24rpx;
}
.detail__comment-avatar {
  margin-top: 4rpx; /* 垂直对齐第一行文字 */
}
.detail__comment-body {
  flex: 1;
  min-width: 0;
}
.detail__comment-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 8rpx;
}
.detail__comment-author {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.detail__comment-time {
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
.detail__comment-text {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--td-text-color-primary);
}

/* ---- 评论输入栏(内容卡片内部) ---- */
.detail__input-bar-inline {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 24rpx;
}
.detail__input {
  flex: 1;
  height: 64rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-page);
  border-radius: 32rpx;
}
.detail__btn-clear {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---- 加载中 ---- */
.detail__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

/* ---- 安全占位(评论输入栏在卡片内,减少占位) ---- */
.detail__safe-spacer {
  height: 40rpx;
}
</style>
