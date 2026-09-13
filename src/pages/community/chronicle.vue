<script setup lang="ts">
/**
 * 乡会流年志 —— 官方编年史(t-steps 纵向时间线,只读)。
 *
 * 形态即「官方发布、用户只读」,不涉 UGC,个人主体可承载;
 * 条目为**示例稿**,提审前由编辑部按乡会真实大事记替换。
 */

interface Milestone {
  year: string
  title: string
  content: string
}

/** 示例大事记(年份事件为虚构演示):提审前替换为乡会真实编年 */
const MILESTONES: Milestone[] = [
  { year: '2013', title: '助学金落地', content: '乡会奖学金首次发放,此后逐年扩面。' },
  { year: '2017', title: '理事会换届', content: '活动召集转向各届别校友承办。' },
  {
    year: '2023',
    title: '数字化起步',
    content: '会员名册电子化,乡会基金会账目开始按季度公开鸣谢。',
  },
  {
    year: '2026',
    title: '小程序上线',
    content: '广工潮阳潮南乡会小程序发布,公告、活动报名与奖学金公示迁入手机端。',
  },
]
</script>

<template>
  <view class="page chronicle-line">
    <!-- current=长度 → 全部渲染为已完成(大事记均为已发生史实);readonly:只读页不应给出可点击暗示 -->
    <t-steps layout="vertical" readonly :current="MILESTONES.length - 1" theme="dot">
      <t-step-item
        v-for="m in MILESTONES"
        :key="m.year"
        :title="`${m.year} · ${m.title}`"
        :content="m.content"
      />
    </t-steps>

    <text class="chronicle-line__note">大事记由乡会编辑部编撰,如有史实出入欢迎指正</text>
  </view>
</template>

<style lang="less" scoped>
.chronicle-line {
  padding: 32rpx 32rpx 48rpx;
  background: var(--td-bg-color-page);
  min-height: 100vh;
  box-sizing: border-box;
}
.chronicle-line__note {
  display: block;
  margin-top: 48rpx;
  text-align: center;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
</style>
