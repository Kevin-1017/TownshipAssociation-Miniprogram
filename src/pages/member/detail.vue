<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import { industryLabel } from '@/constants/industry'
import { formatGrade } from '@/utils/format'
import type { MemberDetail } from '@/types/member'

/**
 * 成员详情。
 *
 * contactVisible 在这里控制**前端渲染**,但真正的权限过滤必须在后端做 ——
 * 前端隐藏不等于数据没下发。这条已记入 docs/API.md 的「隐私」一节。
 */

const member = ref<MemberDetail | null>(null)

const basicRows = computed(() => {
  const m = member.value
  if (!m) return []
  return [
    { k: '性别', v: m.gender === 1 ? '男' : m.gender === 2 ? '女' : '未填' },
    { k: '常驻地', v: `${m.province} ${m.city}${m.district ? ' ' + m.district : ''}` },
    { k: '行业', v: industryLabel(m.industry) },
    { k: '毕业院校', v: m.school },
    { k: '专业', v: m.major },
    { k: '届别', v: formatGrade(m.graduationYear) },
    { k: '入会时间', v: m.joinedAt },
  ]
})

function copyContact() {
  if (!member.value?.contactVisible) return
  uni.setClipboardData({
    data: member.value.wechatId ?? '',
    success: () => uni.showToast({ title: '微信号已复制', icon: 'success' }),
  })
}

onLoad(async (query) => {
  const id = (query as Record<string, string>)?.id
  if (!id) {
    uni.showToast({ title: '缺少成员 id', icon: 'none' })
    return
  }
  member.value = await memberApi.getDetail(id)
  if (member.value) {
    uni.setNavigationBarTitle({ title: member.value.name })
  }
})
</script>

<template>
  <view class="page detail">
    <view v-if="!member" class="detail__loading">
      <t-loading theme="circular" size="48rpx" text="加载成员资料" />
    </view>

    <template v-else>
      <view class="detail__hero">
        <t-avatar :image="member.avatar" size="large" shape="circle">
          {{ member.name.slice(0, 1) }}
        </t-avatar>
        <text class="detail__name">{{ member.name }}</text>
        <text class="detail__role">{{ member.title }} · {{ member.company }}</text>
        <view class="detail__tags">
          <t-tag theme="primary" variant="light" size="small">
            {{ member.province }}{{ member.city }}
          </t-tag>
          <t-tag v-if="member.district" theme="default" variant="outline" size="small">
            {{ member.district }}
          </t-tag>
          <t-tag theme="warning" variant="light" size="small">
            {{ industryLabel(member.industry) }}
          </t-tag>
        </view>
      </view>

      <view class="section-title"><text>基本信息</text></view>
      <view class="card detail__rows">
        <view v-for="r in basicRows" :key="r.k" class="detail__row">
          <text class="detail__k">{{ r.k }}</text>
          <text class="detail__v">{{ r.v }}</text>
        </view>
      </view>

      <view class="section-title"><text>个人简介</text></view>
      <view class="card">
        <text class="detail__bio">{{ member.bio }}</text>
      </view>

      <view class="section-title"><text>联系方式</text></view>
      <view class="card">
        <view v-if="member.contactVisible" class="detail__rows">
          <view class="detail__row">
            <text class="detail__k">微信号</text>
            <text class="detail__v">{{ member.wechatId }}</text>
          </view>
          <view class="detail__row">
            <text class="detail__k">手机号</text>
            <text class="detail__v">{{ member.phone }}</text>
          </view>
        </view>
        <view v-else class="detail__private">
          <text class="text-secondary">该乡贤未公开联系方式</text>
          <text class="text-placeholder">如需引荐,请联系乡会秘书处</text>
        </view>
      </view>

      <view class="detail__foot safe-bottom">
        <t-button theme="primary" block :disabled="!member.contactVisible" @click="copyContact">
          {{ member.contactVisible ? '复制微信号' : '联系方式未公开' }}
        </t-button>
      </view>
    </template>
  </view>
</template>

<style lang="less" scoped>
.detail {
  padding-bottom: 40rpx;
}
.detail__loading {
  display: flex;
  justify-content: center;
  padding-top: 200rpx;
}
.detail__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 40rpx 40rpx;
  background: linear-gradient(160deg, #0052d9 0%, #2f7bff 100%);
  color: #fff;
}
.detail__name {
  margin-top: 20rpx;
  font-size: 40rpx;
  font-weight: 700;
}
.detail__role {
  margin-top: 8rpx;
  font-size: 26rpx;
  opacity: 0.9;
}
.detail__tags {
  display: flex;
  gap: 12rpx;
  margin-top: 24rpx;
  flex-wrap: wrap;
  justify-content: center;
}
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.section-title {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.detail__rows {
  padding: 8rpx 0;
}
.detail__row {
  display: flex;
  padding: 14rpx 0;
}
.detail__k {
  width: 160rpx;
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
}
.detail__v {
  flex: 1;
  font-size: 26rpx;
  color: var(--td-text-color-primary);
}
.detail__bio {
  font-size: 28rpx;
  line-height: 1.7;
  color: var(--td-text-color-primary);
}
.detail__private {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 16rpx 0;
}
.detail__foot {
  padding: 40rpx 24rpx 20rpx;
}
</style>
