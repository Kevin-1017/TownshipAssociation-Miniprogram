<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { appendUserPost } from '@/utils/community-posts'
import type { CommunityPost } from '@/types/community'

/**
 * 发布校园动态 —— 从校园广场页「+」进入的独立表单页。
 * 不与 publish-food 共用参数化页面:那页六成的逻辑是美食专属的
 * (菜系/地区标签、「其他」输入、评分),合并只会攒 v-if 分支。
 */

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
})

/** 照片临时路径(选填,最多 1 张) */
const photoFiles = ref<string[]>([])

// ---------- 校验规则 ----------
// rules 经 :rules 绑定给 t-form,uni-app 是用 setData 把自定义组件的 props 下发的,
// 微信的 setData 不接受 function 值 —— 规则里一旦放 validator 函数,
// 首次渲染整包 setData 抛错、整个表单拿不到数据,页面直接白屏。
// 因此这里只留可序列化的声明式字段;需要算字符串的校验(字数)挪到提交时的 checkExtras。
const rules = {
  title: [
    { required: true, message: '请填写标题' },
    { whitespace: true, message: '标题不能只填空格' },
  ],
  content: [
    { required: true, message: '请填写内容' },
    { whitespace: true, message: '内容不能只填空格' },
  ],
}

// ---------- 事件 ----------
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

/** rules 只做「填没填」,字数这类要算值的规则在这里补,返回第一条错误文案 */
const checkExtras = (): string => {
  const title = formData.title.trim()
  if (title.length < 5 || title.length > 30) return '标题需 5~30 个字'
  if (formData.content.trim().length < 10) return '内容至少 10 个字'
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
    type: 'campus',
    author: user.displayName,
    avatar: user.profile?.avatarUrl ?? '',
    title: formData.title.trim(),
    content: formData.content.trim(),
    // 临时路径只在当前会话有效,mock 阶段够看效果;联调后换成上传服务返回的正式地址
    images: photoFiles.value,
    publishTime: new Date().toISOString(),
    likes: 0,
    comments: 0,
  }
  appendUserPost(post)
  uni.showToast({ title: '发布成功', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 600)
}
</script>

<template>
  <view class="page publish-campus">
    <t-form :data="formData" :rules="rules" label-align="top" show-error-message @submit="onFormSubmit">
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
          :value="formData.content"
          placeholder="至少 10 字:发生了什么、有什么想说的"
          :maxlength="500"
          indicator
          style="flex: 1"
          @update:value="formData.content = $event"
        />
      </t-form-item>

      <!-- 照片:唯一非必填项,最多 1 张 -->
      <t-form-item label="照片(最多 1 张,可不传)">
        <view class="publish-campus__photos">
          <view v-for="(src, i) in photoFiles" :key="src" class="publish-campus__photo">
            <image class="publish-campus__photo-img" mode="aspectFill" :src="src" />
            <view class="publish-campus__photo-del" @click.stop="onRemovePhoto(i)">
              <!-- 图标 color 是 prop、走不了 CSS 变量,深底白字用字面值 -->
              <t-icon name="close" size="28rpx" color="#fff" />
            </view>
          </view>
          <view
            v-if="photoFiles.length === 0"
            class="publish-campus__photo-add"
            @click="onChoosePhoto"
          >
            <t-icon name="add" size="52rpx" />
          </view>
        </view>
      </t-form-item>

      <!-- 提交:t-button type=submit 借原生 form 机制触发校验,不走组件实例方法 -->
      <view class="publish-campus__submit">
        <t-button theme="primary" type="submit" block shape="round" size="large">发布</t-button>
      </view>
    </t-form>
  </view>
</template>

<style lang="less" scoped>
/* ---- 照片 ---- */
.publish-campus__photos {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.publish-campus__photo,
.publish-campus__photo-add {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--td-radius-medium);
}
.publish-campus__photo-img {
  width: 100%;
  height: 100%;
  border-radius: var(--td-radius-medium);
}
.publish-campus__photo-add {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  color: var(--td-text-color-placeholder);
  background: var(--td-bg-color-page);
  border: 2rpx dashed var(--td-border-level-2-color);
}
.publish-campus__photo-del {
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
.publish-campus__submit {
  margin: 48rpx 32rpx 0;
}
</style>
