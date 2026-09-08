<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { memberApi } from '@/api/member'
import { useMemberFilterStore } from '@/stores/memberFilter'
import { industryLabel } from '@/constants/industry'
import TsaFilterBar from '@/components/TsaFilterBar/TsaFilterBar.vue'
import type { MapCenter, MapView, MarkerTapDetail } from '@/types/map'
import type { MemberMapPoint } from '@/types/member'

/**
 * 乡贤分布地图 —— 本项目的核心页面。
 *
 * 三条实现要点:
 * 1. 第一阶段**不需要用户定位**。图上渲染的是成员坐标,不是"我在哪",
 *    所以不开 show-location,也就绕开了授权弹窗、隐私协议、
 *    requiredPrivateInfos 声明这一整条合规链路。
 * 2. marker.id 必须是 number。成员 id 是字符串,所以用数组下标当 markerId,
 *    另存一张下标 → 成员的映射表反查。
 * 3. joinCluster 让密集区自动合并成带人数的气泡 —— 潮汕本地 92 条 + 珠三角 99 条
 *    若不聚合,在市级缩放下会糊成一团看不出任何信息。
 */

const store = useMemberFilterStore()

// 默认视野同时框住潮汕与珠三角两个密集区
const center = ref<MapCenter>({ lat: 23.4, lng: 115.0 })
const scale = ref(6)
const view = ref<MapView>('hometown')

const allPoints = ref<MemberMapPoint[]>([])
const selected = ref<MemberMapPoint | null>(null)
const showFilter = ref(false)
const topInset = ref(0)

const points = computed(() => store.apply(allPoints.value))
const total = computed(() => allPoints.value.length)
const shown = computed(() => points.value.length)

/** 下标 → 成员。markertap 只回传 number id,靠这张表反查是谁 */
const byIndex = computed(() => new Map(points.value.map((m, i) => [i, m])))

const markers = computed(() =>
  points.value.map((m, i) => ({
    id: i,
    latitude: m.lat,
    longitude: m.lng,
    title: m.name,
    // 不传 iconPath,用微信默认红色图钉。要换自有图标时补:
    //   iconPath: '/static/marker/member.png', width: 28, height: 28
    // 图标必须是 PNG(不支持 SVG),且放本地 /static 下。
    joinCluster: true,
    callout: {
      content: `${m.name}\n${m.city.replace('市', '')} · ${industryLabel(m.industry)}`,
      color: '#333333',
      fontSize: 12,
      borderRadius: 8,
      bgColor: '#ffffff',
      padding: 10,
      textAlign: 'left',
      display: 'BYCLICK',
    },
  })),
)

function onMarkerTap(e: MarkerTapDetail | { detail: MarkerTapDetail }) {
  const detail = (e as { detail?: MarkerTapDetail }).detail ?? (e as MarkerTapDetail)
  const id = detail.markerId ?? detail.marker?.id
  if (id === undefined) return

  const hit = byIndex.value.get(id)
  // 聚合气泡被点击时 id 不在映射表里(微信会自动展开该聚合点),此时不该弹卡片
  selected.value = hit ?? null
}

function goHometown() {
  view.value = 'hometown'
  center.value = { lat: 23.4, lng: 116.4 }
  scale.value = 8
}

function goNation() {
  view.value = 'nation'
  center.value = { lat: 30.5, lng: 110.0 }
  scale.value = 4
}

function onFilterConfirm() {
  showFilter.value = false
  // 筛选后原来选中的人可能已被过滤掉,清掉避免卡片显示一个图上没有的点
  if (selected.value && !points.value.includes(selected.value)) selected.value = null
}

function goDetail() {
  if (!selected.value) return
  uni.navigateTo({ url: `/pages/member/detail?id=${selected.value.id}` })
}

onMounted(async () => {
  // navigationStyle: custom,所以要自己让开状态栏,否则按钮压在信号栏上
  try {
    const info = uni.getSystemInfoSync()
    topInset.value = (info.statusBarHeight ?? 20) + 40
  } catch {
    topInset.value = 60
  }

  allPoints.value = await memberApi.getMapData()
})
</script>

