<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { noticeApi } from '@/api/notice'
import { formatMonthDay } from '@/utils/format'
import type { NoticeItem } from '@/types/notice'

const notice = ref<NoticeItem | null>(null)

onLoad(async (query) => {
  const id = (query as Record<string, string>)?.id
  if (id) notice.value = await noticeApi.getDetail(id)
})
</script>

<template>
  <view class="page ndetail">
    <template v-if="notice">
      <text class="ndetail__title">{{ notice.title }}</text>
      <text class="ndetail__time">{{ formatMonthDay(notice.publishedAt) }} · 乡会秘书处</text>
      <view class="ndetail__rule" />
      <!--
        公告正文含换行,用 white-space: pre-wrap 直接渲染纯文本。
        如果将来要支持加粗/图片,后端会返回富文本 HTML,那时必须改用
        <rich-text :nodes="...">,小程序里没有 v-html。
      -->
      <text class="ndetail__body">{{ notice.content }}</text>
    </template>
    <view v-else class="ndetail__loading">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>
  </view>
</template>

<style lang="less" scoped>
.ndetail {
  padding: 40rpx 32rpx 60rpx;
  background: #fff;
  min-height: 100vh;
}
.ndetail__title {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.4;
}
.ndetail__time {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.ndetail__rule {
  height: 1px;
  background: var(--td-border-level-1-color);
  margin: 28rpx 0;
}
.ndetail__body {
  font-size: 30rpx;
  line-height: 1.8;
  white-space: pre-wrap;
  color: var(--td-text-color-primary);
}
.ndetail__loading {
  display: flex;
  justify-content: center;
  padding-top: 200rpx;
}
</style>
