# 开发规范

本项目的**唯一编码规范出处**。适用范围:`src/` 下所有 `.vue` 与 `.ts`,以及 `scripts/`。

规范分三类,标注在每节标题:

- **【强制】** 违反则不予合并
- **【建议】** 默认遵守,有更好理由可偏离并在 PR 里说明
- **【参考】** 背景知识

机器可强制的条目已落进 `eslint.config.mjs` / `.prettierrc.json` / `.husky/`,
文末有「哪些条目由谁强制」对照表。同时本文件被导出为项目 skill
`.claude/skills/vue-sfc-spec/SKILL.md`,供 AI 辅助开发时自动加载。

---

## 1. SFC 文件结构【强制】

### 1.1 块顺序:`script` → `template` → `style`

```vue
<script setup lang="ts">
/* 逻辑 */
</script>

<template>
  <!-- 结构 -->
</template>

<style lang="less" scoped>
/* 样式 */
</style>
```

这与 Vue 官方推荐的 `script setup` 默认顺序一致,但与很多旧模板的
`template` 开头相反 —— 本项目**统一要求 script 在前**。

理由:读一个组件时,先要知道「它做什么、依赖什么」,再看它长什么样。
`template` 开头会把 import 和状态推到屏幕下方。

由 `vue/block-order` 强制,**可 autofix**:`pnpm run lint:fix`。

### 1.2 `<script setup>` 内部分区顺序

核心原则只有一条 —— **声明先于使用**:每一段只引用它**上方**已声明的符号,永不反向引用。
自上而下读一遍,就是组件从接口到实现、从数据到行为、从声明到执行的完整数据流。

自上而下分十段(有则写,无则跳过,不得回插):

```
0. import              —— 分组:框架(vue/@dcloudio/pinia)→ 第三方 → @/ 别名 → 相对路径;组间空行
1. 类型 & 模块级常量    —— 无响应式的纯定义;仅本组件用的 interface/type 就近放这里,跨组件复用的进 @/types
2. Props & Emits       —— 组件接口
3. 外部状态接入        —— store 实例、storeToRefs 解构、组合式函数
4. refs / reactive     —— 原始状态
5. computed            —— 派生状态
6. 函数与方法          —— 业务逻辑(放在 watch 之前,见下文)
7. watch / watchEffect —— 副作用
8. 生命周期钩子
9. defineExpose        —— 可选,仅当父组件要拿本组件的方法;永远放最末尾
```

记忆口诀:**导入 → 定义 → 接口 → 外部状态 → 内部状态 → 派生 → 方法 → 监听 → 生命周期 → 暴露**。
"从外到内、从数据到行为、从声明到使用" —— 每层只依赖它上面的层。

完整示例(这是本项目所有 `.vue` 的标准骨架;第 9 段 `defineExpose` 见后文说明,页面与多数组件没有):

> 示例里的 `// ── N. xxx ──` 分区注释**是可选的**,本项目不要求每个文件都加 ——
> 十段都写一遍只会制造噪音,且很快与代码脱节。
> **顺序本身是强制的**,注释按需:只有在某个文件分区多、容易读串时才加。

