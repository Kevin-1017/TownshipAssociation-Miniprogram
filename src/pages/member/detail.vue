<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import { authApi } from '@/api/auth'
import { ApiError, CODE_ASSOC_ONLY } from '@/utils/request'
import { useUserStore } from '@/stores/user'
import { industryLabel } from '@/constants/industry'
import { formatDate, formatGrade } from '@/utils/format'
import type { MemberDetail } from '@/types/member'

/** 业务码 1002：数据不存在（request.ts 还没收这个码，就地定义并注释来源） */
const CODE_DATA_NOT_FOUND = 1002

/** getPhoneNumber 按钮回调事件（uni-app 类型未内置该事件，就地收窄） */
interface GetPhoneEvent {
  detail?: { code?: string; errMsg?: string }
}

/**
 * 成员详情 —— 乡会用户权限闸门所在地。
 *
 * ★ 为什么闸门在这里而不是地图弹窗：<map> 是原生组件，浮层只能 cover-view，
 *   而 cover-view 里放不了 <button open-type="getPhoneNumber">，授权按钮只能放普通页面。
 *   所有入口（地图弹窗、成员列表）一律放行跳转，到这里统一裁决。
 *
 * 隐私双层：本页 contactVisible 控制**前端渲染**；真正的过滤在后端——
 * 非乡会用户整份详情不下发（1301），contactVisible=false 时联系方式字段被后端剔除。
 */

const user = useUserStore()

const memberId = ref('')
const member = ref<MemberDetail | null>(null)
/** 未核验状态：显示授权闸门，不发任何详情请求 */
const needAuth = ref(false)
/** 核验失败（手机号不在名册）后的文案变体 */
const rejected = ref(false)
/** 授权按钮 loading：微信 code 严格一次性，双击第二次消费必 40163，必须防抖 */
const verifying = ref(false)
/** 加载失败文案（1301/1002 之外的错误归到这里，避免白屏假死） */
const loadError = ref('')

const basicRows = computed(() => {
  const m = member.value
  if (!m) return []
  return [
    { k: '性别', v: m.gender === 1 ? '男' : m.gender === 2 ? '女' : '未填' },
    { k: '常驻地', v: `${m.province} ${m.city}${m.district ? ' ' + m.district : ''}` },
    { k: '行业', v: industryLabel(m.industry) },
    { k: '毕业院校', v: m.school },
    { k: '专业', v: m.major },
    { k: '届别', v: formatGrade(m.graduationYear) },
    { k: '入会时间', v: formatDate(m.createdAt) },
  ]
})

const copyContact = () => {
  if (!member.value?.contactVisible) return;
  uni.setClipboardData({
    data: member.value.wechatId ?? '',
    success: () => uni.showToast({ title: '微信号已复制', icon: 'success' }),
  })
}

const fetchDetail = async () => {
  if (!memberId.value) return;
  try {
    member.value = await memberApi.getDetail(memberId.value)
    if (member.value) {
      uni.setNavigationBarTitle({ title: member.value.name })
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === CODE_ASSOC_ONLY) {
      // 服务端裁决失败（后端重启/名册移除）：清本地核验态回到闸门 —— 鉴权的自愈路径
      user.clearAssoc()
      needAuth.value = true
      return
    }
    if (e instanceof ApiError && e.code === CODE_DATA_NOT_FOUND) {
      loadError.value = '该成员不存在'
      return
    }
    loadError.value = '加载失败,请重试'
    if (!(e instanceof ApiError)) console.error('[detail]', e)
  }
}

const onGetPhone = async (e: GetPhoneEvent) => {
  const code = e.detail?.code;
  // 用户拒绝授权时 errMsg 含 fail 且无 code —— 静默停留，不打扰
  if (!code) return

  verifying.value = true
  try {
    const res = await authApi.verifyPhone(code)
    if (res.verified && res.token) {
      user.saveAssoc(res)
      needAuth.value = false
      rejected.value = false
      await fetchDetail()
    } else {
      rejected.value = true
      uni.showToast({ title: '仅限乡会会员', icon: 'none' })
    }
  } catch {
    // 1302「手机号核验失败，请重试」已由 request 层统一 toast，这里不重复提示，用户重点按钮即可
  } finally {
    verifying.value = false
  }
}

const goBack = () => {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
  } else {
    // 冷启动直达详情页(分享/扫码)时的兜底。地图已不是 tab 页,switchTab 会失败,回首页
    uni.reLaunch({ url: '/pages/index/index' })
  }
}

onLoad((query) => {
  const id = (query as Record<string, string>)?.id
  if (!id) {
    uni.showToast({ title: '缺少成员 id', icon: 'none' })
    goBack()
    return
  }
  memberId.value = id
  // 已核验才发详情请求：未核验时请求注定 1301，直接亮闸门
  if (user.isAssocVerified) {
    fetchDetail()
  } else {
    needAuth.value = true
  }
})
</script>

