<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import type { MemberDetail } from '@/types/member'

/**
 * 我的资料 —— 个人信息填写 / 编辑页。
 *
 * 表单本体用 TDesign t-form + t-form-item:label 布局、分隔线、错误提示、校验
 * 都是组件自带,页面不再手绘 field/divider 行。
 * 进入页面只读展示;点顶栏「编辑」可修改,「确认」调 form.submit() 校验通过后保存(联调后换 API)。
 */

interface ProfileForm {
  name: string
  gender: '' | '男' | '女' | '保密'
  phone: string
  wechat: string
  graduationYear: string
  major: string
  /** 现居地址(MemberDetail 未含,扩展字段) */
  address: string
  /** 补充说明(MemberDetail 未含,扩展字段) */
  note: string
}

/** MemberDetail + 前端扩展字段 */
interface ProfileExtra extends MemberDetail {
  address?: string
  note?: string
}

/** 性别选项 —— t-radio-group 一行并列(radio 用 block=false 取消整行块级) */
const GENDERS = ['男', '女', '保密'] as const

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
/** 头像临时路径 */
const photoFiles = ref<string[]>([])
/** t-form 实例:「确认」按钮在头部(表单外),只能拿实例调 submit() 触发校验 */
const formRef = ref<{ submit: () => void } | null>(null)

/** 表单数据:从 userStore/profile 回填,t-form 通过 :data 绑定它做校验取值 */
const form = reactive<ProfileForm>({
  name: '',
  gender: '',
  phone: '',
  wechat: '',
  graduationYear: '',
  major: '',
  address: '',
  note: '',
})

/** 从 MemberDetail 回填到表单 + 头像 */
const loadProfile = async () => {
  loading.value = true
  const p = user.profile! as ProfileExtra
  if (p) {
    form.name = p.name ?? ''
    form.gender = p.gender === 1 ? '男' : p.gender === 2 ? '女' : ''
    form.phone = p.phone ?? ''
    form.wechat = p.wechatId ?? ''
    form.graduationYear = p.graduationYear ? String(p.graduationYear) : ''
    form.major = p.major ?? ''
    form.address = p.address ?? ''
    form.note = p.note ?? ''
    photoFiles.value = [p.avatarUrl].filter(Boolean)
  }
  loading.value = false
}

// 页面挂载时加载
loadProfile()

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

/**
 * t-form submit 回调:validateResult === true 表示全部通过;
 * 不通过时组件已按 show-error-message 在字段下方内联显示原因。
 */
const onSubmit = (ctx: { validateResult: true | Record<string, unknown> }) => {
  if (ctx.validateResult !== true) {
    uni.showToast({ title: '请先修正表单错误', icon: 'none' })
    return
  }
  saving.value = true
  setTimeout(() => {
    user.profile!.name = form.name.trim() || user.profile!.name
    user.profile!.avatarUrl = photoFiles.value[0] ?? ''
    saving.value = false
    editing.value = false
    uni.showToast({ title: '保存成功', icon: 'success' })
  }, 500)
}

/** radio-group 的 change 负载是 { value } 对象,取消勾选时为 null——别把 $event 直接赋给字符串 */
const onGenderChange = (e: { value: string | null }) => {
  form.gender = e.value === '男' || e.value === '女' || e.value === '保密' ? e.value : ''
}

const onChoosePhoto = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      photoFiles.value = (res.tempFilePaths as string[]).slice(0, 1)
    },
  })
}

const onRemovePhoto = () => {
  photoFiles.value = []
}
</script>

<template>
  <view class="page profile">
    <!-- ---- 加载中 ---- -->
    <view v-if="loading" class="profile__loading">
      <t-loading theme="circular" size="48rpx" text="加载中" />
    </view>

    <template v-else>
      <!-- ---- 头部信息行（含右侧按钮） ---- -->
      <view class="profile__header">
        <t-avatar
          :image="photoFiles[0] || (user.profile?.avatarUrl ?? '')"
          size="large"
          shape="circle"
          @click="editing ? onChoosePhoto : null"
        >
          {{ form.name?.[0] }}
        </t-avatar>
        <view class="profile__header-body">
          <text class="profile__name">{{ form.name || '点击填写姓名' }}</text>
          <text v-if="editing" class="profile__hint">点击更换头像</text>
        </view>
        <!-- 弹性占位：把按钮推到最右 -->
        <view class="profile__spacer" />
        <!-- 顶栏操作区：和头像同行靠右 -->
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
        <view
          v-if="editing && photoFiles.length"
          class="profile__avatar-del"
          @click.stop="onRemovePhoto"
        >
          <t-icon name="close" size="24rpx" color="#fff" />
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
            <t-input
              :value="form.name"
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

        <!-- ---- 联系方式 ---- -->
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
          <t-form-item label="微信" name="wechat">
            <t-input
              :value="form.wechat"
              placeholder="微信号/QQ号等"
              borderless
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.wechat = $event"
            />
          </t-form-item>
          <t-form-item label="地址" name="address">
            <t-input
              :value="form.address"
              placeholder="现居地址"
              borderless
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.address = $event"
            />
          </t-form-item>
        </view>
        <view class="section-title"><text>补充说明</text></view>
        <view class="card profile__form-card">
          <!-- 多行字段不设左侧 label:label 行盒(48rpx 居中)与贴顶排布的 textarea 首行天然错位,跨端还有波动。
               分组标题已说明字段用途,单元格内只留输入区 -->
          <t-form-item name="note">
            <t-textarea
              t-class="textarea"
              :value="form.note"
              placeholder="补充信息(可选)"
              :maxlength="200"
              indicator
              :disabled="!editing"
              style="flex: 1"
              @update:value="form.note = $event"
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
  top: 52rpx;
  right: 12rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
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
