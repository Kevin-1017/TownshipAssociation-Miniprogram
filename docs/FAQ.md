# FAQ 与踩坑记录

**这份文档是累积资产。** 每次有人卡住并解决,请把结论补到对应小节,
而不是只在群里说一声。下面的每一条都是实际撞上的,不是设想出来的。

---

## 依赖解析

### Q:为什么顶层 `vue` 要精确锁 `3.4.21`,而不是 preset 的 `^3.4.21`?

**这是本项目最值得警惕的一个坑,而且它安静了很久。**

1. `@dcloudio/uni-app` 硬依赖 `@vue/shared@3.4.21`(**精确值**);
2. preset 把顶层 `vue` 写成 `^3.4.21` —— caret 允许解析到 3.5.42;
3. 两者可以同时存在,于是 **`vue` 和 `@vue/shared` 可能被装成不同版本**,
   表现为各种难以定位的运行时行为异常。

之前在 npm 下一直没事,是因为 `package-lock.json` 恰好锁在 3.4.21 ——
**那是运气,不是配置正确**。实测证据:改用 pnpm 重新解析(没有 npm 的 lockfile 可依),
`vue` 立刻解析成 **3.5.42**,而 `@vue/shared` 仍是 3.4.21。

所以现在 `vue` 与 `@vue/runtime-core` 都钉死 `3.4.21`。
**教训:当两个包必须同版本时,写精确值,不要写 caret 让解析器自己决定。**

### Q:pnpm 下 esbuild / vue-demi 的构建脚本被拦了

pnpm 12 默认**拒绝执行任何依赖的 postinstall**,而且是硬报错:

```
ERR_PNPM_IGNORED_BUILDS
  × Ignored build scripts: esbuild@0.20.2, vue-demi@0.14.10, ...
```

已在 `pnpm-workspace.yaml` 的 `allowBuilds` 里逐项放行(不是 `package.json` 的
`allowScripts` —— 那是 npm 专用字段,**pnpm 完全不认**;
也不是 `onlyBuiltDependencies` —— pnpm 12 已改用 `allowBuilds`)。

放行清单与理由:

| 依赖                       | 放行     | 原因                                               |
| -------------------------- | -------- | -------------------------------------------------- |
| `esbuild`                  | ✅ true  | 下载平台原生二进制,不放行 Vite 起不来              |
| `vue-demi`                 | ✅ true  | pinia 依赖它按 Vue 版本切换入口                    |
| `core-js` / `core-js-pure` | ❌ false | 脚本只打印捐赠提示                                 |
| `@tdesign/uniapp`          | ❌ false | 脚本只在检测到 Vue 2 时打印适配警告,本项目是 Vue 3 |

**加新依赖时不要跑 `pnpm approve-builds` 一路回车** —— 那等于把"哪些第三方代码
在我机器上执行了"这个决定权丢掉。请在 yaml 里手动加一行并写清原因。

### Q:pnpm install 报 `minimumReleaseAge` / lockfile entries failed verification

pnpm 12 默认拒绝安装发布未满一定时长的版本(防供应链抢发投毒)。
本项目实际撞上过:`eslint-plugin-vue@10.11.0` 刚发布就被拦。

解法是在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 里
**豁免单个精确版本**,**不要**调低全局 `minimumReleaseAge` ——
那道防线对教学项目是有价值的。

### Q:pinia 该装哪个版本?

**`2.2.4`,精确锁版。** 边界实测如下(看它 peer 里的 vue 要求):

| 版本              | 要求的 vue | 能否用在 uni-app |
| ----------------- | ---------- | ---------------- |
| 2.2.0 ~ **2.2.4** | `^3.3.0`   | ✅               |
| 2.2.5 ~ 2.2.8     | `^3.5.11`  | ❌               |
| 2.3.x / 3.x       | `^3.5.11`  | ❌               |

2.2.5 是分水岭。npm registry 的 `latest` tag 是 4.0.3,**装它会直接崩**。

### Q:为什么 `.npmrc` 里不再有 `legacy-peer-deps=true`?

换 pnpm 时删掉的,这是白捡的安全收益。历史原因值得知道:

1. `pinia@2.2.4` 的 `peerDependencies.vue = "^2.6.14 || ^3.3.0"` —— **本身是满足的**;
2. 但它还带一个 **optional** peer:`@vue/composition-api@^1.4.0`(Vue 2 专用,要求 `vue <2.7`);
3. **npm 11 的解析器会尝试满足 optional peer**,于是报 ERESOLVE:

```
Conflicting peer dependency: vue@3.5.42
  peer vue@">= 2.5 < 2.7" from @vue/composition-api@1.7.2
```

4. 这是误报(运行时走 Vue 3 分支,composition-api 路径不会被加载),
   但 npm 下只能靠 `legacy-peer-deps=true` 绕过 —— **代价是关掉了全部 peer 校验**。

pnpm 正确处理 optional peer(未安装的可选 peer 直接跳过),
所以**本项目的 peer 校验是开着的**,不需要任何绕过。

### Q:`pnpm add -D @dcloudio/vite-plugin-uni` 之后构建挂了

因为 DCloud 在 npm registry 上的 **`latest` dist-tag 指向 2021 年的 alpha**
(`3.0.0-alpha-3000020210521001`)。正确版本只能来自 preset 的精确锁定值
`3.0.0-5020420260813003`。同理 `@dcloudio/uni-app` 的 `latest` 也是 2.0.2-x 系列。

**规则:凡是 `@dcloudio/*` 的包,永远不要手动 `pnpm add`,不要手动改版本号。**

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

用 `Math.random()` 的话,每次 `pnpm run gen:mock` 数据都变,
**bug 就复现不了** —— 上一秒能重现的渲染问题重新生成后就没了。
`gen-mock.mjs` 顶部有 `SEED = 20260906`,想换一批数据改这个数,并且提交。

---

## 待补充

> 后面的同学:踩到新坑,在这上面加一节。格式照旧 ——
> **现象 + 原因 + 解法**,不要只写"改了 XX 就好了"。