<template>
  <view class="page detail">
    <!-- 授权闸门：未核验时不展示任何成员数据 -->
    <view v-if="needAuth" class="detail__auth">
      <t-avatar size="large" shape="round">乡</t-avatar>
      <text class="detail__auth-title">查看完整资料需核验乡会身份</text>
      <text class="detail__auth-desc">
        {{ rejected
          ? '该手机号未在乡会名册中,无法查看完整资料。如需引荐,请联系乡会秘书处。'
          : '成员完整资料仅对乡会用户开放,微信授权手机号即可核验。' }}
      </text>
      <t-button
        v-if="!rejected"
        theme="primary"
        block
        open-type="getPhoneNumber"
        :loading="verifying"
        @getphonenumber="onGetPhone"
      >
        授权手机号核验
      </t-button>
    </view>

    <view v-else-if="loadError" class="detail__loading">
      <text class="text-secondary">{{ loadError }}</text>
      <t-button theme="default" size="small" @click="goBack">返回</t-button>
    </view>

    <view v-else-if="!member" class="detail__loading">
      <t-loading theme="circular" size="48rpx" text="加载成员资料" />
    </view>

    <template v-else>
      <view class="detail__hero">
        <t-avatar :image="member.avatarUrl" size="large" shape="circle">
          {{ member.name.slice(0, 1) }}
        </t-avatar>
        <text class="detail__name">{{ member.name }}</text>
        <text class="detail__role">{{ member.title }} · {{ member.company }}</text>
        <view class="detail__tags">
          <t-tag theme="primary" variant="light" size="small">
            {{ member.province }}{{ member.city }}
          </t-tag>
          <t-tag v-if="member.district" theme="default" variant="outline" size="small">
            {{ member.district }}
          </t-tag>
          <t-tag theme="warning" variant="light" size="small">
            {{ industryLabel(member.industry) }}
          </t-tag>
        </view>
      </view>

      <view class="section-title"><text>基本信息</text></view>
      <view class="card detail__rows">
        <view v-for="r in basicRows" :key="r.k" class="detail__row">
          <text class="detail__k">{{ r.k }}</text>
          <text class="detail__v">{{ r.v }}</text>
        </view>
      </view>

      <view class="section-title"><text>个人简介</text></view>
      <view class="card">
        <text class="detail__bio">{{ member.intro }}</text>
      </view>

      <view class="section-title"><text>联系方式</text></view>
      <view class="card">
        <view v-if="member.contactVisible" class="detail__rows">
          <view class="detail__row">
            <text class="detail__k">微信号</text>
            <text class="detail__v">{{ member.wechatId }}</text>
          </view>
          <view class="detail__row">
            <text class="detail__k">手机号</text>
            <text class="detail__v">{{ member.phone }}</text>
          </view>
        </view>
        <view v-else class="detail__private">
          <text class="text-secondary">该乡贤未公开联系方式</text>
          <text class="text-placeholder">如需引荐,请联系乡会秘书处</text>
        </view>
      </view>

      <view class="detail__foot safe-bottom">
        <t-button theme="primary" block :disabled="!member.contactVisible" @click="copyContact">
          {{ member.contactVisible ? '复制微信号' : '联系方式未公开' }}
        </t-button>
      </view>
    </template>
  </view>
</template>

<style lang="less" scoped>
.detail {
  padding-bottom: 40rpx;
}
.detail__auth {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 160rpx 64rpx 0;
}
.detail__auth-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.detail__auth-desc {
  font-size: 26rpx;
  line-height: 1.7;
  text-align: center;
  color: var(--td-text-color-secondary);
}
.detail__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding-top: 200rpx;
}
.detail__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 40rpx 40rpx;
  background: linear-gradient(160deg, #0052d9 0%, #2f7bff 100%);
  color: #fff;
}
.detail__name {
  margin-top: 20rpx;
  font-size: 40rpx;
  font-weight: 700;
}
.detail__role {
  margin-top: 8rpx;
  font-size: 26rpx;
  opacity: 0.9;
}
.detail__tags {
  display: flex;
  gap: 12rpx;
  margin-top: 24rpx;
  flex-wrap: wrap;
  justify-content: center;
}
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.section-title {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.detail__rows {
  padding: 8rpx 0;
}
.detail__row {
  display: flex;
  padding: 14rpx 0;
}
.detail__k {
  width: 160rpx;
  font-size: 26rpx;
  color: var(--td-text-color-secondary);
}
.detail__v {
  flex: 1;
  font-size: 26rpx;
  color: var(--td-text-color-primary);
}
.detail__bio {
  font-size: 28rpx;
  line-height: 1.7;
  color: var(--td-text-color-primary);
}
.detail__private {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 16rpx 0;
}
.detail__foot {
  padding: 40rpx 24rpx 20rpx;
}
</style>