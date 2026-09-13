<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/user'
import { ApiError, buildFileUrl, uploadFile } from '@/utils/request'
import type { Gender } from '@/types/member'
import type { ProfileUpdateRequest } from '@/types/user'

/**
 * 我的资料 —— 个人信息填写 / 编辑页(F6 + 修订 A5 + D3 前端)。
 *
 * 真保存链路:onLoad 登录硬门 → 表单(头像=button open-type=chooseAvatar、
 * 姓名=input type=nickname,微信「头像昵称填写能力」,个人主体可用但必须用户主动点)
 * → 保存时新临时头像先 POST /tsa/files 换永久路径 → PUT /tsa/user/profile(C7,
 * 只提交改动字段)→ 返回值直接写回 user.profile。
 * address 表单项已删:member 表无对应列(D3 倾向砍,不并入 intro)。
 */

interface ProfileForm {
  name: string
  gender: '' | '男' | '女' | '保密'
  phone: string
  wechatId: string
  graduationYear: string
  major: string
  /** 补充说明 —— 对应 MemberDetail.intro(契约 C7 字段名) */
  intro: string
}

/** 性别选项 —— t-radio-group 一行并列(radio 用 block=false 取消整行块级) */
const GENDERS = ['男', '女', '保密'] as const
/** 表单中文选项 → 后端字典 code(0 未知/保密 · 1 男 · 2 女) */
const GENDER_CODES: Record<'男' | '女' | '保密', Gender> = { 男: 1, 女: 2, 保密: 0 }

/**
 * t-form 校验规则。telnumber 为组件内置手机号正则(同 /^1[3-9]\d{9}$/);
 * 校验引擎对「非 required 规则 + 空值」自动跳过,手机不填也放行 —— 与旧手写校验行为一致。
 */
const RULES = {
  phone: [{ telnumber: true, message: '请输入正确的手机号码' }],
}

const user = useUserStore()

/** 是否为编辑模式 */
const editing = ref(false)
/** 加载中 */
const loading = ref(true)
/** 正在保存 */
const saving = ref(false)
/** 已登录无档案(本期所有新用户的初始态):表单显示空值 + 顶部给待审提示 */
const noProfile = ref(false)
/** 头像路径:展示位统一经 buildFileUrl(临时路径/绝对址/相对址一把兜) */
const photoFiles = ref<string[]>([])
/** t-form 实例:「确认」按钮在头部(表单外),只能拿实例调 submit() 触发校验 */
const formRef = ref<{ submit: () => void } | null>(null)

/** 表单数据:从 userStore/profile 回填,t-form 通过 :data 绑定它做校验取值 */
const form = reactive<ProfileForm>({
  name: '',
  gender: '',
  phone: '',
  wechatId: '',
  graduationYear: '',
  major: '',
  intro: '',
})

/**
 * 进入编辑时的字段快照(非响应式:它只用于 diff,不参与渲染)。
 * C7 要求「只提交改动字段」,拿 form 与它逐字段比,避免把未动过的空串盖进档案。
 */
let snapshot: ProfileForm = { ...form }
/** 头像单独记快照(它是 ref 数组,不进 form) */
let snapshotAvatar = ''

/** 展示用头像:编辑中的新选头像优先,否则档案里的已存地址 */
const avatarSrc = computed(() => buildFileUrl(photoFiles.value[0] || user.profile?.avatarUrl || ''))

/**
 * 从 user.profile 回填表单。**profile 可为 null**(已登录未建档):空表单 + 待审提示。
 * 旧版这里写 `user.profile!` 非空断言,对本期所有新用户必 TypeError 白屏(修订 A5)。
 */
const loadProfile = () => {
  const p = user.profile
  noProfile.value = !p
  form.name = p?.name ?? ''
  // 回填只认 1/2;0(未知/保密)显示为空选项,与后端「0=未填」的档案默认值对齐
  form.gender = p?.gender === 1 ? '男' : p?.gender === 2 ? '女' : ''
  form.phone = p?.phone ?? ''
  form.wechatId = p?.wechatId ?? ''
  form.graduationYear = p?.graduationYear ? String(p.graduationYear) : ''
  form.major = p?.major ?? ''
  form.intro = p?.intro ?? ''
  photoFiles.value = p?.avatarUrl ? [p.avatarUrl] : []
  snapshot = { ...form }
  snapshotAvatar = photoFiles.value[0] ?? ''
  loading.value = false
}

