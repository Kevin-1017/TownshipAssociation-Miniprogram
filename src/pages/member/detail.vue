<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

/**
 * 成员详情 —— 占位页。
 *
 * 地图页点击图钉后跳转至此(路由在 pages.json 已注册)。
 * 联调时整份替换为真实资料展示:基本信息 / 简介 / 联系方式 + 乡会身份闸门。
 */

onLoad(() => {
  uni.setNavigationBarTitle({ title: '成员资料' })
})
</script>

<template>
  <view class="page placeholder">
    <t-empty description="功能开发中" />
  </view>
</template>

<style lang="less" scoped>
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
</style>
