<script setup lang="ts">
/**
 * 校园资讯 —— 「工大风云尽在掌握」:编辑部官方简讯,折叠面板只读浏览。
 *
 * 与美食基地同理,原校园广场 UGC 动态链路已删除;资讯为**官方采编**(非用户发布),
 * 个人主体可承载。数据为示例稿,提审前替换为定稿;接入后端官方资讯接口是后续可选项。
 */

interface NewsItem {
  title: string
  date: string
  body: string
}

/** 示例采编(事件为虚构演示):提审前由编辑部替换 */
const NEWS: NewsItem[] = [
  {
    title: '母校七十周年校庆筹备启动,校友征集开启',
    date: '2026-09',
    body: '校庆办公室已启动老照片、口述史与届别联络人征集。乡会将协助各届校友整理报名通道,有史料可提供请在「我的」页留下联系方式,编辑部会主动联络。',
  },
  {
    title: '龙洞校区图书馆改造完工,自习区延长开放',
    date: '2026-08',
    body: '暑期改造后的图书馆新增两层自习区,考试季开放至 23:00。回校拜访的校友可凭身份证在西门登记入馆参观。',
  },
  {
    title: '乡会赞助「潮工杯」足球邀请赛落幕',
    date: '2026-06',
    body: '第八届校友与在校生足球邀请赛在大学城校区举行,乡会队 2:1 卫冕。赛事照片集锦将收入《乡会流年志》年度篇章。',
  },
  {
    title: '材料学院团队获省科技进步奖',
    date: '2026-05',
    body: '母校材料科学与工程学院牵头项目获广东省科技进步一等奖,团队成员含三位乡会理事。乡会编辑部将跟进专访。',
  },
  {
    title: '大学城校区地铁接驳专线试运行',
    date: '2026-03',
    body: '校区与地铁站间接驳巴士试运行,工作日高峰 10 分钟一班。校友返校日活动车辆动线已同步更新到公告。',
  },
]
</script>

<template>
  <view class="page campus-news">
    <!-- 面板必须各自绑唯一 value:uniapp 版 dist 未实现「空值取下标兜底」,缺绑定时全部共享 undefined 会失效 -->
    <t-collapse theme="card" :expand-mutex="false" :default-value="[]">
      <t-collapse-panel v-for="item in NEWS" :key="item.title" :value="item.title" :header="item.title">
        <view class="campus-news__body">
          <text class="campus-news__meta">{{ item.date }} · 乡会编辑部</text>
          <text class="campus-news__text">{{ item.body }}</text>
        </view>
      </t-collapse-panel>
    </t-collapse>

    <text class="campus-news__note">资讯均由乡会编辑部采编发布,不代表母校官方口径</text>
  </view>
</template>

<style lang="less" scoped>
.campus-news {
  padding: 32rpx 32rpx 48rpx;
  background: var(--td-bg-color-page);
  min-height: 100vh;
  box-sizing: border-box;
}
.campus-news__body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.campus-news__meta {
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.campus-news__text {
  font-size: 28rpx;
  line-height: 1.7;
  color: var(--td-text-color-secondary);
}
.campus-news__note {
  display: block;
  margin-top: 40rpx;
  text-align: center;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
</style>