/** diff 出相对快照有改动的字段;全空返回 {} 表示无事可做 */
const buildPatch = (): ProfileUpdateRequest => {
  const patch: ProfileUpdateRequest = {}
  const trimmed = [
    ['name', form.name] as const,
    ['phone', form.phone] as const,
    ['wechatId', form.wechatId] as const,
    ['major', form.major] as const,
    ['intro', form.intro] as const,
  ]
  for (const [key, value] of trimmed) {
    const v = value.trim()
    if (v !== snapshot[key].trim()) patch[key] = v
  }
  if (form.gender !== snapshot.gender && form.gender !== '') {
    patch.gender = GENDER_CODES[form.gender]
  }
  const gy = form.graduationYear.trim()
  if (gy !== snapshot.graduationYear && gy) {
    // parseInt + 范围校验(1950..2100)由后端兜;非数字串直接忽略不上送
    const n = parseInt(gy, 10)
    if (Number.isFinite(n)) patch.graduationYear = n
  }
  return patch
}

/**
 * t-form submit 回调:validateResult === true 表示全部通过;
 * 不通过时组件已按 show-error-message 在字段下方内联显示原因。
 * 旧的 setTimeout 假保存已删 —— 现在真打 PUT /tsa/user/profile(C7)。
 */
const onSubmit = async (ctx: { validateResult: true | Record<string, unknown> }) => {
  if (ctx.validateResult !== true) {
    uni.showToast({ title: '请先修正表单错误', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const patch = buildPatch()
    // chooseAvatar/旧 chooseImage 给的是临时路径(wxfile://、http://tmp/),
    // 重启即失效 —— 只有本次新选/删除头像才需要动上传,存量地址原样保留
    const newAvatar = photoFiles.value[0] ?? ''
    if (newAvatar !== snapshotAvatar) {
      if (newAvatar.startsWith('wxfile://') || newAvatar.startsWith('http://tmp/')) {
        // uploadFile 回的相对路径(/tsa/files/<uuid>.<ext>)原样入库(C8/D3 口径「落库存相对路径,
        // 展示时才拼绝对址」):API 域名是编译期常量,拼成绝对址写进数据,§9.E 换正式域名后存量头像全瞎。
        // 渲染位(profile.vue avatarSrc / mine/index / 列表封面)都过 buildFileUrl,自动补前缀
        const saved = await uploadFile(newAvatar)
        patch.avatarUrl = saved
      } else {
        patch.avatarUrl = newAvatar
      }
    }
    if (Object.keys(patch).length === 0) {
      editing.value = false
      uni.showToast({ title: '没有需要保存的修改', icon: 'none' })
      return
    }
    const updated = await userApi.saveProfile(patch)
    // C7 回「更新后的本人视角档案」,直接写回 store:hero 三态/本页回填都吃它
    user.profile = updated
    loadProfile()
    editing.value = false
    uni.showToast({ title: '已提交,待审核', icon: 'success' })
  } catch (err) {
    // 保存失败:留在编辑态,用户改完可再点「确认」。
    // ApiError 的 message 是后端壳里的现成人话(@Valid 的「姓名最长 32 个字符」这类
    // 字段级定位全靠它)——盖成统一的「保存失败」会让用户看不出改哪、反复无效重试;
    // 只有非壳异常(网络断/未知)才用泛化文案
    console.warn('[profile] 保存失败', err)
    const tip = err instanceof ApiError && err.message ? err.message : '网络异常,请稍后重试'
    uni.showToast({ title: tip, icon: 'none' })
  } finally {
    saving.value = false
  }
}

/** 进入/退出编辑模式 */
const onEdit = () => {
  editing.value = true
}

const onCancel = () => {
  editing.value = false
  loadProfile()
}

/** 头部「确认」:交给 t-form 校验,结果在 onSubmit 回调里处理 */
const onConfirmEdit = () => {
  formRef.value?.submit()
}

/** radio-group 的 change 负载是 { value } 对象,取消勾选时为 null——别把 $event 直接赋给字符串 */
const onGenderChange = (e: { value: string | null }) => {
  form.gender = e.value === '男' || e.value === '女' || e.value === '保密' ? e.value : ''
}

/** chooseAvatar 事件负载官方字段是 detail.avatarUrl(临时路径);uni 模板事件不经 props 校验,手动收窄 */
const onChooseAvatar = (e: Event) => {
  const detail = (e as unknown as { detail?: { avatarUrl?: string } }).detail
  if (detail?.avatarUrl) photoFiles.value = [detail.avatarUrl]
}

const onRemovePhoto = () => {
  photoFiles.value = []
}

/**
 * 登录硬门(F6):资料接口全部 Bearer 受保护,未登录进来必然碰壁,前置自救一次。
 * silentLogin 不 throw,直接 await;冷启动 deep-link 进本页时 App.vue 的登录可能
 * 还在飞,这里共享 store 的单飞 pending,不会触发第二次 wechat-login。
 */
onLoad(async () => {
  if (!user.isLogin) await user.silentLogin()
  if (!user.isLogin) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    uni.navigateBack()
    return
  }
  if (!user.profile) {
    try {
      // 401 由 request 层自愈;彻底拉不到(离线)也放行 —— 空表单+待审提示,提交时再验
      await user.fetchProfile()
    } catch (err) {
      console.warn('[profile] 档案拉取失败,按无档案态展示', err)
    }
  }
  loadProfile()
})
</script>

<template>
  <view class="page profile">
    <!-- ---- 加载中 ---- -->
    <view v-if="loading" class="profile__loading">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>

    <template v-else>
      <!-- ---- 头部信息行(含右侧按钮) ---- -->
      <view class="profile__header">
        <view class="profile__avatar-wrap">
          <t-avatar :image="avatarSrc" size="large" shape="circle">
            {{ form.name?.[0] }}
          </t-avatar>
          <!-- 头像昵称填写能力只认真实 <button open-type="chooseAvatar"> 的点击,
               t-avatar 承担不了 open-type —— 编辑态在其上盖一个全透明 button,
               展示态(v-if=false)保持纯 t-avatar 不可点 -->
          <button
            v-if="editing"
            class="profile__avatar-choose"
            open-type="chooseAvatar"
            @chooseavatar="onChooseAvatar"
          />
          <view
            v-if="editing && photoFiles.length"
            class="profile__avatar-del"
            @click.stop="onRemovePhoto"
          >
            <t-icon name="close" size="24rpx" color="#fff" />
          </view>
        </view>
        <view class="profile__header-body">
          <text class="profile__name">{{ form.name || '点击填写姓名' }}</text>
          <text v-if="editing" class="profile__hint">点击更换头像</text>
        </view>
        <!-- 弹性占位:把按钮推到最右 -->
        <view class="profile__spacer" />
        <!-- 顶栏操作区:和头像同行靠右 -->
        <view class="profile__toolbar">
          <template v-if="!editing">
            <t-button theme="primary" variant="outline" shape="round" size="small" @click="onEdit">
              编辑
            </t-button>
          </template>
          <template v-else>
            <t-button theme="default" variant="base" shape="round" size="small" @click="onCancel">
              取消
            </t-button>
            <t-button
              theme="primary"
              variant="base"
              shape="round"
              size="small"
              :loading="saving"
              @click="onConfirmEdit"
            >
              {{ saving ? '保存中...' : '确认' }}
            </t-button>
          </template>
        </view>
      </view>

      <!-- ---- 表单:label 布局、分隔线、校验由 t-form/t-form-item 接管 ---- -->
      <t-form
        ref="formRef"
        :data="form"
        :rules="RULES"
        label-align="left"
        label-width="160rpx"
        show-error-message
        scroll-to-first-error="smooth"
        @submit="onSubmit"
      >
        <!-- ---- 基本信息 ---- -->
        <view class="section-title"><text>基本信息</text></view>
        <view class="card profile__form-card">
          <t-form-item label="姓名" name="name">
            <!-- type="nickname":微信昵称键盘顶部会联想用户微信昵称,一键填入(2.21.2+,
                 t-input 已内建该 type 并转发给原生 input,选填能力不需要页面自己接) -->
            <t-input
              :value="form.name"
              type="nickname"
              placeholder="请输入姓名"
              borderless
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.name = $event"
            />
          </t-form-item>
          <t-form-item label="性别" name="gender">
            <t-radio-group
              t-class="box"
              :value="form.gender"
              :disabled="!editing"
              borderless
              style="flex: 1"
              @change="onGenderChange"
            >
              <t-radio
                v-for="g in GENDERS"
                :key="g"
                :block="false"
                :value="g"
                :label="g"
                class="profile__gender-option"
              />
            </t-radio-group>
          </t-form-item>
          <t-form-item label="毕业年份" name="graduationYear">
            <t-input
              :value="form.graduationYear"
              placeholder="如 2020"
              borderless
              type="number"
              maxlength="4"
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.graduationYear = $event"
            />
          </t-form-item>
          <t-form-item label="专业" name="major">
            <t-input
              :value="form.major"
              placeholder="所学专业"
              borderless
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.major = $event"
            />
          </t-form-item>
        </view>

        <!-- ---- 联系方式(「地址」项已删:member 表无对应列,D3 砍掉) ---- -->
        <view class="section-title"><text>联系方式</text></view>
        <view class="card profile__form-card">
          <t-form-item label="手机" name="phone">
            <t-input
              :value="form.phone"
              placeholder="请输入手机号码"
              borderless
              type="number"
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.phone = $event"
            />
          </t-form-item>
          <t-form-item label="微信" name="wechatId">
            <t-input
              :value="form.wechatId"
              placeholder="微信号/QQ号等"
              borderless
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.wechatId = $event"
            />
          </t-form-item>
        </view>
        <view class="section-title"><text>补充说明</text></view>
        <view class="card profile__form-card">
          <!-- 多行字段不设左侧 label:label 行盒(48rpx 居中)与贴顶排布的 textarea 首行天然错位,跨端还有波动。
               分组标题已说明字段用途,单元格内只留输入区 -->
          <t-form-item name="intro">
            <t-textarea
              t-class="textarea"
              :value="form.intro"
              placeholder="补充信息(可选)"
              :maxlength="200"
              indicator
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.intro = $event"
            />
          </t-form-item>
        </view>
      </t-form>
    </template>
  </view>
</template>

<style lang="less" scoped>
:deep(.textarea) {
  width: 100%;
  --textarea-vertical-padding: 0;
  --td-textarea-horizontal-padding: 0;
  padding: 0 !important;
}
:deep(.textarea .t-textarea) {
  padding: 0 !important;
}
:deep(.box) {
  width: 100%;
  display: flex;
  justify-content: space-between;
}
.profile {
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  background: #f5f5f5;
}

/* ---- 加载态 ---- */
.profile__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

/* ---- 无档案待审提示 ---- */
.profile__notice {
  margin: 24rpx 24rpx 0;
  padding: 20rpx 24rpx;
  border-radius: var(--td-radius-default);
  background: var(--td-primary-color-1, #e8f3ff);
}
.profile__notice-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--td-brand-color);
}