```vue
<script setup lang="ts">
// ── 0. import ────────────────────────────────────────────
import { computed, ref, watch } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'

import { memberApi } from '@/api/member'
import { useMemberFilterStore } from '@/stores/memberFilter'
import TsaMemberCard from '@/components/TsaMemberCard/TsaMemberCard.vue'
import type { MemberListItem } from '@/types/member'

// ── 1. 类型 & 模块级常量 ─────────────────────────────────
// 提到模块作用域:每次组件实例化都重建的数组是白费的开销
const PAGE_SIZE = 20

// ── 2. Props & Emits ─────────────────────────────────────
const props = defineProps<{ presetCity?: string }>()
const emit = defineEmits<{ (e: 'picked', m: MemberListItem): void }>()

// ── 3. 外部状态接入 ──────────────────────────────────────
const store = useMemberFilterStore()
const { keyword } = storeToRefs(store)

// ── 4. 原始状态 ──────────────────────────────────────────
const list = ref<MemberListItem[]>([])
const page = ref(1)
const loading = ref(false)
const finished = ref(false)

// ── 5. 派生状态 ──────────────────────────────────────────
const isEmpty = computed(() => !loading.value && list.value.length === 0)

// ── 6. 业务逻辑 ──────────────────────────────────────────
const fetchPage = async (reset = false) => {
  /* ... */
}

const goDetail = (m: MemberListItem) => {
  emit('picked', m)
}

// ── 7. 副作用 ────────────────────────────────────────────
watch(
  () => props.presetCity,
  (city) => {
    if (city) fetchPage(true)
  },
)

// ── 8. 生命周期:放在最末尾 ──────────────────────────────
onShow(() => fetchPage(true))
onReachBottom(() => !finished.value && fetchPage())
</script>
```

#### 为什么方法要排在 watch 之前(且必须用箭头函数)

watch 的回调(尤其带 `{ immediate: true }` 的)、生命周期钩子,都是方法的**调用方**。
方法统一写成 `const name = (...) => { ... }` 箭头函数 —— `const` 无提升,如果方法在 watch 下面就会出现 TDZ 错误。
把方法放在 watch 上方,引用永远朝上,全文件一遍读到底,TDZ 问题自动消失。

#### 为什么生命周期与 defineExpose 必须在最后

生命周期钩子是这个组件的**执行入口**,`defineExpose` 是这个组件的**出口能力**。
写在中间时,读代码的人要上下翻动才能拼出"什么时候发生了什么";放在末尾,自上而下读一遍就是完整的执行流。

这也是本项目最常见的违规点 —— 习惯上会顺手把 `onShow(load)` 写在几个函数中间。

#### 第 9 段:defineExpose(按需)

`<script setup>` 编译出的组件默认是**封闭的**:父组件拿不到它的任何内部方法。
只有当父组件确实需要通过 template ref 调用子组件方法(如筛选面板的 `reset()`)时才显式暴露,且永远放最末尾:

```ts
defineExpose({ reset })
```

**没用就不写** —— 本项目现有组件全部走 props/emit 通信,零个用到它。
不要为了"看起来规范"而暴露一堆方法,那是把封装性白送出去。

#### ⚠️ 移动语句时注意 TDZ

`const` / `let` 声明无提升。按本节顺序写时,所有引用天然朝上,本来不会踩 TDZ;
会踩到的都是**插错了位置**的语句:

- ⚠️ `watch` 的 getter 与第二个参数是**立即求值/注册**的,`{ immediate: true }` 还会立即执行回调 —— 它们引用的变量必须在 `watch` 之前
- ❌ 把 `const x = ref(0)` 移到使用它的 `computed` 之后 → 运行时 `Cannot access 'x' before initialization`

移动完成后必须跑 `pnpm run type-check`,它会抓出大部分此类问题。

---

## 2. 命名规范【强制】

| 对象         | 规则                                         | 正例                              | 反例                          |
| ------------ | -------------------------------------------- | --------------------------------- | ----------------------------- |
| 页面文件     | `src/pages/<模块>/<index\|list\|detail>.vue` | `pages/member/list.vue`           | `pages/member/MemberList.vue` |
| 业务组件     | 目录与文件同名,`Tsa` 前缀,PascalCase         | `TsaMemberCard/TsaMemberCard.vue` | `memberCard.vue`              |
| API 模块     | `src/api/<域>.ts`,导出 `<域>Api`             | `memberApi`                       | `getMemberList` 裸函数集合    |
| Store        | `src/stores/<名>.ts`,导出 `use<名>Store`     | `useMemberFilterStore`            | `memberFilter`                |
| 类型文件     | `src/types/<域>.d.ts`                        | `member.d.ts`                     | `types.ts` 一个巨型文件       |
| 接口         | PascalCase,**不加 `I` 前缀**                 | `MemberDetail`                    | `IMemberDetail`               |
| 类型别名     | 不透明地用 `T` 前缀                          | `Gender`                          | `TGender`                     |
| ref 变量     | 名词                                         | `list`,`memberTotal`              | `data`, `res`                 |
| 布尔 ref     | `is`/`has`/`can`/`show` 前缀                 | `isLoading`, `showFilter`         | `flag`, `status2`             |
| 函数         | 动词开头                                     | `fetchPage`, `goDetail`           | `page`, `detail`              |
| 事件处理     | `on<Event>`                                  | `onMarkerTap`, `onLogin`          | `markerTapHandler`            |
| 事件名(emit) | 过去式或名词                                 | `'picked'`, `'confirm'`           | `'doPicked'`                  |
| CSS 类       | BEM,块名 = 组件/页面名                       | `.member-card__title`, `.is-on`   | `.title`, `.red`              |

