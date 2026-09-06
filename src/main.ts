import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// TDesign 全局样式。组件的 CSS 变量(颜色/圆角/间距等设计 token)都定义在这里,
// 不引入的话所有 t-* 组件会渲染成无样式状态。
// 用 Less 版本:rpx 单位,与 tdesign-miniprogram 完全一致。
import '@tdesign/uniapp/theme.less'

export function createApp() {
  const app = createSSRApp(App)
  // 只建两个 store,见 docs/ARCHITECTURE.md 的「什么状态该进 Pinia」
  app.use(createPinia())
  return { app }
}
