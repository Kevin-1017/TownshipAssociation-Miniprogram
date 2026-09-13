<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 美食基地 —— 「校友私藏美食地图」:乡会编辑部采编的只读图鉴。
 *
 * 为什么不是动态列表:个人主体小程序不可提供 UGC(运营规范 5.7.1),
 * 原社区动态链路(api/mock/发布/详情页)已于 2026-09-12 整体删除。
 * 本页无任何用户发布/点赞/评论能力;数据为**示例采编**,提审前由编辑部替换定稿。
 * 规模小、仅本页消费 → 按分层规范用页面级常量,不建 api/store。
 */

type FoodRegion = '龙洞' | '大学城'

interface FoodSpot {
  name: string
  region: FoodRegion
  dishes: string
  price: string
  why: string
}

const REGION_OPTIONS = ['全部', '龙洞', '大学城'] as const

/** 示例采编数据(店名虚构):提审前替换为编辑部定稿 */
const SPOTS: FoodSpot[] = [
  { name: '老钟牛肉火锅', region: '龙洞', dishes: '吊龙伴、手打牛肉丸', price: '人均 ¥68', why: '实验课结束后的深夜食堂,汤底见真章' },
  { name: '阿群蚝烙小馆', region: '龙洞', dishes: '蚝烙、鱼饭', price: '人均 ¥35', why: '校门口二十年,饼边煎到脆才是合格' },
  { name: '顺记卤鹅坊', region: '龙洞', dishes: '狮头鹅肝、卤鹅饭', price: '人均 ¥28', why: '带回宿舍加餐的老乡暗号是「半份鹅血」' },
  { name: '山记姜撞奶', region: '龙洞', dishes: '姜撞奶、双皮奶', price: '人均 ¥15', why: '毕业十年回校,摊位还在华农路口' },
  { name: '潮客小馆(大学城店)', region: '大学城', dishes: '客家酿豆腐、咸香鸡', price: '人均 ¥45', why: '社团聚餐承包户,拼桌文化发源地' },
  { name: '南香粥品', region: '大学城', dishes: '水粥、肠粉', price: '人均 ¥18', why: '早八人的救命站,淋了酱汁的油条也香' },
  { name: '阿芳粿条汤', region: '大学城', dishes: '牛杂粿条、猪肚汤', price: '人均 ¥22', why: '答辩前夜的仪式感,汤头清亮不加味精' },
  { name: '甘露甜品屋', region: '大学城', dishes: '鸭母捻、五果汤', price: '人均 ¥16', why: '潮汕同学的乡愁浓度按碗计算' },
]

const activeRegion = ref<(typeof REGION_OPTIONS)[number]>('全部')

const spots = computed(() =>
  activeRegion.value === '全部' ? SPOTS : SPOTS.filter((s) => s.region === activeRegion.value),
)
</script>

<template>
  <view class="page food-spot">
    <view class="food-spot__filter">
      <t-check-tag
        v-for="opt in REGION_OPTIONS"
        :key="opt"
        :content="opt"
        :checked="activeRegion === opt"
        shape="round"
        @change="activeRegion = opt"
      />
    </view>

    <view class="food-spot__list">
      <view v-for="spot in spots" :key="spot.name" class="food-spot__card">
        <view class="food-spot__card-head">
          <text class="food-spot__name">{{ spot.name }}</text>
          <t-tag variant="light" size="small">{{ spot.region }}</t-tag>
        </view>
        <text class="food-spot__dishes">招牌:{{ spot.dishes }}</text>
        <text class="food-spot__why">{{ spot.price }} · {{ spot.why }}</text>
      </view>
    </view>

    <text class="food-spot__note">内容由乡会编辑部采编,欢迎线下实测</text>
  </view>
</template>

<style lang="less" scoped>
.food-spot {
  padding: 32rpx 32rpx 48rpx;
  background: var(--td-bg-color-page);
  min-height: 100vh;
  box-sizing: border-box;
}
.food-spot__filter {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.food-spot__list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.food-spot__card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 32rpx;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-large);
}
.food-spot__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.food-spot__name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.food-spot__dishes {
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
}
.food-spot__why {
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.food-spot__note {
  display: block;
  margin-top: 40rpx;
  text-align: center;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
</style>
