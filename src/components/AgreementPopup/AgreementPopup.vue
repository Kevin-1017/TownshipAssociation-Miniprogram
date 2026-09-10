<script setup lang="ts">
import { ref } from 'vue'

/**
 * 协议弹窗 —— 用户首次使用小程序必须勾选隐私政策+用户协议。
 * 勾选用 TDesign t-checkbox（icon 默认即圆形填充）。协议名称不传 label prop
 * 而是走默认插槽 + @click.stop：点击要跳转协议页，不能触发勾选。
 */

export interface Props {
  /** 是否显示（由父组件控制） */
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const STORAGE_KEY = 'community_agreement_accepted'
const agreePrivacy = ref(false)
const agreeAgreement = ref(false)

/** 打开对应协议页面 */
const openLegal = (page: string) => {
  uni.navigateTo({ url: `/pages/mine/${page}` })
}

const onConfirm = () => {
  if (!agreePrivacy.value || !agreeAgreement.value) {
    uni.showToast({ title: '请勾选全部协议', icon: 'none' })
    return
  }
  uni.setStorageSync(STORAGE_KEY, true)
  emit('confirm')
}
</script>

<template>
  <t-popup
    :visible="props.visible"
    placement="bottom"
    :show-cancel="false"
    :close-on-click-overlay="false"
    @overlay-click="emit('cancel')"
  >
    <!-- touchmove.stop.prevent 阻止底层页面滚动 -->
    <view class="popup" @touchmove.stop.prevent>
      <text class="popup__title">服务协议与隐私政策</text>
      <text class="popup__desc">请您阅读并勾选以下协议，以使用我们的服务。</text>

      <view class="popup__checklist">
        <!-- 隐私政策 -->
        <t-checkbox v-model:checked="agreePrivacy" borderless>
          <text class="popup__label" @click.stop="openLegal('privacy')">《隐私保护指引》</text>
        </t-checkbox>
        <!-- 用户协议 -->
        <t-checkbox v-model:checked="agreeAgreement" borderless>
          <text class="popup__label" @click.stop="openLegal('agreement')">《用户服务协议》</text>
        </t-checkbox>
      </view>

      <t-button
        theme="primary"
        block
        shape="round"
        size="large"
        :disabled="!agreePrivacy || !agreeAgreement"
        @click="onConfirm"
      >
        同意并继续
      </t-button>
    </view>
  </t-popup>
</template>

<style lang="less" scoped>
.popup {
  width: 100%;
  box-sizing: border-box;
  padding: 40rpx;
  background: #fff;
  overflow: visible;
}
.popup__title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--td-text-color-primary);
  text-align: center;
}
.popup__desc {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--td-text-color-secondary);
}
.popup__checklist {
  margin-bottom: 20rpx;
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  // 行间距由 gap 统一控制，去掉 t-checkbox 自带的 cell 式上下内边距
  --td-checkbox-vertical-padding: 0;
}
.popup__label {
  font-size: 28rpx;
  color: var(--td-brand-color);
  cursor: pointer;
}
</style>