/* ---- 工具栏 ---- */
.profile__toolbar {
  position: absolute;
  top: 64rpx;
  right: 24rpx;
  z-index: 10;
}

/* ---- 头部信息行 ---- */
.profile__header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 40rpx 32rpx 20rpx;
}
.profile__avatar-wrap {
  position: relative;
  display: inline-flex;
}
/* 透明按钮盖在头像上承接 chooseAvatar 点击;原生 button 默认底/边全清掉 */
.profile__avatar-choose {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  opacity: 0;
  background: transparent;
  border: none;
  line-height: 1;
}
.profile__avatar-choose::after {
  border: none;
}
.profile__name {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--td-text-color-primary);
}
.profile__hint {
  margin-left: 10rpx;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--td-text-color-placeholder);
}
.profile__spacer {
  flex: 1;
}
.profile__toolbar {
  display: flex;
  gap: 16rpx;
}
.profile__avatar-del {
  position: absolute;
  /* 盖在头像右上角;z-index 压过透明 chooseAvatar 按钮,否则点击会被吞 */
  z-index: 1;
  top: -8rpx;
  right: -8rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: var(--td-radius-circle);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

/* ---- 表单卡片:单元格自带内边距与分隔线,清掉 .card 的 padding 并裁圆角 ---- */
.profile__form-card {
  padding: 0;
  overflow: hidden;
}
/* t-input 控件 min-height 48rpx 但 line-height:inherit(normal),文字贴顶,
   比行高固定 48rpx 的 form label 偏高 —— 显式对齐行高使其垂直居中 */
.profile__form-card :deep(.t-input__control) {
  line-height: 48rpx;
}
/* 同行并列的性别项(block=false):class 落在组件宿主节点上,用相邻选择器拉开间距 */
.profile__gender-option + .profile__gender-option {
  margin-left: 48rpx;
}
</style>
