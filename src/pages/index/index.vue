<template>
  <!-- 临时验证页:确认 TDesign easycom + theme.less + Pinia 三者都生效。步骤 13 会重写为正式首页。 -->
  <view class="verify">
    <text class="hint">TDesign easycom 验证</text>

    <t-button theme="primary" @click="count++">主要按钮(t-button)</t-button>
    <t-button theme="default" variant="outline">空心按钮</t-button>

    <view class="row">
      <t-tag theme="primary">标签</t-tag>
      <t-tag theme="success" variant="light">成功</t-tag>
      <t-loading theme="circular" size="40rpx" />
    </view>

    <t-avatar image="" size="medium">汕</t-avatar>

    <text class="count">Pinia 计数:{{ store.count }} / 本地计数:{{ count }}</text>
    <t-button theme="light" size="small" @click="store.increment()">走 store</t-button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useVerifyStore } from '@/stores/verify'

const count = ref(0)
const store = useVerifyStore()
</script>

<style lang="less" scoped>
.verify {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 40rpx;
}
.hint {
  font-size: 26rpx;
  color: #999;
}
.row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.count {
  font-size: 28rpx;
}
</style>
