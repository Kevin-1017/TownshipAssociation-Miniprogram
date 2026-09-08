<script setup lang="ts">
import { computed } from 'vue'
import { industryLabel } from '@/constants/industry'
import type { MemberListItem } from '@/types/member'

/**
 * 乡贤列表项。
 *
 * avatarUrl 为空时由 t-avatar 的默认插槽渲染姓氏首字 —— 这样第一阶段不需要
 * 任何头像图片资源,也就避开了「image 域名要配白名单」这个额外的报错来源。
 */
const props = defineProps<{ member: MemberListItem }>()
const emit = defineEmits<{ (e: 'click', m: MemberListItem): void }>()

const location = computed(() => {
  const city = props.member.city.replace(/市$/, '')
  const district = props.member.district?.replace(/(区|县)$/, '')
  return district ? `${city}·${district}` : city
})
</script>

<template>
  <view class="member-card" @click="emit('click', member)">
    <t-avatar :image="member.avatarUrl" size="large" shape="circle">
      {{ member.name.slice(0, 1) }}
    </t-avatar>

    <view class="member-card__body">
      <view class="row row--between">
        <text class="member-card__name">{{ member.name }}</text>
        <text class="text-placeholder">{{ member.graduationYear }} 届</text>
      </view>

      <text class="member-card__company ellipsis">{{ member.company }}</text>

      <view class="member-card__meta">
        <t-tag theme="primary" variant="light" size="small">{{ location }}</t-tag>
        <t-tag theme="warning" variant="light" size="small">
          {{ industryLabel(member.industry) }}
        </t-tag>
      </view>
    </view>

    <text class="member-card__arrow">›</text>
  </view>
</template>

<style lang="less" scoped>
.member-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-large);
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.member-card__body {
  flex: 1;
  min-width: 0;
}
.member-card__name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.member-card__company {
  display: block;
  margin-top: 6rpx;
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
}
.member-card__meta {
  display: flex;
  gap: 12rpx;
  margin-top: 14rpx;
}
.member-card__arrow {
  font-size: 40rpx;
  color: var(--td-text-color-placeholder);
}
</style>
