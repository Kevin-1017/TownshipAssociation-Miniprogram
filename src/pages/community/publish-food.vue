<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { appendUserPost } from '@/utils/community-posts'
import type { CommunityPost, CommunityRegion } from '@/types/community'

/**
 * 发布美食动态 —— 从美食基地页「+」进入的独立表单页。
 *
 * 不塞弹层的理由:页内有 textarea、评分、选图与键盘交互,
 * 底部抽屉会被键盘顶出滚动冲突;一次完整任务流交给页面承载更干净。
 */

/** 菜系候选:与美食基地筛选同一份口径(将来一起迁到字典接口) */
const CUISINE_OPTIONS = ['潮汕菜', '粤菜', '客家菜', '川菜', '湘菜', '西北菜', '日韩料理', '西餐']
/** 地区候选:label 展示、value 入库;「其他」存用户自填文本 */
const REGION_PRESETS: { label: string; value: string }[] = [
  { label: '龙洞', value: 'longdong' },
  { label: '大学城', value: 'daxuecheng' },
]
const OTHER = '其他'

/** t-form 提交事件负载(uniapp 版 submit 只回这两项) */
interface FormSubmitEvent {
  validateResult: true | Record<string, unknown>
  firstError: string
}

const user = useUserStore()

/** 表单数据:字段名与 rules/form-item 的 name 一一对应 */
const formData = reactive({
  title: '',
  content: '',
  /** 生效菜系:预置名或「其他」时用户自填的文本 */
  cuisine: '',
  /** 生效地区:longdong/daxuecheng 或自定义文本 */
  region: '',
  rating: 0,
})

/** 「其他」交互:cuisinePreset/regionPreset 记选中的标签,自填文本另存再合成进 formData */
const cuisinePreset = ref('')
const customCuisine = ref('')
const regionPreset = ref('')
const customRegion = ref('')

/** 照片临时路径(选填,最多 1 张) */
const photoFiles = ref<string[]>([])

// ---------- 校验规则 ----------
// rules 经 :rules 绑定给 t-form,uni-app 是用 setData 把自定义组件的 props 下发的,
// 微信的 setData 不接受 function 值 —— 规则里一旦放 validator 函数,
// 首次渲染整包 setData 抛错、整个表单 wx:if 拿不到数据,页面直接白屏。
// 因此这里只留可序列化的声明式字段;需要算字符串的校验(字数、评分)挪到提交时的 checkExtras。
const rules = {
  title: [
    { required: true, message: '请填写标题' },
    { whitespace: true, message: '标题不能只填空格' },
  ],
  content: [
    { required: true, message: '请填写内容' },
    { whitespace: true, message: '内容不能只填空格' },
  ],
  cuisine: [{ required: true, message: '请选择菜系;选「其他」要填写名称' }],
  region: [{ required: true, message: '请选择地区;选「其他」要填写名称' }],
}

// ---------- 派生逻辑 ----------
/** 选中预置 → 用预置值;选「其他」→ 用自填文本(没填即为空,由 required 拦下) */
const syncCuisine = () => {
  formData.cuisine =
    cuisinePreset.value === OTHER ? customCuisine.value.trim() : cuisinePreset.value
}
const syncRegion = () => {
  if (regionPreset.value === OTHER) {
    formData.region = customRegion.value.trim()
    return
  }
  formData.region =
    REGION_PRESETS.find((r) => r.label === regionPreset.value)?.value ?? regionPreset.value
}

watch([cuisinePreset, customCuisine], syncCuisine)
watch([regionPreset, customRegion], syncRegion)

// ---------- 事件 ----------
/** check-tag 单选语义:点已选中的即取消;离开「其他」时清掉自填草稿 */
const onPickCuisine = (v: string) => {
  cuisinePreset.value = cuisinePreset.value === v ? '' : v
  if (cuisinePreset.value !== OTHER) customCuisine.value = ''
}
const onPickRegion = (v: string) => {
  regionPreset.value = regionPreset.value === v ? '' : v
  if (regionPreset.value !== OTHER) customRegion.value = ''
}

const onRateChange = (e: { value: number }) => {
  formData.rating = e.value
}

/**
 * 照片选择:t-upload 的 requestMethod 必须传函数,会踩上面 rules 同款 setData 坑,
 * 且 mock 阶段本就没有上传服务 —— 直接 chooseImage 拿临时路径预览,联调再换上传方案。
 */
const onChoosePhoto = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      photoFiles.value = (res.tempFilePaths as string[]).slice(0, 1)
    },
  })
}
const onRemovePhoto = (i: number) => {
  photoFiles.value = photoFiles.value.filter((_, idx) => idx !== i)
}

/** rules 只做「填没填」,字数与评分这类要算值的规则在这里补,返回第一条错误文案 */
const checkExtras = (): string => {
  const title = formData.title.trim()
  if (title.length < 5 || title.length > 30) return '标题需 5~30 个字'
  if (formData.content.trim().length < 10) return '内容至少 10 个字'
  if (formData.rating <= 0) return '请为本次体验打个分'
  return ''
}

