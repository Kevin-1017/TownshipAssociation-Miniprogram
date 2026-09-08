<script setup lang="ts">
/**
 * VirtualList —— 社区页专用的窗口化滚动容器。
 *
 * 与事件列表的虚拟列表相互独立,避免后期美食基地/校园广场配置差异时互相影响。
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
  <view class="vl-container">
    <scroll-view
      class="vl-list"
      scroll-y
      :enhanced="true"
      :bounces="false"
      @scroll="emit('scroll', $event)"
    >
      <view
        class="vl-content"
        :style="{ height: props.totalHeight }"
      >
        <view class="vl-spacer" :style="{ height: props.topHeight }" />
        <slot></slot>
        <view class="vl-spacer" :style="{ height: props.bottomHeight }" />
      </view>
    </scroll-view>
  </view>
</template>

<style lang="less" scoped>
.vl-container {
  width: 100%;
  height: 100%;
}
.vl-list {
  width: 100%;
  height: 100%;
}
.vl-content {
  position: relative;
}
.vl-spacer {
  width: 100%;
}
</style>