**禁止**:单字母变量(循环 `i` 除外)、`data1`/`data2`/`temp`/`obj` 这类无语义名。

---

## 3. 目录分层与依赖方向【强制】

```
pages/  ──→ components/ stores/ api/ utils/ types/ constants/
api/    ──→ utils/request.ts, types/
stores/ ──→ api/, types/, constants/
utils/  ──→ types/, constants/          (不许引用业务页面)
mock/   ──→ types/                       (只被 request.ts 动态引入)
types/  ──→ (不 import 任何运行时模块)
```

**依赖方向永远单向。** 出现反向引用(如 `utils/request.ts` import 了某个页面)即设计错误。

### 各层允许与禁止

| 层                 | 允许                                            | **禁止**                                                         |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| `pages/`           | 取数、渲染、跳转、页面私有状态                  | ❌ 直接 `uni.request`;写可复用业务规则;把页面私有状态塞进 store  |
| `components/`      | 纯展示 + 事件上抛;包装 TDesign                  | ❌ `import xxxApi`(数据只能由 props 进);❌ 引用 store 改业务状态 |
| `api/`             | 声明接口与类型                                  | ❌ `if/else` 业务判断;❌ 拼 `/api/v1` 前缀(由 baseURL 提供)      |
| `utils/request.ts` | 网络、token 注入、统一拆壳、错误提示、mock 分流 | ❌ 出现任何业务字段名                                            |
| `mock/`            | 模拟真实 HTTP 语义                              | ❌ 被 `pages/` 直接 import                                       |
| `stores/`          | 跨页面共享状态                                  | ❌ 当全局变量垃圾桶                                              |
| `types/`           | 契约的单一事实来源                              | ❌ 放运行时代码(所以是 `.d.ts`)                                  |
| `constants/`       | 字典、枚举                                      | ❌ 只被一个页面用的常量(留在页面里)                              |

### 组件设计

- **TDesign 组件优先**:凡是 `@tdesign/uniapp` 已有的基础控件(表单类 form/form-item/input/radio/checkbox/textarea/picker,展示类 button/tag/popup/avatar/loading 等),一律直接用 `t-*` 组件,**禁止手绘 `view`+CSS 做等价物**。手绘件没有设计 token、没有暗色适配、没有无障碍语义,还得自己维护受控状态与交互细节(协议弹窗与资料页都曾因此返工)。只有组件确实覆盖不了的场景(如 `cover-view` 原生层不能放 TDesign 组件)才允许手绘,且必须注释写明原因。
- **有业务含义的 UI 必须包成 `Tsa*` 组件**(`t-button`/`t-tag` 这类原子控件不必包 —— 包了是噪音)。
- 组件**不直接发请求**:数据从 props 进,交互用 emit 出。这让组件可复用、可静态预览。
- 组件不要直接写 store。需要改共享状态时 emit 出去,由页面写 store。
  - 例外:筛选面板这类"本身就是为写 store 而生"的组件可直接用 store,需在注释里说明原因。

### 为什么要包一层 TDesign

`@tdesign/uniapp` 是 **0.10.x,未发 1.0**(7 个月发 13 版),破坏性变更概率不低。
业务 UI 经 `components/Tsa*` 包一层后,升级只改包装层,不必在十几个页面里全文搜索替换。

