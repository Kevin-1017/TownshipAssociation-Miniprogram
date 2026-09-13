<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { memberApi } from '@/api/member'
import { buildFileUrl } from '@/utils/request'
import { industryLabel } from '@/constants/industry'
import { ICP_NUMBER, BEIAN_URL } from '@/constants/icp'

/** 本页路径:tab bar 高亮;tab 页常驻缓存,返回时按它复位 */
const OWN_PATH = '/pages/mine/index'

/** 当前页面路径（用于底部 tab bar 高亮） */
const activePage = ref(OWN_PATH)

const onTabChange = (e: { value: string }) => {
  // 四个 tab 已登记进 pages.json 的 tabBar.list,只能用 switchTab 互切
  uni.switchTab({ url: e.value })
}

const version = '0.1.0'
const nodeHint = '24 LTS'

const MENUS = [
  { label: '我的资料', hint: '', action: 'profile' },
  { label: '乡会架构与理事名单', hint: '待补内容', action: 'todo' },
] as const

/** 法律合规菜单 */
const LEGAL_MENUS = [
  { label: '隐私政策', hint: '', action: 'privacy' },
  { label: '用户协议', hint: '', action: 'agreement' },
] as const

const user = useUserStore()
const { isLogin } = storeToRefs(user)

const memberTotal = ref(0)
const myCityCount = ref(0)
/** 登录/退出请求进行中:t-button loading 数据源,兼防连点重复提交 */
const isAuthPending = ref(false)

/**
 * hero 副行与 displayName 三态对齐(§9.9):
 * 「点击完善资料」态下 profile=null,旧模板会渲染出「 · 」的空壳分隔符。
 */
const heroSub = computed(() => {
  if (!user.isLogin) return '尚未登录'
  const p = user.profile
  if (!p) return '完善资料提交后,经秘书处审核上乡贤列表'
  // 本人自建的档案行 province/city 是 NULL(待秘书处补录)、industry 不在提交白名单恒 NULL,
  // 直接模板串会渲染出孤立的「 · 」——非空段 join,全空给待审核引导
  const region = `${p.province ?? ''}${p.city ?? ''}`
  const parts = [region, industryLabel(p.industry ?? '')].filter(Boolean)
  return parts.length ? parts.join(' · ') : '资料已建档,待秘书处审核'
})

/** 头像占位字:取名字首字;无档案用「我」——直接 slice(displayName) 会拿出「点」字 */
const avatarChar = computed(() => {
  const name = user.profile?.name
  if (name) return name.slice(0, 1)
  return user.isLogin ? '我' : '未'
})

/** 档案头像可能是 /tsa/files 相对路径,洗成可渲染地址 */
const avatarSrc = computed(() => buildFileUrl(user.profile?.avatarUrl ?? ''))

/**
 * ICP 备案号展示文案(备案承诺第二条要求上线时在主体资质界面标明编号)。
 * 核准未下时 ICP_NUMBER 为空,给「核准中」占位 —— 页面出现具体编号前,
 * 该号必须真实存在,宁缺勿假。
 */
const icpText = computed(() =>
  ICP_NUMBER ? `ICP备案编号:${ICP_NUMBER}` : 'ICP备案核准中,通过后此处展示编号',
)

/**
 * hero 按钮文案:登录态决定「退出登录 / 一键登录」;
 * 请求中换成进行时文案,配合 t-button 的 loading 转圈。
 */
const loginLabel = computed(() => {
  if (isAuthPending.value) return user.isLogin ? '退出中' : '登录中'
  return user.isLogin ? '退出登录' : '一键登录'
})

/**
 * 一键登录 / 退出登录。
 * silentLogin 三态决定文案:retryable 只是微信抖动/限频,说成「登录失效」会误导(修订 A4);
 * 冷启动已经自动登录过一轮,走到未登录分支说明那次失败了,这里给用户手动重试入口。
 */
const onLogin = async () => {
  if (isAuthPending.value) return
  isAuthPending.value = true
  try {
    if (user.isLogin) {
      await user.logout()
      uni.showToast({ title: '已退出', icon: 'none' })
      return
    }
    const state = await user.silentLogin()
    if (state === 'ok') {
      uni.showToast({ title: '已登录', icon: 'success' })
    } else if (state === 'retryable') {
      uni.showToast({ title: '登录通道繁忙,请稍后重试', icon: 'none' })
    } else {
      uni.showToast({ title: '登录失败,请重试', icon: 'none' })
    }
  } finally {
    isAuthPending.value = false
  }
}

