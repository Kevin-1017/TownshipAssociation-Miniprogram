<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { setAuthHook } from '@/utils/request'
import { useUserStore } from '@/stores/user'

onLaunch(() => {
  // 把 store 能力接线给网络层:request 不许 import stores(循环依赖),401 自愈靠这对钩子
  const user = useUserStore()
  setAuthHook({
    // 直通三态(而非 store.relogin 的布尔):request 层要区分 retryable(只 toast)与
    // invalid(清态+跳转),压成 boolean 会把 1306 限频当登录失效(修订 A4)
    relogin: () => user.silentLogin({ force: true }),
    clearSession: () => user.clearToken(),
  })
  // 冷启动静默登录:不 await —— 首屏不许被登录链路阻塞;
  // 失败(后端未起/限频)只留日志,受保护接口另有 request 层 401 自愈兜底
  if (!user.isLogin) {
    void user.silentLogin().then((state) => {
      if (state !== 'ok') console.warn('[App] 冷启动静默登录未完成:', state)
    })
  }
})
onShow(() => {
  console.log('App Show')
})
onHide(() => {
  console.log('App Hide')
})
</script>

<template>
  <view />
</template>

<style lang="less">
/* 页面底色显式铺死:微信黑色主题客户端下,未铺底的 page 元素会被 webview 自动涂黑
   (main.ts 已换 theme-light 恒定浅色 token,这里是第二道保险,两者缺一真机都会翻车)。 */
page {
  background-color: #f5f5f5;
}
</style>
