<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { AGREEMENTS } from '@/constants/legal'

onLoad(() => {
  uni.setNavigationBarTitle({ title: AGREEMENTS.agreement.title })
})
</script>

<template>
  <view class="page legal-page">
    <text class="legal-page__title">{{ AGREEMENTS.agreement.title }}</text>
    <view v-for="(section, i) in AGREEMENTS.agreement.sections" :key="i" class="legal-page__section">
      <text class="legal-page__section-title">{{ section.title || '前言' }}</text>
      <text class="legal-page__section-body">{{ section.body }}</text>
    </view>
  </view>
</template>

<style lang="less" scoped>
.legal-page {
  padding: 0 0 calc(40rpx + env(safe-area-inset-bottom));
}
.legal-page__title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--td-text-color-primary);
  text-align: center;
  padding: 56rpx 40rpx 40rpx;
}
.legal-page__section {
  margin-top: 40rpx;
}
.legal-page__section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--td-brand-color);
  margin-bottom: 16rpx;
}
.legal-page__section-body {
  display: block;
  font-size: 28rpx;
  line-height: 1.8;
  color: var(--td-text-color-primary);
  white-space: pre-wrap;
  padding-left: 16rpx;
}
</style>
