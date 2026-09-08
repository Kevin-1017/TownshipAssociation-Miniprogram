<script setup lang="ts">
/**
 * WindowedScrollView —— 窗口化滚动容器。
 *
 * 原理:
 * 外层 scroll-view 内是一个高度为 totalHeight 的容器;
 * 容器顶部/底部分别用 spacer 撑出不可见区域,中间只渲染可见条目。
 * 列表项保持正常文档流,不依赖 transform,避免小程序渲染漂移。
 */

interface Props {
  /** 列表总高度(px) */
  totalHeight: string
  /** 顶部占位高度(px) */
  topHeight: string
  /** 底部占位高度(px) */
  bottomHeight: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ scroll: [e: CustomEvent] }>()
</script>

<template>
  <view class="vw-container">
    <scroll-view
      class="vw-list"
      scroll-y
      :enhanced="true"
      :bounces="false"
      @scroll="emit('scroll', $event)"
    >
      <view
        class="vw-scroll-content"
        :style="{ height: props.totalHeight }"
      >
        <view class="vw-spacer" :style="{ height: props.topHeight }" />
        <slot></slot>
        <view class="vw-spacer" :style="{ height: props.bottomHeight }" />
      </view>
    </scroll-view>
  </view>
</template>

<style lang="less" scoped>
.vw-container {
  width: 100%;
  height: 100%;
}
.vw-list {
  width: 100%;
  height: 100%;
}
.vw-scroll-content {
  position: relative;
}
.vw-spacer {
  width: 100%;
}
</style>
