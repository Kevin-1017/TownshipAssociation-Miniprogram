---
name: vue-sfc-spec
description: 本项目(潮阳潮南校友会小程序)的 Vue SFC 与 TypeScript 开发规范。编辑、新建或审查 src/ 下任何 .vue 或 .ts 文件时必须先应用本规范。约束 SFC 块顺序(script→template→style)、<script setup> 内部分区顺序(声明先于使用:import→类型常量→props/emits→store→refs→computed→方法→watch→生命周期→defineExpose)、注释语言、分层调用边界、Pinia 状态归属、mock 与 API 契约同步。
---

# Vue SFC 开发规范(强制执行)

**适用范围**:动到 `src/**/*.vue` 或 `src/**/*.ts` 的任何修改 —— 新建、改写、修 bug、重构都算。

完整理由与反面示例见 **[docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md)**,那是唯一权威出处。
本文件只是执行清单;若两者冲突,**以 DEVELOPMENT.md 为准并回来修正本文件**。

---

## 1. SFC 块顺序(ESLint 强制,可 autofix)

```text
<script setup lang="ts">     ← 第一
</script>

<template>                   ← 第二
</template>

<style lang="less" scoped>   ← 第三
</style>
```

先读逻辑,再读结构。与 Vue 官方默认相反,是本项目刻意的选择。
违规时 `pnpm run lint:fix` 会自动重排(`vue/block-order` 规则)。

---

## 2. `<script setup>` 内部分区顺序(ESLint 只管块顺序与宏在最前,以下靠自觉)

核心原则:**声明先于使用** —— 每一段只引用它上方已声明的符号,永不反向引用。
口诀:导入 → 定义 → 接口 → 外部状态 → 内部状态 → 派生 → 方法 → 监听 → 生命周期 → 暴露。

```ts
// ── 0. import(框架 → 第三方 → @/ 别名 → 相对路径,组间空行)
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'

import { memberApi } from '@/api/member'
import type { MemberListItem } from '@/types/member'

// ── 1. 类型 & 模块级常量(仅本组件用的类型就近定义,复用了就搬进 @/types)
const PAGE_SIZE = 20
const TABS = [{ label: '全部', value: '' }]

// ── 2. Props & Emits:组件接口,最先声明,类型必须收窄、禁止 any
const props = defineProps<{ member: MemberListItem }>()
const emit = defineEmits<{ (e: 'click', m: MemberListItem): void }>()

// ── 3. 外部状态接入:store 实例、组合式函数 ────────────
const store = useMemberFilterStore()
const { isLogin } = storeToRefs(store)

// ── 4. refs / reactive:原始状态 ────────────────────────
const list = ref<MemberListItem[]>([])
const loading = ref(false)

// ── 5. computed:派生状态 ───────────────────────────────
const total = computed(() => list.value.length)

// ── 6. 函数/方法:业务逻辑(必须排在 watch 之前,统一用箭头函数)──
const fetchPage = async () => {
  /* ... */
}

// ── 7. watch / watchEffect:副作用(回调只朝上引用)─────
watch(
  () => props.member,
  () => {
    fetchPage()
  },
)

// ── 8. 生命周期 ────────────────────────────────────────
onShow(() => fetchPage(true))

// ── 9. defineExpose(可选,永远放最末尾)─────────────────
// 仅当父组件要用 template ref 调本组件方法时才写。
// <script setup> 默认封闭是特性,本项目现有组件一个都没用到 —— 没用就别写。
```

**第 6 段必须排在第 7 段之前,且统一用箭头函数。** watch 回调(尤其 `{ immediate: true }`)与生命周期都是方法的调用方;方法放下面,写成 `const` 箭头函数就是同步 TDZ 报错。

**第 8/9 段必须在 script 块的最末尾。** 这是最常见的违规点 ——
习惯上会把 `onShow(load)` 写在几个函数中间,读的时候要找"这组件什么时候动"得上下翻。

**注意引入 TDZ**:`const` 声明无提升。按上述顺序写,引用天然全部朝上;
踩坑的都是插错位置的语句 —— `watch` 的 getter 与 `{ immediate: true }` 的回调是立即执行的,
其引用的变量必须在它之前声明。

---

## 3. 命名与文件

| 对象     | 规则                                         | 例                                           |
| -------- | -------------------------------------------- | -------------------------------------------- |
| 页面文件 | `src/pages/<模块>/<index\|list\|detail>.vue` | `pages/member/list.vue`                      |
| 业务组件 | 目录与文件同名,`Tsa` 前缀,大驼峰             | `components/TsaMemberCard/TsaMemberCard.vue` |
| API 模块 | `src/api/<域>.ts`,导出 `<域>Api` 对象        | `memberApi`                                  |
| Store    | `src/stores/<名>.ts`,导出 `use<名>Store`     | `useMemberFilterStore`                       |
| 类型     | `src/types/<域>.d.ts`,接口大驼峰无 `I` 前缀  | `MemberMapPoint`                             |
| ref 变量 | 名词;布尔用 `is/has/can` 前缀                | `isLoading`,`showFilter`                     |
| 函数     | 动词开头                                     | `fetchPage`,`goDetail`,`onMarkerTap`         |
| 事件处理 | `on<Event>`                                  | `onLoad`,`onFilterConfirm`                   |
| 样式类   | BEM,块用页面/组件名                          | `.member-card__title`,`is-on`                |

