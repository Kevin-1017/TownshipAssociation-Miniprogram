import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// TDesign 全局样式。组件的 CSS 变量(颜色/圆角/间距等设计 token)都定义在这里,
// 不引入的话所有 t-* 组件会渲染成无样式状态。
// 用 Less 版本:rpx 单位,与 tdesign-miniprogram 完全一致。
// ★ theme-light(浅色恒载)而非 theme(light/dark 双份):微信「黑色主题」客户端下
//   theme.less 会按 prefers-color-scheme 把 --td-bg-color-* 翻成深色,而下面的
//   tdesign-override 覆盖的是浅色定值文字 → 真机上黑底黑字整页发黑(2026-09-13 真机实测)。
//   产品定死白底主题,故用恒载浅色的变体;override 的先后顺序注释仍然成立。
import '@tdesign/uniapp/theme-light.less'
// 顺序重要:必须在 theme 之后,否则覆盖不到组件默认值
import './styles/tdesign-override.less'
import './styles/common.less'

export function createApp() {
  const app = createSSRApp(App)
  // 只建两个 store,见 docs/DEVELOPMENT.md 的「什么状态该进 Pinia」
  app.use(createPinia())
  return { app }
}