---

## 4. TypeScript 规范【强制】

```ts
// ✅ 类型导入与值导入分开,类型用 import type
import { computed } from 'vue'
import type { MemberListItem } from '@/types/member'

// ❌ 混在一起(会被 tree-shake 分析困扰,也看不出哪些是类型)
import { computed, MemberListItem } from '...'
```

- **禁止 `any`**。确实无解时用 `unknown` + 收窄;需要绕过 ESLint 时写
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 并在下一行说明原因。
- **查询/参数类型必须用 `type` 别名,不能用 `interface extends`**:

  ```ts
  // ✅ TS 只在类型别名上推导隐式索引签名
  export type MemberQuery = PageQuery & { city?: string }

  // ❌ 传给 request() 的 data: Record<string, unknown> 会报
  //    "Index signature for type 'string' is missing"
  export interface MemberQuery extends PageQuery {
    city?: string
  }
  ```

- 接口返回类型一律引自 `src/types/`,不在页面里就地内联对象字面量类型。
- **仅组件内部使用的辅助类型**(如某个菜单项、某段草稿的形状)就近定义在 script 第 1 段
  (§1.2);一旦出现第二个使用者,立刻搬进 `src/types/`。
- 路径别名 `@/` 指向 `src/`,禁止 `../../utils/xxx` 式相对深跳。
- 可为空的接口字段用 `?`,不要 `| undefined` 与 `?` 混用。
- 枚举语义优先用**字符串字面量联合**,不用 TS `enum`(小程序产物体积与可读性):

  ```ts
  export type EventStatus = 'upcoming' | 'ongoing' | 'past' | 'cancelled'
  ```

---

## 5. 状态管理:什么进 Pinia【强制】

只有一个判据:

> **这份状态是否被两个及以上页面读取,且必须保持一致?**

是 → 进 store;否 → 留在组件 `ref`。

**不该进 store 的**:弹窗开合、当前选中的某一项、表单草稿、滚动位置、骨架屏开关、
列表数据本身。

### 表单用草稿模式(draft pattern)

```ts
// 面板内改本地 reactive,点「确定」才写回 store
const draft = reactive({ city: store.city /* ... */ })
const onConfirm = () => {
  store.city = draft.city
  emit('confirm')
}
```

理由:用户划拉一半直接关掉,不应污染页面上正在显示的结果。
**只有确认后的结果才进 store。**

### store 写法

统一用 **setup store**(组合式),不用 options 写法:

```ts
export const useMemberFilterStore = defineStore('memberFilter', () => {
  const city = ref('')
  const label = computed(() => city.value.replace('市', ''))
  const reset = () => {
    city.value = ''
  }
  return { city, label, reset }
})
```

组件里解构 store 要用 `storeToRefs` 才能保持响应性:

```ts
const { city } = storeToRefs(store) // ✅
const { city } = store // ❌ 丢失响应性
```

---

## 6. API 层与 mock 规范【强制】

### 6.1 调用链

```
页面  →  api/xxx.ts 的方法  →  utils/request.ts  →  mock / 真后端
```

页面**永远不碰** `code` / `message`,`request()` 已经拆壳并统一 toast,页面直接 `await` 拿 `data`。

```ts
// ✅
const points = await memberApi.getMapData()

// ❌ 绕过 api 层与统一壳
const res = await uni.request({ url: '...' })
if (res.data.code === 0) use(res.data.data)
```

### 6.2 为什么 request.ts 手写 Promise 包 `uni.request`

`@dcloudio/types` 里同时存在两套 promisify 约定
(`PromisifySuccessResult` 返回结果 / `PromisifySuccessResultLegacy` 返回 `[err, res]`),
走哪套取决于版本与平台配置。**显式传 `success`/`fail` 回调**能把返回值形状锁在自己手里。
这段代码旁边的注释不要删。

### 6.3 新增接口必须同步三处