<template>
  <view class="map-page">
    <map
      id="memberMap"
      class="map-page__map"
      :latitude="center.lat"
      :longitude="center.lng"
      :scale="scale"
      :markers="markers"
      :enable-zoom="true"
      :enable-scroll="true"
      :enable-rotate="false"
      :show-location="false"
      @markertap="onMarkerTap"
      @callouttap="onMarkerTap"
    />

    <!--
      ★ map 是原生组件,层级高于普通 view。浮在它上面的 UI 必须用 cover-view / cover-image。
        微信基础库支持同层渲染后 t-popup 也能盖住 map,但旧版本上会穿帮 ——
        所以成员卡片这类"必须浮在地图上"的用 cover-view,筛选面板这种
        打开后就该盖住地图的用 t-popup。详见 docs/TECHNOLOGY.md §6。
    -->

    <cover-view class="map-page__stat" :style="{ top: topInset + 'px' }">
      <cover-view class="map-page__stat-num">{{ shown }} / {{ total }}</cover-view>
      <cover-view class="map-page__stat-label">位乡贤在图</cover-view>
    </cover-view>

    <cover-view class="map-page__views" :style="{ top: topInset + 'px' }">
      <cover-view
        class="map-page__view-btn"
        :class="{ 'is-on': view === 'hometown' }"
        @tap="goHometown"
      >
        家乡
      </cover-view>
      <cover-view
        class="map-page__view-btn"
        :class="{ 'is-on': view === 'nation' }"
        @tap="goNation"
      >
        全国
      </cover-view>
    </cover-view>

    <cover-view class="map-page__filter" @tap="showFilter = true">
      <cover-view class="map-page__filter-text">{{ store.label || '筛选条件' }}</cover-view>
      <cover-view class="map-page__filter-arrow">⌄</cover-view>
    </cover-view>

    <cover-view v-if="selected" class="map-page__popup safe-bottom" @tap="goDetail">
      <cover-image v-if="selected.avatarUrl" class="map-page__avatar" :src="selected.avatarUrl" />
      <cover-view v-else class="map-page__avatar map-page__avatar--char">
        {{ selected.name.slice(0, 1) }}
      </cover-view>
      <cover-view class="map-page__popup-body">
        <cover-view class="map-page__popup-name">{{ selected.name }}</cover-view>
        <cover-view class="map-page__popup-meta">
          {{ selected.city.replace('市', '') }} · {{ industryLabel(selected.industry) }}
        </cover-view>
        <cover-view class="map-page__popup-tip">乡会会员可看完整资料</cover-view>
      </cover-view>
      <cover-view class="map-page__popup-go">查看资料 ›</cover-view>
    </cover-view>

    <t-popup v-model:visible="showFilter" placement="bottom">
      <TsaFilterBar :all-points="allPoints" @confirm="onFilterConfirm" />
    </t-popup>
  </view>
</template>

<style lang="less" scoped>
.map-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
.map-page__map {
  width: 100%;
  height: 100%;
}

/* cover-view 不支持 gap / 简写定位继承,逐个写清 */
.map-page__stat {
  position: absolute;
  left: 24rpx;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 14rpx;
  padding: 14rpx 22rpx;
}
.map-page__stat-num {
  font-size: 30rpx;
  font-weight: 600;
  color: #0052d9;
}
.map-page__stat-label {
  font-size: 20rpx;
  color: #8a8a8a;
}

.map-page__views {
  position: absolute;
  right: 24rpx;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 14rpx;
  padding: 6rpx;
}
.map-page__view-btn {
  width: 88rpx;
  padding: 12rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #4a4a4a;
  border-radius: 10rpx;
}
.map-page__view-btn.is-on {
  background: #0052d9;
  color: #ffffff;
}

.map-page__filter {
  position: absolute;
  right: 24rpx;
  bottom: 200rpx;
  display: flex;
  background: #0052d9;
  border-radius: 40rpx;
  padding: 16rpx 26rpx;
}
.map-page__filter-text {
  font-size: 24rpx;
  color: #ffffff;
}
.map-page__filter-arrow {
  margin-left: 10rpx;
  font-size: 24rpx;
  color: #ffffff;
}

.map-page__popup {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 60rpx;
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
}
.map-page__avatar {
  width: 84rpx;
  height: 84rpx;
  border-radius: 42rpx;
}
.map-page__avatar--char {
  background: #d9e1ff;
  color: #0052d9;
  font-size: 34rpx;
  text-align: center;
  line-height: 84rpx;
}
.map-page__popup-body {
  flex: 1;
  margin-left: 20rpx;
}
.map-page__popup-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
}
.map-page__popup-meta {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8a8a8a;
}
.map-page__popup-tip {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #b0b0b0;
}
.map-page__popup-go {
  font-size: 24rpx;
  color: #0052d9;
}
</style>
