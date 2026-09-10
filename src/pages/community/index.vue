<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

/**
 * 社区首页 —— 只保留两个入口卡片:美食基地、校园广场。
 */

/** 本页路径:tab bar 高亮;tab 页常驻缓存,返回时按它复位 */
const OWN_PATH = '/pages/community/index'

/** 当前页面路径（用于底部 tab bar 高亮） */
const activePage = ref(OWN_PATH)

const goFood = () => {
  uni.navigateTo({ url: '/pages/community/food' })
}

const goCampus = () => {
  uni.navigateTo({ url: '/pages/community/campus' })
}

const onTabChange = (e: { value: string }) => {
  // 四个 tab 已登记进 pages.json 的 tabBar.list,只能用 switchTab 互切
  uni.switchTab({ url: e.value })
}

onShow(() => {
  // tab 页不卸载:返回时把高亮复位成本页,并藏掉原生 tab bar(只留悬浮胶囊)
  activePage.value = OWN_PATH
  uni.hideTabBar()
})
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

    <!-- 底部悬浮胶囊导航:theme="tag" 选中项带胶囊底色,split=false 去分隔线;文字放默认插槽显示在图标下方 -->
    <t-tab-bar :value="activePage" shape="round" theme="tag" :split="false" @change="onTabChange">
      <t-tab-bar-item value="/pages/index/index" icon="home">首页</t-tab-bar-item>
      <t-tab-bar-item value="/pages/community/index" icon="chat">社区</t-tab-bar-item>
      <t-tab-bar-item value="/pages/event/list" icon="app">事件</t-tab-bar-item>
      <t-tab-bar-item value="/pages/mine/index" icon="user">我的</t-tab-bar-item>
    </t-tab-bar>
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
  padding: 48rpx 48rpx calc(48rpx + 100rpx + env(safe-area-inset-bottom));
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
  transition:
    transform 150ms ease,
    box-shadow 150ms ease;
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