| 位置                | 内容                       |
| ------------------- | -------------------------- |
| `src/types/*.d.ts`  | 类型契约                   |
| `docs/API.md`       | 人类可读契约(后端照着实现) |
| `src/mock/index.ts` | 路由表 + 数据              |

**漏掉第二项**是本项目最容易出的事故:后端按自己想象实现,联调时两边对不上。

### 6.4 mock 必须保持 HTTP 语义

不是"直接返回一个对象",而是:

- 路由 key 用 `"METHOD /path"` 形式,与后端 RESTful 路径一一对应
- 走 `delay()` 模拟网络延迟(200~500ms)—— 否则 loading 态永远不会被看到
- 一律返回 `{ code, message, data }` 壳
- 未实现的路径 `console.warn('[mock] 未定义的接口: ...')` 并返回 `code: 404`
  (静默返回 `undefined` 会让人查半天"数据怎么是空的")
- 字段投影**显式列举**每个字段,不要 `const { pwd, ...rest } = m` 式丢弃
  —— 后者在契约变化时会悄悄多传/漏传

### 6.5 mock 数据生成

`scripts/gen-mock.mjs`,用 `SEED` 固定种子。

- **不要用 `Math.random()`**:每次生成结果不同会让 bug 无法复现。
- 改了 `QUOTA` 权重后必须看脚本末尾的自检输出(总数不符会 `exitCode = 1`)。
- 数据不真实(人名、公司、行业)会让演示失去说服力 —— 潮汕乡会的分布特征、
  澄海玩具/潮阳内衣这类本地产业信息都刻意做进了生成规则,改动前请先读那段注释。

---

## 7. 样式规范【强制】

```vue
<style lang="less" scoped></style>
```

- **必须 `scoped`**(全局壳 `App.vue` 除外)。
- **只用 Less**,不引入 Sass。`src/uni.scss` 是 preset 自带,保留但**不要往里加东西**
  —— 两套预处理器并存会让学生困惑。
- 尺寸一律 `rpx`(小程序响应式单位),不用 `px`。
- 颜色/圆角/边框一律走 TDesign CSS 变量 `var(--td-*)`,**禁止硬编码色值**。
  - **唯一例外**:`cover-view` 由原生层渲染,CSS 变量是否透传**未在本项目真机验证**,
    必要时可写字面值,但必须在旁边注明原因。
- 主题色改动只在 `src/styles/tdesign-override.less` 一处。
- 页面私有样式留在页面;跨页面复用的才进 `src/styles/common.less`,
  且该类工具类**总数超过 20 条时应当抽象成组件**。

---

## 8. 注释规范【强制】

- **中文**,全项目统一。
- 解释**为什么**,不复述**是什么**。

  ```ts
  // ❌ 设置加载状态为真
  loading.value = true

  // ✅ 并发保护:上一次的请求还没回就再次触发会互相覆盖结果
  if (loading.value) return
  ```

- **每个"看起来很多余"的写法必须配原因注释**。本项目里有好几处这样的代码
  (手写 Promise 包 uni.request、查询类型用 type 不用 interface、
  mock 用固定种子…),那些注释是路标,删掉的下一个人会以为是写得烂并"顺手优化"掉。
- 公共函数/API 方法用 JSDoc 说明用途与特殊约束:

  ```ts
  /** 地图专用轻量结构 —— 后端实现此接口时只 SELECT 这些列,详见 docs/API.md */
  ```

- 被注释掉的旧代码一律删除,git 记得住。
- `TODO` 必须写成 `TODO(负责人或阶段): 具体要做什么`,不写无主的 TODO。

---

## 9. 错误处理与用户反馈【强制】

- **网络与业务错误统一在 `utils/request.ts` 处理**,页面不写 `try-catch` 兜网络。
- 任何接口失败都必须有**可见**的用户反馈(toast),不允许静默失败。
- 空列表必须有空态(`t-empty`),且文案要说明**下一步做什么**:

  ```
  ❌ "暂无数据"
  ✅ "没有符合条件的乡贤,换个筛选条件试试"
  ```

