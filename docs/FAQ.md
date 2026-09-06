# FAQ 与踩坑记录

**这份文档是累积资产。** 每次有人卡住并解决,请把结论补到对应小节,
而不是只在群里说一声。下面的每一条都是实际撞上的,不是设想出来的。

---

## 依赖解析

### Q:为什么 `.npmrc` 里有 `legacy-peer-deps=true`?能不能去掉?

**现在不能去。** 完整推导:

1. `@dcloudio/uni-app` 硬依赖 `@vue/shared@3.4.21`(精确值),把整棵 Vue 树钉在 **3.4.21**;
2. `pinia@2.2.4` 声明 `peerDependencies.vue = "^2.6.14 || ^3.3.0"` —— 这一条**是满足的**;
3. 但它还声明了一个 **optional** peer:`@vue/composition-api@^1.4.0`(Vue 2 专用,要求 `vue >=2.5 <2.7`);
4. npm 11 的解析器仍会尝试满足 optional peer,于是报:

```
Conflicting peer dependency: vue@3.5.42
  peer vue@">= 2.5 < 2.7" from @vue/composition-api@1.7.2
```

运行时用的是 Vue 3 分支,`composition-api` 那条路径根本不会被加载 —— 所以这是**误报**,
不是真不兼容。`legacy-peer-deps=true` 是最小代价的解法。

**代价**:peer 严格校验被关掉了。引入新依赖时请自己看一眼它的 `peerDependencies`
(`npm view <包> peerDependencies`),别指望 npm 替你报警。

### Q:pinia 该装哪个版本?

**`2.2.4`,并且是精确锁版。** 边界实测如下(peer 里的 vue 要求):

| 版本              | 要求的 vue | 能否用在 uni-app |
| ----------------- | ---------- | ---------------- |
| 2.2.0 ~ **2.2.4** | `^3.3.0`   | ✅               |
| 2.2.5 ~ 2.2.8     | `^3.5.11`  | ❌               |
| 2.3.x / 3.x       | `^3.5.11`  | ❌               |

2.2.5 是分水岭。npm 的 `latest` tag 是 4.0.3,**装它会直接崩**。

### Q:`npm i -D @dcloudio/vite-plugin-uni` 之后构建挂了

因为 DCloud 的 npm **`latest` dist-tag 指向 2021 年的 alpha**
(`3.0.0-alpha-3000020210521001`)。正确版本只能来自 preset 的精确锁定值
`3.0.0-5020420260813003`。同理 `@dcloudio/uni-app` 的 `latest` 也是 2.0.2-x 系列。

**规则:凡是 `@dcloudio/*` 的包,永远不要手动 `npm i`,不要手动改版本号。**

### Q:npm install 后 esbuild / vue-demi 的脚本被拦了

见 [SETUP.md 第 1 节](SETUP.md)。这两个已写进 `package.json` 的 `allowScripts`。
`core-js` 的脚本被拦无所谓 —— 它只是打印捐赠信息。

### Q:为什么 `.gitignore` 里 `*.local` 匹配不到 `settings.local.json`?

`*.local` 匹配的是**以 `.local` 结尾**的文件名。`settings.local.json` 以 `.json` 结尾,
所以匹配不到,必须单独写一行。这个坑在 `.claude/settings.local.json` 上真踩过。

---

## 类型与编译

### Q:`.vue` 文件全部报 `Parsing error: '>' expected`

ESLint 的 parser 顺序错了。`.vue` 的**顶层** parser 必须是 `vue-eslint-parser`
(它负责把 `<template>` 和 `<script>` 拆开),`typescript-eslint` 只能作为它
`parserOptions.parser` 里的子 parser。

而且配置数组里 `...tseslint.configs.recommended` 必须放在
`...pluginVue.configs['flat/essential']` **之前**,否则前者会抢走后者的顶层 parser。

### Q:`import xxx from './members.json'` 报 Cannot find module

`tsconfig.json` 需要 `"resolveJsonModule": true`。preset 默认没开(它不带 JSON import 场景)。

### Q:传查询参数给 `request()` 报 "Index signature for type 'string' is missing"

因为 **TS 只在「类型别名」上推导隐式索引签名,不在 `interface` 上**。
所以 `PageQuery` / `MemberQuery` / `EventQuery` 都写成 `type X = {...}`,
带继承的用 `type MemberQuery = PageQuery & {...}`。新增查询类型请沿用这个写法。

