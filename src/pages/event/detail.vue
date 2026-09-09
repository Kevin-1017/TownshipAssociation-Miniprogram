<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { eventApi } from '@/api/event'
import { formatMonthDay } from '@/utils/format'
import type { EventDetail } from '@/types/event'

const event = ref<EventDetail | null>(null)

const callOrganizer = () => {
  if (!event.value) return;
  uni.makePhoneCall({ phoneNumber: event.value.contactPhone })
}

onLoad(async (query) => {
  const id = (query as Record<string, string>)?.id
  if (id) event.value = await eventApi.getDetail(id)
  if (event.value) uni.setNavigationBarTitle({ title: event.value.title })
})
</script>

<template>
  <view class="page edetail">
    <template v-if="event">
      <view class="edetail__hero">
        <text class="edetail__title">{{ event.title }}</text>
        <view class="edetail__badges">
          <t-tag
            :theme="event.status === 'upcoming' ? 'primary' : 'default'"
            variant="light"
            size="small"
          >
            {{ event.status === 'upcoming' ? '待开始' : '已结束' }}
          </t-tag>
          <t-tag theme="default" variant="outline" size="small">
            {{ event.registeredCount }} 人已报名
            <text v-if="event.quota">/ {{ event.quota }}</text>
          </t-tag>
        </view>
      </view>

      <view class="card edetail__rows">
        <view class="edetail__row">
          <text class="edetail__k">时间</text>
          <text class="edetail__v">
            {{ formatMonthDay(event.startTime) }} — {{ formatMonthDay(event.endTime) }}
          </text>
        </view>
        <view class="edetail__row">
          <text class="edetail__k">城市</text>
          <text class="edetail__v">{{ event.city }}</text>
        </view>
        <view class="edetail__row">
          <text class="edetail__k">地点</text>
          <text class="edetail__v">{{ event.address }}</text>
        </view>
        <view class="edetail__row">
          <text class="edetail__k">主办</text>
          <text class="edetail__v">{{ event.organizer }}</text>
        </view>
        <view class="edetail__row">
          <text class="edetail__k">联系</text>
          <text class="edetail__v">{{ event.contactPhone }}</text>
        </view>
      </view>

      <view class="section-title"><text>事件说明</text></view>
      <view class="card">
        <text class="edetail__content">{{ event.content }}</text>
      </view>

      <view class="edetail__foot safe-bottom">
        <!-- 第一阶段的报名是假按钮:不请求后端。真实现要解决名额并发与重复提交 -->
        <t-button theme="primary" block disabled>在线报名(第二阶段开放)</t-button>
        <t-button theme="light" block @click="callOrganizer">电话咨询秘书处</t-button>
      </view>
    </template>

    <view v-else class="edetail__loading">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>
  </view>
</template>

<style lang="less" scoped>
.edetail {
  padding-bottom: 40rpx;
}
.edetail__hero {
  padding: 48rpx 40rpx 36rpx;
  background: linear-gradient(160deg, #0052d9 0%, #2f7bff 100%);
  color: #fff;
}
.edetail__title {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.4;
}
.edetail__badges {
  display: flex;
  gap: 12rpx;
  margin-top: 22rpx;
}
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.section-title {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.edetail__rows {
  padding: 12rpx 0;
}
.edetail__row {
  display: flex;
  padding: 14rpx 0;
}
.edetail__k {
  width: 120rpx;
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
}
.edetail__v {
  flex: 1;
  font-size: 26rpx;
  color: var(--td-text-color-primary);
}
.edetail__content {
  font-size: 28rpx;
  line-height: 1.8;
  white-space: pre-wrap;
}
.edetail__foot {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 40rpx 24rpx 20rpx;
}
.edetail__loading {
  display: flex;
  justify-content: center;
  padding-top: 200rpx;
}
</style>
