<script setup lang="ts">
/**
 * 草稿模式:面板内的修改先落在本地 draft,点「确定」才写回 store。
 * 这样用户划走一半反悔可以直接关掉,不会污染地图页正在显示的结果 ——
 * 也是「表单状态该不该进 Pinia」的标准答案:不该,只有确认后的结果才进。
 */
import { reactive, computed } from 'vue'
import { useMemberFilterStore } from '@/stores/memberFilter'
import { INDUSTRIES } from '@/constants/industry'
import { PROVINCES, type ProvinceOption } from '@/constants/region'
import type { MemberMapPoint } from '@/types/member'

const props = defineProps<{ allPoints: MemberMapPoint[] }>()
const emit = defineEmits<{ (e: 'confirm'): void }>()

const store = useMemberFilterStore()

const draft = reactive({
  province: store.province,
  city: store.city,
  industry: store.industry,
  keyword: store.keyword,
})

const cityOptions = computed(() => {
  if (!draft.province) return []
  return PROVINCES.find((p) => p.label === draft.province)?.cities ?? []
})

const filteredCount = computed(() => {
  const snapshot = { ...draft }
  return props.allPoints.filter((m) => {
    if (snapshot.province && m.province !== snapshot.province) return false
    if (snapshot.city && m.city !== snapshot.city) return false
    if (snapshot.industry && m.industry !== snapshot.industry) return false
    if (snapshot.keyword) {
      const kw = snapshot.keyword.trim().toLowerCase()
      if (kw && !`${m.name}${m.city}`.toLowerCase().includes(kw)) return false
    }
    return true
  }).length
})

const pickProvince = (p: ProvinceOption) => {
  draft.province = p.label;
  // 换省必须清掉市,否则可能留下「广东省 + 上海市」这种筛不出任何东西的组合
  draft.city = ''
}

const onConfirm = () => {
  store.province = draft.province;
  store.city = draft.city
  store.industry = draft.industry
  store.keyword = draft.keyword
  emit('confirm')
}

const onReset = () => {
  draft.province = '';
  draft.city = ''
  draft.industry = ''
  draft.keyword = ''
  store.reset()
  emit('confirm')
}
</script>

<template>
  <!--
    筛选面板。业务组件包装层之一:页面不直接堆 TDesign 控件,
    将来 @tdesign/uniapp 从 0.10 升到 1.x 时,破坏性改动只落在这个目录。
  -->
  <view class="filter">
    <view class="filter__head">
      <text class="filter__title">筛选乡贤</text>
      <!-- 地图页会传全量点进来实时算人数;列表页不传,这里就不显示,避免误报 0 人 -->
      <text v-if="allPoints.length" class="filter__sub">共 {{ filteredCount }} 人符合条件</text>
    </view>

    <t-input
      v-model="draft.keyword"
      label="搜索"
      placeholder="姓名 / 公司 / 学校"
      clearable
      borderless
    />

    <scroll-view scroll-x class="filter__row" :show-scrollbar="false">
      <view class="filter__tags">
        <t-tag
          theme="primary"
          :variant="!draft.province ? 'dark' : 'light'"
          @click="draft.province = ''"
        >
          全部省份
        </t-tag>
        <t-tag
          v-for="p in PROVINCES"
          :key="p.code"
          theme="primary"
          :variant="draft.province === p.label ? 'dark' : 'light'"
          @click="pickProvince(p)"
        >
          {{ p.label }}
        </t-tag>
      </view>
    </scroll-view>

    <scroll-view v-if="cityOptions.length" scroll-x class="filter__row" :show-scrollbar="false">
      <view class="filter__tags">
        <t-tag theme="default" :variant="!draft.city ? 'dark' : 'light'" @click="draft.city = ''">
          全省
        </t-tag>
        <t-tag
          v-for="c in cityOptions"
          :key="c.code"
          theme="default"
          :variant="draft.city === c.label ? 'dark' : 'light'"
          @click="draft.city = c.label"
        >
          {{ c.label }}
        </t-tag>
      </view>
    </scroll-view>

    <scroll-view scroll-x class="filter__row" :show-scrollbar="false">
      <view class="filter__tags">
        <t-tag
          theme="warning"
          :variant="!draft.industry ? 'dark' : 'light'"
          @click="draft.industry = ''"
        >
          全部行业
        </t-tag>
        <t-tag
          v-for="i in INDUSTRIES"
          :key="i.code"
          theme="warning"
          :variant="draft.industry === i.code ? 'dark' : 'light'"
          @click="draft.industry = i.code"
        >
          {{ i.label }}
        </t-tag>
      </view>
    </scroll-view>

    <view class="filter__foot safe-bottom">
      <t-button theme="light" size="medium" block @click="onReset">重置</t-button>
      <t-button theme="primary" size="medium" block @click="onConfirm">确定</t-button>
    </view>
  </view>
</template>

<style lang="less" scoped>
.filter {
  padding: 32rpx 24rpx 8rpx;
  background: var(--td-bg-color-container);
  border-radius: 24rpx 24rpx 0 0;
}
.filter__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.filter__title {
  font-size: 34rpx;
  font-weight: 600;
}
.filter__sub {
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.filter__row {
  margin-top: 20rpx;
  white-space: nowrap;
}
.filter__tags {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 8rpx;
}
.filter__foot {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
}
</style>