### Q:`eslint.config.mjs` 里的 ignores 写了 `*.d.ts` 却没生效

`*.d.ts` 只匹配**项目根目录那一层**。要写 `'**/*.d.ts'`。

---

## 地图

### Q:`markertap` 事件的 `markerId` 是 undefined

`marker.id` 必须是 **number**。成员 id 是字符串(`m0001`),不能直接当 markerId。
本项目的做法:`id` 用数组下标,另存一张 `Map<number, Member>` 反查
(见 `src/pages/map/index.vue` 的 `byIndex`)。

### Q:点聚合气泡被点击时,弹出了一个错误的成员卡片

聚合点没有对应的成员。识别方法:被点的 `markerId` 在反查表里 `get()` 不到
(返回 `undefined`)—— 此时**不要弹卡片**,地图自己会展开聚合点。代码里已经是这个判断。

### Q:浮在地图上的按钮不显示 / 被地图盖住

`<map>` 是**原生组件**,层级高于普通 `view`,`z-index` 无效。
覆盖在地图上的 UI 必须用 `cover-view` / `cover-image`。

限制要知道:

- `cover-view` 里**不能放 TDesign 组件**(只支持基础标签);
- `cover-view` 不支持 `gap` 等部分 CSS,要逐个写 `margin`/`padding`。

所以本项目分两种处理:成员卡片用 `cover-view`(必须浮在地图上),
筛选面板用 `t-popup`(打开时本来就该盖住地图)。

### Q:坐标偏移几百米

微信地图底图是 **GCJ-02**。若数据来自手机 GPS 原始坐标(WGS-84)会偏移。
用腾讯/高德地图拾取器(`lbs.qq.com/getPoint`)取到的坐标就是 GCJ-02,直接用。
**不要用高德的 key 和 SDK** —— 坐标系混淆是新手最常踩的坑。

### Q:为什么第一阶段不用申请地图 key?

因为打点、标记、气泡、点聚合是 `<map>` 组件自带能力,**免费无需 key**。
需要 key 的是:逆地理编码(坐标→地址)、地点搜索、路线规划。
这些要等后端代理,因为 key 不能暴露在小程序端。

### Q:为什么不开 `show-location`?

**第一阶段刻意不开。** 图上渲染的是「成员的坐标」而不是「用户的位置」,
所以不需要定位权限。一旦打开就会触发 `scope.userLocation` 授权,
连带需要 AppID 隐私协议配置和 `manifest.json` 里的 `requiredPrivateInfos` 声明 ——
一整条合规链路。避开它,第一阶段才能不依赖任何外部审批就跑起来。

---

## 工程化

### Q:pre-commit 为什么不在提交前跑 `type-check`?

故意的。`vue-tsc` 全量检查要十几秒,放在 pre-commit 里,
学生很快就会养成 `git commit --no-verify` 的习惯 —— 那比不检查更糟。
现在的分工是:pre-commit 只跑快的美化与 lint,`type-check` 你自己提交前跑或放 CI。

### Q:pages.json / manifest.json 被 Prettier 改坏(注释没了/报错)

这两个文件带 `//` 注释,DCloud 用宽松解析器读,但 **Prettier 的 JSON 解析器不支持注释**。
已在 `.prettierignore` 里排除。给它们加注释是允许的,但别指望格式化工具管它们。

### Q:Windows 同学提交后,macOS 同学拉下来满屏 diff

换行符问题。仓库根有 `.gitattributes`(`*.ts text eol=lf` 等),
仓库内统一存 LF。如果仍有问题,让 Windows 同学执行一次:

```bash
git rm --cached -r . && git reset --soft HEAD
```

然后重新 add 提交,让规则把已入库的文件归一化。**这条命令会清掉暂存区,
执行前先确认没有未提交的重要改动。**

### Q:为什么 mock 数据是固定种子的伪随机?

用 `Math.random()` 的话,每次 `npm run gen:mock` 数据都变,
**bug 就复现不了** —— 上一秒能重现的渲染问题重新生成后就没了。
`gen-mock.mjs` 顶部有 `SEED = 20260906`,想换一批数据改这个数,并且提交。

---

## 待补充

> 后面的同学:踩到新坑,在这上面加一节。格式照旧 ——
> **现象 + 原因 + 解法**,不要只写"改了 XX 就好了"。
