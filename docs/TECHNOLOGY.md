# 项目技术文档

潮阳潮南校友会小程序(`tsa-miniprogram`)的技术事实:选型与理由、版本约束、环境、
架构现状、地图方案、领域模型、平台限制。

**编码规范不在这里** —— 见 [DEVELOPMENT.md](DEVELOPMENT.md);
**接口契约** —— 见 [API.md](API.md)。

---

## 1. 项目定位

乡会官方平台的第一个前端。三个约束决定了下面所有技术选择:

1. **技术亮点是地图** —— 可视化乡贤地理分布,这是区别于普通 CRUD 项目的部分;
2. **它是教学载体** —— 建成后交给学生维护,架构清晰度与文档质量优先于开发效率;
3. **后期有独立的 React 官网** —— 后端从第一天就是独立仓库 `tsa-api`,
   小程序与官网共用同一套接口。

### 仓库结构

```
TownshipAssociation/
├── tsa-miniprogram/   本仓库,uni-app 小程序(独立 git 仓库)
└── tsa-api/           Spring Boot 后端(独立 git 仓库,尚未动工)
```

刻意用两个独立仓库而非 monorepo:学生分组维护时互不干扰,
也避免 pnpm workspace 的学习成本。**父目录不设 git 仓库。**

---

## 2. 技术选型与理由


