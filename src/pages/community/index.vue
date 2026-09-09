<script setup lang="ts">
/**
 * 社区首页 —— 只保留两个入口卡片:美食基地、校园广场。
 */

function goFood() {
  uni.navigateTo({ url: '/pages/community/subpage?type=food' })
}

function goCampus() {
  uni.navigateTo({ url: '/pages/community/subpage?type=campus' })
}
</script>

<template>
  <view class="page community-home">
    <view class="community-home__cards">
      <view class="community-home__card" @click="goFood">
        <view class="community-home__card-main">
          <text class="community-home__card-title">美食基地</text>
          <text class="community-home__card-desc">探索地道潮汕味道</text>
        </view>
        <t-icon class="community-home__card-arrow" name="chevron-right" size="48rpx" />
      </view>

      <view class="community-home__card" @click="goCampus">
        <view class="community-home__card-main">
          <text class="community-home__card-title">校园广场</text>
          <text class="community-home__card-desc">校友交流、活动召集</text>
        </view>
        <t-icon class="community-home__card-arrow" name="chevron-right" size="48rpx" />
      </view>
    </view>
  </view>
</template>

<style lang="less" scoped>
.community-home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  /* padding 计入 100vh,避免页面多出 96rpx 滚动空间 */
  box-sizing: border-box;
  padding: 48rpx;
  background: #fff;
}
.community-home__cards {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
  width: 100%;
  max-width: 600rpx;
}
.community-home__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 240rpx;
  padding: 48rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.community-home__card:active {
  transform: scale(0.97);
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.12);
}
.community-home__card-main {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.community-home__card-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #1a1a1a;
}
.community-home__card-desc {
  font-size: 28rpx;
  color: var(--td-text-color-secondary);
}
.community-home__card-arrow {
  color: var(--td-text-color-placeholder);
}
</style>