const onMenu = (m: (typeof MENUS)[number]) => {
  if (m.action === 'profile') {
    uni.navigateTo({ url: '/pages/mine/profile' })
    return
  }
  uni.showToast({ title: `${m.label}:该功能在第二阶段实现`, icon: 'none' })
}

const onLegal = (m: (typeof LEGAL_MENUS)[number]) => {
  const urlMap: Record<string, string> = {
    privacy: '/pages/mine/privacy',
    agreement: '/pages/mine/agreement',
  }
  uni.navigateTo({ url: urlMap[m.action] ?? '' })
}

/**
 * 规范要求备案号「链接至 beian.miit.gov.cn」,但小程序 web-view 只能打开
 * 已配置业务域名的站点,miit 域名放不进白名单 —— 按通行做法以文本展示地址、
 * 点击复制「编号+查询网址」,监管核查同样认可。
 */
const onIcpTap = () => {
  if (!ICP_NUMBER) return
  uni.setClipboardData({
    data: `${ICP_NUMBER} ${BEIAN_URL}`,
    success: () => uni.showToast({ title: '备案信息已复制', icon: 'none' }),
  })
}

onShow(async () => {
  // tab 页不卸载:返回时把高亮复位成本页,并藏掉原生 tab bar(只留悬浮胶囊)
  activePage.value = OWN_PATH
  uni.hideTabBar()
  // 三块数据各自独立降级:任何单点失败(断网/后端未起)只掉自己那一格,整页不许炸。
  // fetchProfile 若撞 401 会先被 request 层静默重登救回,救不回才抛到这里。
  if (isLogin.value) {
    try {
      await user.fetchProfile()
    } catch (err) {
      console.warn('[mine] 资料刷新失败', err)
    }
  }
  try {
    const stats = await memberApi.getProvinceStats({ showLoading: false, silentError: true })
    memberTotal.value = stats.reduce((s, p) => s + p.count, 0)
  } catch (err) {
    console.warn('[mine] 乡贤总数拉取失败', err)
    memberTotal.value = 0
  }
  try {
    const page = await memberApi.getList(
      { city: user.profile?.city || '汕头市', pageSize: 1 },
      { showLoading: false, silentError: true },
    )
    myCityCount.value = page.total
  } catch (err) {
    console.warn('[mine] 同城老乡拉取失败', err)
    myCityCount.value = 0
  }
})
</script>

<template>
  <view class="page mine">
    <view class="mine__hero">
      <t-avatar :image="avatarSrc" size="large" shape="circle">
        {{ avatarChar }}
      </t-avatar>
      <view class="mine__hero-body">
        <text class="mine__name">{{ user.displayName }}</text>
        <text class="mine__sub">{{ heroSub }}</text>
      </view>
      <t-button
        class="mine__login-btn"
        theme="light"
        shape="round"
        size="small"
        :loading="isAuthPending"
        :disabled="isAuthPending"
        @click="onLogin"
      >
        {{ loginLabel }}
      </t-button>
    </view>

    <view class="mine__stats">
      <view class="mine__stat">
        <text class="mine__stat-num">{{ memberTotal }}</text>
        <text class="mine__stat-label">乡贤总数</text>
      </view>
      <view class="mine__stat">
        <text class="mine__stat-num">{{ myCityCount }}</text>
        <text class="mine__stat-label">同城老乡</text>
      </view>
    </view>

    <view class="section-title"><text>乡会事务</text></view>
    <view class="card mine__menu">
      <view v-for="m in MENUS" :key="m.label" class="mine__cell" @click="onMenu(m)">
        <text class="mine__cell-label">{{ m.label }}</text>
        <text class="mine__cell-hint">{{ m.hint }}</text>
        <text class="mine__cell-arrow">›</text>
      </view>
    </view>

    <view class="section-title"><text>法律合规</text></view>
    <view class="card mine__menu">
      <view v-for="m in LEGAL_MENUS" :key="m.label" class="mine__cell" @click="onLegal(m)">
        <text class="mine__cell-label">{{ m.label }}</text>
        <text class="mine__cell-hint">{{ m.hint }}</text>
        <text class="mine__cell-arrow">›</text>
      </view>
    </view>

    <view class="card mine__about">
      <text class="mine__about-title">关于本小程序</text>
      <text class="mine__about-body">
        <text>
          本项目由KevinH独立开发完成，若对项目有任何建议，亦或是想参与项目维护，请发送邮件至邮箱：13623034184@163.com
        </text>
        <text>支持我们！请联系基金会</text>
      </text>
      <text class="mine__version">版本 {{ version }} · 编译器 Node {{ nodeHint }}</text>
      <!-- 主体资质展示:备案承诺第二条要求(三级菜单以内标明核准编号),点击可复制 -->
      <view class="mine__icp" @click="onIcpTap">
        <text class="mine__icp-text">{{ icpText }}</text>
        <text v-if="ICP_NUMBER" class="mine__icp-url">{{ BEIAN_URL }}</text>
      </view>
    </view>

    <!-- 底部悬浮胶囊导航:theme="tag" 选中项带胶囊底色,split=false 去分隔线;文字放默认插槽显示在图标下方 -->
    <t-tab-bar :value="activePage" shape="round" theme="tag" :split="false" @change="onTabChange">
      <t-tab-bar-item value="/pages/index/index" icon="home">首页</t-tab-bar-item>
      <t-tab-bar-item value="/pages/community/index" icon="chat">广场</t-tab-bar-item>
      <t-tab-bar-item value="/pages/event/list" icon="app">事件</t-tab-bar-item>
      <t-tab-bar-item value="/pages/mine/index" icon="user">我的</t-tab-bar-item>
    </t-tab-bar>
  </view>