`vue/multi-word-component-names` 已关闭 —— 页面就叫 `index.vue` / `list.vue`,不必强行复数。

---

## 4. 分层调用边界(越界即返工)

```
pages/       → 只调 api/ 与 components/,不直接 uni.request
components/  → 不 import api/,数据由 props 传入,事件用 emit 上抛
api/         → 只声明接口与类型,无 if/else 业务逻辑,无 URL 拼接细节
utils/request→ 全项目唯一网络出口
mock/        → 只允许 utils/request.ts 动态引入;页面禁止 import mock/
stores/      → 只放跨页面共享状态
```

**`components/` 里出现 `import { memberApi }` 就是错的** —— 那会让组件无法复用且难测试。

**页面里出现 `uni.request(...)` 就是错的** —— 绕过了统一拆壳、token 注入、mock 分流。

---

## 5. 什么状态进 Pinia

只有一个判据:**这份状态是否被两个及以上页面读取,且必须保持一致?**

- 是 → 进 store
- 否 → 留在组件 `ref`

不该进 store 的:弹窗开合、当前选中项、表单草稿、滚动位置、骨架屏开关。

**表单用草稿模式**:面板内改本地 `reactive` 的 `draft`,点「确定」才写回 store。
用户中途关掉不应污染正在显示的结果。

---

## 6. 注释约定

- **注释解释「为什么」,不复述「是什么」**。`// 设置加载状态为真` 这种删掉。
- 中文注释,全项目统一。
- 每个看起来奇怪的写法必须配一句原因(例:`utils/request.ts` 为何手写 Promise 包 `uni.request`)。
- 规范/兼容性说明不要删,那是给下一个人的路标。
- 被注释掉的旧代码一律删除,git 记得住。

---

## 7. 样式

- 页面/组件 `<style lang="less" scoped>`,**必须 scoped**。
- **只用 Less**,不要引入 Sass/scss(与 TDesign 一致;`src/uni.scss` 是 preset 自带,保留但别往里加东西)。
- 颜色/圆角等一律用 TDesign CSS 变量 `var(--td-*)`,**不要硬编码色值**。
  - 例外:`cover-view` 内因原生层渲染,变量透传未真机验证,可暂用字面值并注明原因。
- 尺寸用 `rpx`,不用 `px`。
- 页面私有样式留在页面;跨页面复用的才进 `src/styles/common.less`。

---

## 8. TypeScript

- 禁止 `any`;确实无解时用 `unknown` + 收窄,或加 `// eslint-disable-next-line` 并写明原因。
- 接口返回类型一律来自 `src/types/`,不在页面里就地内联对象类型。
- **查询参数类型用 `type X = {...}` 或 `type X = A & B`,不要用 `interface extends`**
  —— TS 只在类型别名上推导隐式索引签名,用 `interface` 传给 `request()` 会报错。
- 导入类型用 `import type { X } from '...'`,与值导入分开。
- `@/` 指向 `src/`,路径别名已配好。

---

## 9. 小程序 / uni-app 专属坑(改到相关代码时务必检查)

| 场景                           | 硬性要求                                                    |
| ------------------------------ | ----------------------------------------------------------- |
| `<map>` 覆盖层                 | 必须 `cover-view`/`cover-image`;其内**不能放 TDesign 组件** |
| `marker.id`                    | 必须 **number**,用数组下标 + 反查表                         |
| `iconPath`                     | 必须 **PNG**,本地 `/static` 路径                            |
| 富文本                         | 用 `<rich-text :nodes>`,**没有 `v-html`**                   |
| 时间                           | 接口传 ISO 8601 带时区,格式化在前端做                       |
| 坐标                           | GCJ-02,不用高德(坐标系混淆)                                 |
| `pages.json` / `manifest.json` | 带 `//` 注释,**已被 .prettierignore 排除**,不要格式化       |

---

## 10. 改 mock / API 时必须同步三处

新增或修改任何接口,**这三处必须同时改**,不一致是这类分层项目最常见的事故:

1. `src/types/*.d.ts` — 类型契约
2. `docs/API.md` — 人类可读的接口契约(后端照着实现)
3. `src/mock/index.ts` — 路由表 + 数据

漏 2 的后果:后端按自己想象实现,联调对不上。
漏 3 的后果:页面空白,然后怀疑是渲染问题。

mock 必须保持 HTTP 语义:方法+路径匹配、`delay()` 模拟延迟、返回 `{code,message,data}` 壳、
未实现的路径 `console.warn` 并返回 `code: 404`。字段投影用**显式列举**,不要解构丢弃。

---

## 11. 提交前自检

```bash
pnpm run type-check   # 必须 0 错误
pnpm run lint         # 必须无输出
```

`pre-commit` 钩子会跑 lint-staged(eslint --fix + prettier),但**不跑 type-check**,
所以类型检查要自己过。commit message 遵循 Conventional Commits,标题 ≤72 字符。