| 层         | 选型                                   | 理由                                                                                                                                                | 代价                                          |
| ---------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 跨端框架   | **uni-app,CLI 模式**                   | Vue 3 语法是国内前端岗第一需求,技能可迁移;保留将来编译 H5 的后路。CLI 模式便于 VSCode + Git + CI,比 HBuilderX 更适合多人协作                        | 多一层编译抽象;地图等新组件能力滞后于微信原生 |
| 包管理器   | **pnpm 12**                            | 严格隔离依赖树,幽灵依赖写不出来;peer 校验可保持开启;构建脚本默认拒绝执行(供应链安全)                                                                | 需 corepack;配置项位置与 npm 不通             |
| UI 库      | **`@tdesign/uniapp`**                  | 腾讯一方,与微信设计语言同源;中文文档质量高;关键优势是**同一套设计体系覆盖小程序 + uni-app + React + Vue**,将来官网用 `tdesign-react` 可保持视觉一致 | **pre-1.0(0.10.x)**,可能破坏性变更            |
| 状态       | **Pinia**                              | Vue 3 官方推荐,TS 推导好                                                                                                                            | 版本受 uni-app 的 Vue 钉死(见 §3)            |
| HTTP       | **自写 `uni.request` 封装,不用 axios** | 小程序运行环境没有 XHR/fetch,axios 默认 adapter 跑不起来;`uni.request` 天然跨端;省约 13KB                                                           | 拦截器、取消请求等要自己实现                  |
| 地图       | **`<map>` 透传微信原生地图**           | 底图即腾讯地图;打点/气泡/**点聚合免费且无需任何 key**                                                                                               | 原生组件层级问题、新属性滞后                  |
| 地理服务   | **腾讯位置服务,后端代理**              | 逆地理编码/搜索/路线需要 key,**key 绝不能出现在小程序端**(包可解包)                                                                                 | 必须等后端                                    |
| 样式预处理 | **Less**                               | TDesign 的样式入口是`theme.less`                                                                                                                    | 与 preset 自带的`uni.scss` 并存,只用 Less     |

### 为什么不是原生小程序 / Taro

- **原生小程序**在"地图能力完整度"和"组件库成熟度(`tdesign-miniprogram` 1.16 vs uni-app 0.10)"上更优,
  但 WXML/WXSS 技能无法迁移到 Vue/React 岗 —— 而本项目要教的是学生。
- **Taro(React)** 能让小程序与官网同技术栈,但 TDesign **没有 Taro 版**,
  换 NutUI 会与设计体系割裂。

最终取舍:**优先语法可迁移性**。代价是接受一个 pre-1.0 的组件库,
用「精确锁版 + 组件包装层」对冲。

---

## 3. 版本约束【改任何一项前必读】

以下数值全部实测验证过。**改一个必须同时通过:type-check + build + 真机预览。**


| 包                  | 锁定                     | 原因                                               |
| ------------------- | ------------------------ | -------------------------------------------------- |
| `vue`               | **`3.4.21` 精确,无 `^`** | 见下方专节                                         |
| `@vue/runtime-core` | `3.4.21` 精确            | 与`vue` 同版本                                     |
| `vite`              | `5.2.8`                  | npm 最新 8.x 与 uni-app 插件不兼容                 |
| `@dcloudio/*`       | `3.0.0-5020420260813003` | npm 的`latest` tag 指向 **2021 年**废 alpha        |
| `typescript`        | `^4.9.4`                 | 与`vue-tsc@^1.0.24` 配套;单独升 TS 会挂 type-check |
| `vue-tsc`           | `^1.0.24`                | 同上                                               |
| `pinia`             | **`2.2.4`**              | 2.2.5 起要求`vue ^3.5.11`,与 uni-app 冲突          |
| `@tdesign/uniapp`   | `0.10.3` 精确            | pre-1.0                                            |

### ⚠️ `vue` 为什么必须精确锁版(本项目最值得警惕的坑)

`@dcloudio/uni-app` 硬依赖 `@vue/shared@3.4.21`(**精确值**),
而 uni-app preset 把顶层 `vue` 写成 `^3.4.21` —— caret 允许解析到 3.5.42。

两者可以共存,于是 **`vue` 与 `@vue/shared` 会被装成不同版本**,
表现为难以定位的运行时异常。

原先用 npm 时一直正常,只是因为 `package-lock.json` 恰好锁在 3.4.21 ——
**那是运气,不是配置正确**。实测证据:改用 pnpm 重新解析,`vue` 立刻变成 3.5.42。

> 通用教训:**两个包必须同版本时,写精确值,不要把决定权交给解析器。**

### pnpm 相关配置


| 文件                                                                | 作用                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` → `packageManager: "pnpm@12.3.4"`                   | corepack 据此自动切版本                                                                                                                    |
| `package.json` → `scripts.preinstall: "npx --yes only-allow pnpm"` | 误用 npm/yarn 直接报错退出,防止出现两份 lockfile                                                                                           |
| `pnpm-workspace.yaml` → `allowBuilds`                              | pnpm 12 默认拒绝执行依赖 postinstall,需逐项放行`esbuild`/`vue-demi`(**不是** npm 的 `allowScripts`,也**不是**旧版 `onlyBuiltDependencies`) |
| `pnpm-workspace.yaml` → `minimumReleaseAgeExclude`                 | pnpm 12 默认拒装发布未满一定时长的版本(防供应链抢发),按需豁免单个精确版本                                                                  |
| `.npmrc`                                                            | **只放 `registry`**。pnpm 专有键写在这里会让 only-allow 调 npm 时报 `Unknown project config`                                               |

**换 pnpm 白捡的收益**:npm 11 会误判 pinia 的 optional peer
(`@vue/composition-api`,要求 `vue <2.7`)从而报 ERESOLVE,只能靠
`legacy-peer-deps=true` 关掉**全部** peer 校验;pnpm 正确跳过未安装的可选 peer,
所以本项目的 **peer 校验是开着的**。

---

## 4. 环境与运行

### 前置


| 工具           | 要求                                | 检查                                                                                                                                               |
| -------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js        | ≥ 20,推荐**24.20.0 LTS (Krypton)** | `node -v`                                                                                                                                          |
| pnpm           | 12.3.4(corepack 管)                 | `pnpm -v`                                                                                                                                          |
| Git            | 任意近年版本                        | `git --version`                                                                                                                                    |
| 微信开发者工具 | 最新稳定版                          | [https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) |

```bash
corepack enable pnpm          # 一次性。国内慢就加
                              # COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
pnpm install
pnpm run build:mp-weixin      # 先验证空项目能构建,再做别的
```

### 关于 Node 版本管理

**本仓库不放 `.nvmrc`** —— `nvm-windows`(coreybutler 版)长期不读它,
放了反而误导。统一版本靠三条真正生效的机制:
`engines.node`(警告)、`volta.node`(Volta 用户自动切)、`packageManager`(corepack 锁 pnpm)。

用 nvm-windows 的同学手动:

```bash
nvm install 24.20.0 && nvm use 24.20.0    # nvm use 在 Win 上可能需管理员终端
```

### 导入微信开发者工具

```bash
pnpm run dev:mp-weixin     # 保持进程,监听改动
```

1. 「导入项目」→ 目录选 **`dist/dev/mp-weixin`**;
   - ⚠️ **不是仓库根目录**,选错会报「找不到 app.json」;
   - ⚠️ `dist/` 被 gitignore,刚 clone 时不存在,必须先跑上面的命令;
2. AppID:`wx578511d4e7324722`(已写进 `src/manifest.json`;测试号也能看);
3. 域名报错时:详情 → 本地设置 → 勾选「不校验合法域名…」。
   `manifest.json` 里 `urlCheck: false` 会在编译期自动处理。

### 命令一览


| 命令                         | 作用                              |
| ---------------------------- | --------------------------------- |
| `pnpm run dev:mp-weixin`     | 开发编译 →`dist/dev/mp-weixin`   |
| `pnpm run build:mp-weixin`   | 生产构建 →`dist/build/mp-weixin` |
| `pnpm run type-check`        | `vue-tsc --noEmit`                |
| `pnpm run lint` / `lint:fix` | ESLint / 自动修(含 SFC 块重排)    |
| `pnpm run format`            | Prettier                          |
| `pnpm run gen:mock`          | 重新生成 mock 数据(含分布自检)    |
| `pnpm run check:docs`        | 检查文档相对链接                  |

### 换行符

`.gitattributes` 已把仓库内统一为 LF(`*.ts text eol=lf` 等)。
若仍有假 diff,Windows 同学执行一次归一化(会清暂存区,先确认无未提交改动):

```bash
git rm --cached -r . && git reset --soft HEAD
```

---

## 5. 架构现状

```
                 ┌──────────────────────────────────────┐
   页面层         │  pages/*.vue   只做展示、交互、调 api │
                 └───────────────┬──────────────────────┘
                                 │ ① await memberApi.getList(...)
                 ┌───────────────▼──────────────────────┐
   接口声明层     │  api/*.ts      只描述接口,不关心实现   │
                 └───────────────┬──────────────────────┘
                                 │ ② request<T>({url, data})
                 ┌───────────────▼──────────────────────┐
   网络层         │  utils/request.ts  ← 全项目唯一出口   │
                 │  VITE_USE_MOCK 分流 · 拆壳 · token    │
                 └──────┬──────────────────────┬────────┘
              mock=true │                      │ mock=false
        ┌───────────────▼──────┐      ┌────────▼────────────┐
        │ mock/index.ts        │      │ uni.request → tsa-api│
        │ 方法+路径匹配、延迟、  │      │ 返回同样的 Result 壳 │
        │ Result 壳、404       │      └─────────────────────┘
        └───────────────┬──────┘
                ┌───────▼──────────┐
                │ mock/data/*.json │ ← 可整目录删除,业务代码不受影响
                └──────────────────┘
```

`components/`(TDesign 包装层)、`stores/`(跨页共享状态)、
`types/`(契约)、`constants/`(字典)横向被引用,自身不反向引用页面。

各层的**允许/禁止**清单属于规范范畴,见 [DEVELOPMENT.md §3](DEVELOPMENT.md)。

### 目录

```
src/
├── pages/        index · map · member/{list,detail} · event/{list,detail} · notice/detail · mine
├── components/   TsaFilterBar · TsaMemberCard
├── api/          member · event · notice · auth
├── utils/        request(唯一网络出口)· format
├── mock/         index(分发器)· delay · data/*.json
├── stores/       user · memberFilter
├── types/        api · member · event · notice · map · env
├── constants/    industry · region
├── styles/       tdesign-override(主题色唯一出口)· common
└── static/       图标与图片(当前为空,tabBar 用纯文字)
```

### mock ↔ 真后端切换

```
现在        .env.development: VITE_USE_MOCK=true  → mockDispatch() → mock/data/*.json
后端就绪    .env.development: VITE_USE_MOCK=false → uni.request()  → tsa-api
改动范围    一个环境变量。api/ pages/ stores/ 一行不改。
```

前提:后端返回 `{code, message, data}` 统一壳。

**已实测验证**:生产构建(`VITE_USE_MOCK=false`)下 mock 数据被完整 tree-shake ——
成员姓名、手机号、活动标题在生产包中 0 命中,只剩两个共 2 KB 的无人引用空壳文件。
这依赖 `request.ts` 里 mock 是**动态 `import()`**;改成静态 import 就会漏进包里。

---

## 6. 地图技术方案

本项目最核心的页面:`src/pages/map/index.vue`。

### 成本边界


| 能力                           | 实现                      | 要不要 key / 花钱          |
| ------------------------------ | ------------------------- | -------------------------- |
| 底图                           | `<map>`(底图即腾讯地图)   | ❌ 免费无 key              |
| 打点、气泡、**点聚合**         | `markers` + `joinCluster` | ❌ 免费无 key              |
| 逆地理编码、地点搜索、路线规划 | 腾讯位置服务 WebService   | ✅ 需 key,**必须后端代理** |

**不用高德**:微信 `map` 底图是 GCJ-02,混用高德 key/SDK 会引入另一套偏移。

### 数据分布是这张页面的设计核心

mock 的 300 条**刻意不均匀**(潮汕乡会的真实人口结构):


| 区域                                  | 条数 | 占比 | 作用                        |
| ------------------------------------- | ---- | ---- | --------------------------- |
| 潮汕本地(汕头 92 + 潮州 14 + 揭阳 14) | 120  | 40%  | 演示`join-cluster` 的主战场 |
| 珠三角(广深莞佛珠中惠)                | 99   | 33%  | 潮商在外最密集区            |
| 长三角(沪杭甬温苏宁)                  | 36   | 12%  |                             |
| 京津冀(京、津)                        | 24   | 8%   |                             |
| 其他省会(蓉汉长厦闽昆陕)              | 21   | 7%   | 稀疏点,演示缩放层次         |

坐标 = 真实城市经纬度 ± `0.15°`(外地)/ `0.05°`(区县内)扰动,
避免几百点叠在同一像素。扰动用固定种子。

**均匀撒满全国是最糟的做法**:地图看不出信息,聚合也演示不出来。

### 八条实现约束

1. **`<map>` 是原生组件,层级最高**。`z-index` 无效,覆盖层必须 `cover-view`/`cover-image`;
   其内不能嵌 TDesign 组件,`gap` 等 CSS 不生效。本项目分工:
   成员卡片用 `cover-view`(必须浮在地图上),筛选面板用 `t-popup`(本来就该盖住地图)。
2. **`marker.id` 必须是 number**。成员 id 是 `m0001` 字符串,所以用数组下标当 id +
   `Map<number, Member>` 反查(见 `byIndex`)。
3. **聚合点点击要区分**。聚合气泡的 markerId 不在反查表里,`get()` 返回 `undefined`
   时**不弹卡片**(地图自己会展开)。漏了这个判断会出现"点聚合弹出不相干的人"。
4. **不要开 `show-location`**(见下方"降风险")。
5. **不要用 `regionchange` 回写 center**。`:latitude` 是受控属性,拖动结束回写会让地图
   弹回或持续抖动。只在点「家乡/全国」按钮时主动改 center。
   将来做"视野内成员数"要读 `e.detail` 但不回写。
6. **`iconPath` 必须 PNG**,本地 `/static` 路径,28×28 起。当前刻意不传,用微信默认图钉。
7. **沉浸式页面自己让开状态栏**。地图页 `navigationStyle: custom`,
   按钮要用 `uni.getSystemInfoSync().statusBarHeight` 下推。
8. **H5 端表现不同**。编译到 H5 时是另一套地图实现,`cover-view` 行为有差异。
   第一阶段只验微信小程序;出 H5 时地图页必须单独回归。

要"自动框住所有点"别手算 center,用:

```js
uni.createMapContext('memberMap').includePoints({ points, padding: [60, 40, 60, 40] })
```

### ⭐ 第一阶段绕开了整条合规链路

图上渲染的是**成员的坐标**,不是**用户的位置**。所以:

- ❌ 不需要 `show-location` → 不触发 `scope.userLocation` 授权
- ❌ 不需要隐私协议、不需要 `manifest.json` 声明 `requiredPrivateInfos`
- ❌ 不需要腾讯位置服务 key(打点/聚合免费)
- ❌ 不需要配 request 合法域名(mock 阶段无真实网络请求)

**→ 第一阶段不依赖任何外部审批就能完整跑起来。** 这是刻意设计的降风险。

---

## 7. 领域模型

字段定义以 `src/types/` 为准,这里说明**设计意图**(建表细节等 `tsa-api` 动工时再定)。

### member(乡贤)

一个成员 = 一个地理点 + 一份职业身份。关键字段设计理由:


| 字段                              | 为什么这样设计                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `id` 用 `m0001` 字符串业务编号    | 不用自增 int 暴露在 URL,避免被遍历猜出会员量                                              |
| `province`/`city` 存**中文全称**  | 与前端字典一致,省一层映射。字典类字段(如`industry`)相反,存 code                           |
| `district` 仅汕头会员有值         | 汕头六区一县是家乡本地成员的主要细分维度                                                  |
| `lat`/`lng` 精度 6 位小数(GCJ-02) | 约 0.1 米精度,足够                                                                        |
| `industry` 存 code                | 中文改名不动数据;`constants/industry.ts` 是映射表                                         |
| `country` 恒为 `"中国"` 但保留    | 为海外潮籍乡亲预留。潮汕是最大侨乡之一、海外潮人约 1500 万,这是第二阶段最有故事的差异化点 |
| `contactVisible` 默认 false       | 隐私红线。**权限过滤必须在后端做**,前端 `v-if` 拦不住抓包                                 |
| `graduationYear` + `school`       | 乡会的核心纽带是"届别 + 院校",便于按届统计与校友匹配                                      |

行业字典刻意偏向潮商实际结构:商贸、餐饮食品、制造业权重高
(澄海玩具、潮阳内衣、汕头食品是本地支柱产业)。

### event(活动)

`status`(`upcoming/ongoing/past/cancelled`)**由服务端计算**,不让前端比时间 —— 客户端时间不可信。
`registered_count` 是冗余计数列,真实人数以报名关系表 count 为准。

第二阶段做报名必须解决:名额并发扣减(`UPDATE ... WHERE count < quota` 判影响行数)、
重复提交幂等(`UNIQUE(event_id, member_id)`,不能靠"先查再插")。

### notice(公告)

`summary` 独立存字段,不让前端截断正文。`content` 当前是含 `\n` 的纯文本,
前端用 `white-space: pre-wrap` 渲染;将来要富文本必须用 `<rich-text>`,小程序没有 `v-html`。

### 待办

- 会员数超 500 或需后台维护字典时,再建 `dict` 表(现在硬编码,迁移成本低)
- 数据量上万后地理范围查询考虑 MySQL 空间索引或 Redis GEO

---

## 8. 已知平台约束与踩坑


| 现象                                      | 原因 / 解法                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.vue` 全报 `Parsing error: '>' expected` | `.vue` 顶层 parser 必须是 `vue-eslint-parser`,TS parser 只能挂在它 `parserOptions.parser` 下;且配置数组里 `tseslint` 要排在 `pluginVue` **之前** |
| `import x from './a.json'` 报找不到模块   | preset 未开`resolveJsonModule`,已在 `tsconfig.json` 打开                                                                                         |
| 传查询对象报`Index signature is missing`  | TS 只在 type 别名上推导隐式索引签名,见 DEVELOPMENT §4                                                                                           |
| `eslint` ignores 写 `*.d.ts` 不生效       | 只匹配根目录一层,要写`**/*.d.ts`                                                                                                                 |
| `*.local` 匹配不到 `settings.local.json`  | 它匹配"以`.local` 结尾",该文件以 `.json` 结尾                                                                                                    |
| Prettier 改坏`pages.json`                 | 这俩文件带`//`,已从 `.prettierignore` 排除                                                                                                       |
| 坐标偏移几百米                            | GCJ-02 vs WGS-84;用腾讯拾取器坐标                                                                                                                |
| mock 数据进了生产包                       | 忘了用动态`import()`                                                                                                                             |