- 加载态:首屏用 `t-loading` 或骨架;静默刷新传 `showLoading: false` 避免闪屏。
- 破坏性操作(退出、取消报名)必须二次确认。
- **前端隐藏 ≠ 数据没下发**。涉及隐私(联系方式)的过滤必须在后端做,
  前端的 `v-if` 拦不住抓包 —— 见 `docs/API.md` 隐私一节。

---

## 10. 小程序 / uni-app 专属约束【强制】

| 场景                         | 硬性要求                                                                   |
| ---------------------------- | -------------------------------------------------------------------------- |
| `<map>` 等原生组件覆盖层     | 必须 `cover-view`/`cover-image`;其内**不能放 TDesign 组件**;`z-index` 无效 |
| `marker.id`                  | 必须是 **number**,用数组下标 + 反查表                                      |
| `iconPath`                   | 必须 **PNG**(不支持 SVG),用本地 `/static` 路径                             |
| 富文本                       | `<rich-text :nodes>`,**小程序没有 `v-html`**                               |
| 时间                         | 接口传 ISO 8601 **带时区**;格式化在前端;不要让后端返回中文日期             |
| 坐标                         | GCJ-02;**不用高德**(坐标系混淆会整体偏移数百米)                            |
| 图片                         | 不引用外链(域名白名单),mock 阶段用空串 + Avatar 首字母兜底                 |
| 用户定位                     | 需要时才申请;能用数据解决就不要引入 `scope.userLocation` 授权链            |
| 生命周期                     | 用 `@dcloudio/uni-app` 的 `onLoad/onShow`,不要用 `onMounted` 接页面参数    |
| 长列表                       | 用 `onReachBottom` 分页;不要把几千条一次性塞进 `data`                      |
| `pages.json`/`manifest.json` | 带 `//` 注释,**已在 `.prettierignore` 排除**,不要格式化                    |

---

## 11. 性能【建议】

小程序的约束比 Web 更紧:主包 2MB、`setData` 有跨线程成本。

- 列表接口分页,别把全量下发到前端过滤。**成员上千时地图接口也必须做视野裁剪。**
- 计算属性优先于方法调用(避免每次渲染重算)。
- `v-for` 必须带稳定的 `:key`,不要用数组下标当 key(列表会重排时)。
- 模块级常量提到 `setup` 外(见 §1.2 第 1 段),不要在每次组件创建时重建大数组。
- 图片懒加载;图标用雪碧图或字体图标之前先想清楚是否真的需要那么多图标。
- 生产包体积要盯:`du -sh dist/build/mp-weixin`。mock 数据靠
  `VITE_USE_MOCK=false` 被 tree-shake,新增 mock 时**必须用动态 import**,
  否则会把数据打进生产包。

---

## 12. Git 工作流【强制】

### 分支

```
main        ← 始终可运行
  feat/xxx  ← 从 main 切,PR 回 main
  fix/xxx
```

**不在 main 上直接提交。** 改完提 PR,至少一人评审后合并。

### Commit message

由 commitlint 强制,格式不对提交不进去。

```
<type>: <subject>
```

