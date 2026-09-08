<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

/**
 * 社区动态详情占位。
 */

onLoad((options) => {
  console.log('[community/detail] id=', options?.id)
})
</script>

<template>
  <view class="page detail">
    <text class="detail__tip">动态详情页开发中</text>
  </view>
</template>

<style lang="less" scoped>
.detail {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #fff;
}
.detail__tip {
  font-size: 32rpx;
  color: var(--td-text-color-secondary);
}
</style>