---

## 9. 当前边界

### 第一阶段已做

8 个页面 / 5 个 tab;地图打点 + 点聚合 + 跨页共享筛选 + 家乡/全国视角;
乡贤名录分页与详情;首页统计与公告;活动列表与详情(可看不可报名);
全链路 mock;ESLint + Prettier + husky + commitlint;pnpm 严格隔离。

### 明确不做(推迟原因)


| 不做                           | 原因                                                                                                          | 阶段           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------- |
| 真实微信登录                   | 需正式 AppID + 后端`code2session`                                                                             | 二             |
| 用户定位与隐私授权             | 会引入`scope.userLocation` 整条合规链路,而第一阶段不需要                                                      | 二             |
| 腾讯位置服务(逆编码/搜索/路线) | 需 key,且必须后端代理                                                                                         | 二             |
| 海外潮籍乡亲分布               | `country` 字段已预留,不返工                                                                                   | 二             |
| 活动报名/签到                  | 涉及并发与幂等,要写接口                                                                                       | 二             |
| 文件上传(头像)                 | 需 OSS/MinIO                                                                                                  | 二             |
| tabBar 图标                    | 微信允许纯文字 tab,不阻塞任何功能。素材到位后加 10 张 PNG(81×81)并给每个 tab 补`iconPath`/`selectedIconPath` | 随时           |
| 消息通知                       | 需订阅消息模板审核                                                                                            | 三             |
| CI/CD                          | 学生团队稳定后再引入                                                                                          | 三             |
| H5 编译                        | 地图页在 H5 表现不同,需单独回归                                                                               | 与官网一并规划 |