type:`feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `revert`

- 中文 subject 允许(团队配置已放开 `subject-case`)。
- **标题 ≤ 72 字符**,超了会被拒。
- 标题说「改了什么」,正文说「为什么」。
- 禁止「修改」「更新」「fix bug」这类无信息量标题。
- 一次提交只做一件事。

### 提交时自动跑什么

| 钩子         | 动作                                               |
| ------------ | -------------------------------------------------- |
| `pre-commit` | 对暂存区文件跑 `eslint --fix` + `prettier --write` |
| `commit-msg` | commitlint 校验                                    |

**pre-commit 刻意不跑 `type-check`** —— vue-tsc 十几秒,放这里学生会很快开始用
`--no-verify`,那比不检查更糟。所以提交前请自己跑:

```bash
pnpm run type-check && pnpm run lint
```

### 换行符

根目录 `.gitattributes` 已把仓库内统一为 LF。若仍出现满屏假 diff,
参见 `docs/TECHNOLOGY.md` 的环境一节。

---

## 13. Code Review 清单【建议】

评审时按这个顺序看,能抓到绝大多数问题:

1. **契约是否三处同步**(types / API.md / mock 路由表)—— 最高优先级
2. 依赖方向有没有越界(页面直接 `uni.request`?组件 import 了 api?)
3. 有没有把页面私有状态塞进 store
4. 分区顺序:方法是否仍是箭头函数、是否在 watch 之前、生命周期/`defineExpose` 是否仍在 script 末尾
5. 有没有硬编码色值 / `px` / 缺 `scoped`
6. 那些"看起来多余"的代码,注释还在不在
7. `any` 有没有增加
8. 空态、加载态、错误态是否都有
9. 改了 mock 数据的话,`gen-mock.mjs` 自检是否仍然通过

---

## 14. 禁止事项一览【强制】

| 不要                                                  | 因为                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| 用 `function name()` 声明函数                         | 统一用 `const name = () => {}` 箭头函数:`const` 无提升,方法放 watch 上方才能避免 TDZ |
| 用 npm/yarn                                           | 项目由 pnpm 管,`preinstall` 会拦;两份 lockfile 会装出两棵依赖树 |
| 手动改 `@dcloudio/*`、`vite`、`vue`、`pinia` 的版本号 | 版本被交叉约束锁死,见 `docs/TECHNOLOGY.md` 版本表               |
| 在页面里 `uni.request`                                | 绕过统一拆壳、token 注入、mock 分流                             |
| TDesign 已有 `t-*` 控件还手绘 view+CSS 做等价物       | 丢设计 token/暗色适配/无障碍语义,状态与交互还得自己维护          |
| 组件里 import api 发请求                              | 组件不可复用、难测试                                            |
| `any` 满天飞                                          | 类型是这个项目分层设计的地基                                    |
| 页面私有状态进 store                                  | store 会变成全局变量垃圾桶                                      |
| 生命周期写在函数中间                                  | 破坏自上而下的执行流可读性                                      |
| `watch` 写在它所调用方法的上方                        | 方法统一用箭头函数(`const`),无提升;`immediate: true` 会直接 TDZ |
| 没有 template ref 需求却 `defineExpose` 一堆方法      | 组件默认封闭是特性,白白送掉封装性                               |
| 删掉"解释为什么"的注释                                | 下一个人会以为是写得烂并改掉它                                  |
| 把 `pages.json` 交给 Prettier 格式化                  | 注释会被吃掉                                                    |
| 在 `cover-view` 里放 TDesign 组件                     | 原生层不渲染                                                    |
| 用 `Math.random()` 生成 mock                          | bug 无法复现                                                    |
| 提交时 `--no-verify` 绕过钩子                         | 规范形同虚设                                                    |
| 留 `// TODO` 不带归属和动作                           | 永远不会有人做                                                  |

---

## 15. 规范的强制方式

| 条目                                           | 由谁强制                                  |
| ---------------------------------------------- | ----------------------------------------- |
| 块顺序 script→template→style                   | ESLint `vue/block-order`(+ autofix)       |
| defineProps/defineEmits 在最前                 | ESLint `vue/define-macros-order`          |
| 未用变量、真 bug 类规则                        | ESLint `typescript-eslint` recommended    |
| 缩进、引号、分号、换行                         | Prettier                                  |
| commit message 格式                            | commitlint + husky                        |
| **script 内部分区顺序(含"方法先于 watch")**    | ⚠️ **无自动检查,靠 code review 与 skill** |
| 分层依赖方向、禁组件发请求、注释质量、样式规范 | ⚠️ **无自动检查,靠 code review 与 skill** |

最后两行是本规范的软肋 —— 目前靠人工评审 + AI skill 兜底。
后续可考虑用 ESLint 自定义规则或 `import/no-restricted-paths` 把分层边界做成硬约束。
