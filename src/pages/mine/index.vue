<template>
  <view class="page mine">
    <view class="mine__hero">
      <t-avatar :image="user.profile?.avatar ?? ''" size="large" shape="circle">
        {{ user.displayName.slice(0, 1) }}
      </t-avatar>
      <view class="mine__hero-body">
        <text class="mine__name">{{ user.displayName }}</text>
        <text class="mine__sub">
          {{
            user.isLogin
              ? `${user.profile?.province ?? ''}${user.profile?.city ?? ''} · ${industryLabel(user.profile?.industry ?? '')}`
              : '尚未登录'
          }}
        </text>
      </view>
      <text class="mine__login" @click="onLogin">{{ user.isLogin ? '已登录' : 'mock 登录' }}</text>
    </view>

    <view class="mine__stats">
      <view class="mine__stat">
        <text class="mine__stat-num">{{ memberTotal }}</text>
        <text class="mine__stat-label">乡贤总数</text>
      </view>
      <view class="mine__stat">
        <text class="mine__stat-num">{{ myCityCount }}</text>
        <text class="mine__stat-label">同城老乡</text>
      </view>
      <view class="mine__stat">
        <text class="mine__stat-num">0</text>
        <text class="mine__stat-label">我的报名</text>
      </view>
    </view>

    <view class="section-title"><text>乡会事务</text></view>
    <view class="card mine__menu">
      <view v-for="m in MENUS" :key="m.label" class="mine__cell" @click="onMenu(m)">
        <text class="mine__cell-label">{{ m.label }}</text>
        <text class="mine__cell-hint">{{ m.hint }}</text>
        <text class="mine__cell-arrow">›</text>
      </view>
    </view>

    <view class="card mine__about">
      <text class="mine__about-title">关于本小程序</text>
      <text class="mine__about-body">
        汕头乡会官方小程序,基于 uni-app(Vue 3 + TypeScript)构建, UI 使用腾讯 TDesign
        组件库,数据当前来自本地 mock。 它与将来的 React 官网共用同一套 Spring Boot 后端接口。
      </text>
      <text class="mine__version">版本 {{ version }} · 编译器 Node {{ nodeHint }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { memberApi } from '@/api/member'
import { industryLabel } from '@/constants/industry'

/**
 * 我的 —— 第一阶段占位页。
 *
 * 「mock 登录」调的是假接口(不校验 code,直接发假 token),
 * 只为了让这条链路在 UI 上走得通、可演示。真正的微信登录要等
 * tsa-api 提供 code2session,见 docs/API.md「鉴权」。
 */

const user = useUserStore()
const { isLogin } = storeToRefs(user)

const memberTotal = ref(0)
const myCityCount = ref(0)
const version = '0.1.0'
const nodeHint = '24 LTS'

const MENUS = [
  { label: '我的资料', hint: '第二阶段', action: 'todo' },
  { label: '我的报名', hint: '第二阶段', action: 'todo' },
  { label: '乡会架构与理事名单', hint: '待补内容', action: 'todo' },
  { label: '联系秘书处', hint: '', action: 'call' },
  { label: '意见反馈', hint: '', action: 'todo' },
] as const

onShow(async () => {
  if (isLogin.value) await user.fetchProfile()
  const stats = await memberApi.getProvinceStats()
  memberTotal.value = stats.reduce((s, p) => s + p.count, 0)
  myCityCount.value = (
    await memberApi.getList({ city: user.profile?.city || '汕头市', pageSize: 1 })
  ).total
})

async function onLogin() {
  if (user.isLogin) {
    user.logout()
    uni.showToast({ title: '已退出(mock)', icon: 'none' })
    return
  }
  await user.loginWithCode('mock-code')
  uni.showToast({ title: 'mock 登录成功', icon: 'success' })
}

function onMenu(m: (typeof MENUS)[number]) {
  if (m.action === 'call') {
    uni.makePhoneCall({ phoneNumber: '07548888000' })
    return
  }
  uni.showToast({ title: `${m.label}:该功能在第二阶段实现`, icon: 'none' })
}
</script>

<style lang="less" scoped>
.mine {
  padding-bottom: 40rpx;
}
.mine__hero {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 60rpx 40rpx 44rpx;
  background: linear-gradient(160deg, #0052d9 0%, #2f7bff 100%);
  color: #fff;
}
.mine__hero-body {
  flex: 1;
}
.mine__name {
  font-size: 38rpx;
  font-weight: 700;
}
.mine__sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  opacity: 0.85;
}
.mine__login {
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 30rpx;
}
.mine__stats {
  display: flex;
  margin: -28rpx 24rpx 0;
  padding: 26rpx 0;
  background: #fff;
  border-radius: var(--td-radius-large);
  box-shadow: 0 8rpx 24rpx rgba(0, 82, 217, 0.12);
  position: relative;
}
.mine__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.mine__stat-num {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--td-brand-color);
}
.mine__stat-label {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--td-text-color-secondary);
}
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.section-title {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.mine__menu {
  padding: 0 24rpx;
}
.mine__cell {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}
.mine__cell:last-child {
  border-bottom: none;
}
.mine__cell-label {
  flex: 1;
  font-size: 28rpx;
}
.mine__cell-hint {
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.mine__cell-arrow {
  margin-left: 12rpx;
  font-size: 34rpx;
  color: var(--td-text-color-placeholder);
}
.mine__about {
  margin-top: 40rpx;
}
.mine__about-title {
  font-size: 28rpx;
  font-weight: 600;
}
.mine__about-body {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: var(--td-text-color-secondary);
}
.mine__version {
  display: block;
  margin-top: 18rpx;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
</style>