const onFormSubmit = (e: FormSubmitEvent) => {
  if (e.validateResult !== true) {
    uni.showToast({ title: e.firstError || '请检查填写内容', icon: 'none' })
    return
  }
  const extraError = checkExtras()
  if (extraError) {
    uni.showToast({ title: extraError, icon: 'none' })
    return
  }
  const post: CommunityPost = {
    id: `p_${Date.now()}`,
    type: 'food',
    author: user.displayName,
    avatar: user.profile?.avatarUrl ?? '',
    title: formData.title.trim(),
    content: formData.content.trim(),
    // 临时路径只在当前会话有效,mock 阶段够看效果;联调后换成上传服务返回的正式地址
    images: photoFiles.value,
    publishTime: new Date().toISOString(),
    likes: 0,
    comments: 0,
    cuisine: formData.cuisine,
    region: formData.region as CommunityRegion,
  }
  appendUserPost(post)
  uni.showToast({ title: '发布成功', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 600)
}
</script>

<template>
  <view class="page publish">
    <t-form
      :data="formData"
      :rules="rules"
      label-align="top"
      show-error-message
      @submit="onFormSubmit"
    >
      <t-form-item label="标题" name="title">
        <t-input
          :value="formData.title"
          borderless
          placeholder="5~30 字,一句话说清主题"
          style="flex: 1"
          @update:value="formData.title = $event"
        />
      </t-form-item>

      <t-form-item label="内容" name="content">
        <t-textarea
          t-class="textarea"
          :value="formData.content"
          placeholder="至少 10 字:店在哪、点了什么、值不值得去"
          :maxlength="500"
          indicator
          style="flex: 1"
          @update:value="formData.content = $event"
        />
      </t-form-item>

      <t-form-item label="菜系" name="cuisine">
        <view class="publish__field">
          <view class="publish__tags">
            <t-check-tag
              v-for="c in [...CUISINE_OPTIONS, OTHER]"
              :key="c"
              :content="c"
              shape="round"
              variant="light-outline"
              :checked="cuisinePreset === c"
              @change="onPickCuisine(c)"
            />
          </view>
          <t-input
            v-if="cuisinePreset === OTHER"
            :value="customCuisine"
            borderless
            placeholder="输入其他菜系名称"
            style="width: 100%"
            @update:value="customCuisine = $event"
          />
        </view>
      </t-form-item>

      <t-form-item label="地区" name="region">
        <view class="publish__field">
          <view class="publish__tags">
            <t-check-tag
              v-for="r in [...REGION_PRESETS.map((x) => x.label), OTHER]"
              :key="r"
              :content="r"
              shape="round"
              variant="light-outline"
              :checked="regionPreset === r"
              @change="onPickRegion(r)"
            />
          </view>
          <t-input
            v-if="regionPreset === OTHER"
            :value="customRegion"
            borderless
            placeholder="输入其他地区名称"
            style="width: 100%"
            @update:value="customRegion = $event"
          />
        </view>
      </t-form-item>

      <t-form-item label="评价" name="rating">
        <t-rate :value="formData.rating" @change="onRateChange" />
      </t-form-item>

      <!-- 照片:唯一非必填项,最多 1 张 -->
      <t-form-item label="照片(最多 1 张,可不传)" label-width="300">
        <view class="publish__photos">
          <view v-for="(src, i) in photoFiles" :key="src" class="publish__photo">
            <image class="publish__photo-img" mode="aspectFill" :src="src" />
            <view class="publish__photo-del" @click.stop="onRemovePhoto(i)">
              <!-- 图标 color 是 prop、走不了 CSS 变量,深底白字用字面值 -->
              <t-icon name="close" size="28rpx" color="#fff" />
            </view>
          </view>
          <view v-if="photoFiles.length === 0" class="publish__photo-add" @click="onChoosePhoto">
            <t-icon name="add" size="52rpx" />
          </view>
        </view>
      </t-form-item>

      <!-- 提交:t-button type=submit 借原生 form 机制触发校验,不走组件实例方法 -->
      <view class="publish__submit">
        <t-button theme="primary" type="submit" block shape="round" size="large">发布</t-button>
      </view>
    </t-form>
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
.publish {
  padding-bottom: 40rpx;
}
/* 标签组 + 条件出现的自填输入纵向堆叠 */
.publish__field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
}
.publish__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
/* ---- 照片 ---- */
.publish__photos {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.publish__photo,
.publish__photo-add {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--td-radius-medium);
}
.publish__photo-img {
  width: 100%;
  height: 100%;
  border-radius: var(--td-radius-medium);
}
.publish__photo-add {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  color: var(--td-text-color-placeholder);
  background: var(--td-bg-color-page);
  border: 2rpx dashed var(--td-border-level-2-color);
}
.publish__photo-del {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 半透明黑角标:TDesign 没有对应变量这类蒙层元素,用字面值 */
  background: rgba(0, 0, 0, 0.5);
}
.publish__submit {
  margin: 48rpx 32rpx 0;
}
</style>