</template>

<style lang="less" scoped>
.mine {
  /* padding 计入 100vh,避免页面多出滚动空间 */
  box-sizing: border-box;
  padding-bottom: calc(40rpx + 100rpx + env(safe-area-inset-bottom));
}
.mine__hero {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 60rpx 40rpx 44rpx;
  background: linear-gradient(160deg, #0052d9 0%, #2f7bff 100%);
  color: #fff;
}
.mine__hero-body {
  flex: 1;
}
.mine__name {
  font-size: 38rpx;
  font-weight: 700;
}
.mine__sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  opacity: 0.85;
}
.mine__login-btn {
  /* light 主题默认浅品牌底,深蓝 hero 上不够 crisp → 变量洗成纯白容器色 */
  --td-button-light-bg-color: var(--td-bg-color-container);
  --td-button-light-border-color: var(--td-bg-color-container);
  /* 白底胶囊浮在渐变上,补一层影拉开层次(与 .mine__stats 同源) */
  box-shadow: 0 6rpx 20rpx rgba(0, 40, 120, 0.25);
}
.mine__stats {
  display: flex;
  margin: -28rpx 24rpx 0;
  padding: 26rpx 0;
  background: #fff;
  border-radius: var(--td-radius-large);
  box-shadow: 0 8rpx 24rpx rgba(0, 82, 217, 0.12);
  position: relative;
}
.mine__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.mine__stat-num {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--td-brand-color);
}
.mine__stat-label {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--td-text-color-secondary);
}
.card {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.section-title {
  margin-left: 24rpx;
  margin-right: 24rpx;
}
.mine__menu {
  padding: 0 24rpx;
}
.mine__cell {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}
.mine__cell:last-child {
  border-bottom: none;
}
.mine__cell-label {
  flex: 1;
  font-size: 28rpx;
}
.mine__cell-hint {
  font-size: 24rpx;
  color: var(--td-text-color-placeholder);
}
.mine__cell-arrow {
  margin-left: 12rpx;
  font-size: 34rpx;
  color: var(--td-text-color-placeholder);
}
.mine__about {
  margin-top: 40rpx;
}
.mine__about-title {
  font-size: 28rpx;
  font-weight: 600;
}
.mine__about-body {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: var(--td-text-color-secondary);
  /* text 子节点默认行内,多段落会连排成一行 */
  text {
    display: block;
  }
}
.mine__version {
  display: block;
  margin-top: 18rpx;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
.mine__icp {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1px solid var(--td-border-level-1-color);
}
.mine__icp-text {
  font-size: 22rpx;
  color: var(--td-text-color-secondary);
}
.mine__icp-url {
  font-size: 22rpx;
  color: var(--td-brand-color);
}
</style>
