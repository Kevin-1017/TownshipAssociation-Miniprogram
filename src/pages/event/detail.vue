<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

import { eventApi } from '@/api/event'
import { buildFileUrl } from '@/utils/request'
import { formatFull } from '@/utils/format'
import type { EventDetail } from '@/types/event'

/**
 * 事件详情 —— D2 定案形态:封面 + 标题 + 简介 + 发布时间 +「阅读公众号全文」。
 * 正文不进小程序重抄,点按钮拉起微信原生公众号文章阅读页;
 * 报名/电话咨询随报名功能一起删除(activity_registration 表继续躺)。
 */

/**
 * wx.openOfficialAccountArticle(基础库 3.4.8+)的调用桥。
 * @dcloudio/types 没有这个新 API 的类型,也没有全局 wx 声明,只能经 globalThis 收窄取值;
 * 官方形态是同步调起(非 Promise、fail 无错误码枚举),所以只可能给 fail 挂兜底。
 */
interface WxAmpBridge {
  openOfficialAccountArticle?: (opts: { url: string; fail?: (err: unknown) => void }) => void
}
const getWxAmp = (): WxAmpBridge | undefined => (globalThis as unknown as { wx?: WxAmpBridge }).wx

const event = ref<EventDetail | null>(null)
/** 取数结束标记:区分「还在拉」与「拉完没有/查无此事件」,不然失败会无限转圈 */
const loaded = ref(false)

const copyLinkAndToast = (url: string) => {
  uni.setClipboardData({
    data: url,
    // setClipboardData 成功自带「内容已复制」toast,这里覆盖成更具体的指引
    success: () => uni.showToast({ title: '链接已复制,请在微信内打开', icon: 'none' }),
  })
}

/** 真机排查锚点:fail 原文只有 errMsg 可见,vConsole 里靠它分辨「未关联公众号」与其他拒因 */
const logCopyFallback = (err: unknown) =>
  console.warn('[event/detail] openOfficialAccountArticle 失败,兜底复制链接:', err)

/**
 * 官方硬约束:「必须有点击行为才能调用成功」—— 必须在用户点击回调里同步调起,
 * 前面不能 await 任何东西。低版本基础库(API 不存在)与调起失败统一兜底复制链接。
 */
const onReadArticle = () => {
  const url = event.value?.articleUrl
  if (!url) return // 按钮此时是 disabled,此为双保险
  const wxAmp = getWxAmp()
  if (typeof wxAmp?.openOfficialAccountArticle === 'function') {
    wxAmp.openOfficialAccountArticle({
      url,
      fail: (err) => {
        logCopyFallback(err)
        copyLinkAndToast(url)
      },
    })
  } else {
    copyLinkAndToast(url)
  }
}

onLoad(async (query) => {
  const id = (query as Record<string, string>)?.id
  if (id) {
    try {
      event.value = await eventApi.getDetail(id)
      if (event.value) uni.setNavigationBarTitle({ title: event.value.title })
    } catch (err) {
      // 业务错(如 1002 查无)的 toast 网络层已弹,这里只留日志 + 空态
      console.warn('[eventDetail] 事件加载失败', err)
    }
  }
  loaded.value = true
})
</script>

<template>
  <view class="page edetail">
    <view v-if="!loaded" class="edetail__loading">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>

    <view v-else-if="!event" class="edetail__empty">
      <t-empty description="事件不存在或已下线" />
    </view>

    <template v-else>
      <!-- 封面:null/空串走占位块(与列表页同款) -->
      <image
        v-if="event.cover"
        class="edetail__cover"
        mode="aspectFill"
        :src="buildFileUrl(event.cover)"
      />
      <view v-else class="edetail__cover edetail__cover--empty" />

      <view class="edetail__head">
        <text class="edetail__title">{{ event.title }}</text>
        <text class="edetail__time text-secondary">{{ formatFull(event.startTime) }}</text>
      </view>

      <!-- 简介(activity.summary):秘书处未填则整块不渲染,不留空白卡片 -->
      <view v-if="event.summary" class="card edetail__summary">
        <text class="edetail__summary-text">{{ event.summary }}</text>
      </view>

      <view class="edetail__foot safe-bottom">
        <!-- articleUrl=null 表示正文还在整理:按钮置灰 + 文案说明,点了也没东西可拉 -->
        <t-button theme="primary" block :disabled="!event.articleUrl" @click="onReadArticle">
          阅读公众号全文
        </t-button>
        <text v-if="!event.articleUrl" class="edetail__foot-hint">正文整理中,敬请期待</text>
      </view>
    </template>
  </view>
</template>

<style lang="less" scoped>
.edetail {
  padding-bottom: 40rpx;
}
.edetail__cover {
  width: 100%;
  height: 380rpx;
  display: block;
}
.edetail__cover--empty {
  /* 无封面留灰块占位,版面不塌(同列表页 item-card__cover-placeholder 的思路) */
  background: var(--td-bg-color-secondarycontainer, #ededed);
}
.edetail__head {
  padding: 36rpx 40rpx 20rpx;
}
.edetail__title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.4;
  color: var(--td-text-color-primary);
}
.edetail__time {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
}
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.edetail__summary {
  padding: 28rpx;
}
.edetail__summary-text {
  font-size: 28rpx;
  line-height: 1.8;
  color: var(--td-text-color-primary);
  white-space: pre-wrap;
}
.edetail__foot {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 48rpx 24rpx 20rpx;
}
.edetail__foot-hint {
  text-align: center;
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.edetail__loading {
  display: flex;
  justify-content: center;
  padding-top: 200rpx;
}
.edetail__empty {
  padding-top: 200rpx;
}
</style>
