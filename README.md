# 汕头乡会小程序 (tsa-miniprogram)

汕头乡会官方平台的前端之一。**uni-app + Vue 3 + TypeScript + TDesign**,当前主要产出微信小程序,同一套代码将来可编译 H5。

项目的技术亮点是**乡贤分布地图**:把成员的地理分布可视化,支持点聚合、按省市与行业筛选。

---

## 5 分钟跑起来

```bash
# 1. Node 版本(必须 >= 20,推荐 24 LTS)
node -v

# 2. 装依赖
npm install

# 3. 编译到微信小程序(进程常驻,监听改动)
npm run dev:mp-weixin
```

然后打开**微信开发者工具** → 导入项目 → 目录选:

```
本仓库/dist/dev/mp-weixin
```

AppID 已在 `src/manifest.json` 配好,直接就能预览。

> ⚠️ 你导入的是 `dist/dev/mp-weixin`,**不是仓库根目录**。
> `dist/` 是构建产物,被 gitignore 了,所以刚 clone 下来时它不存在 ——
> 必须先跑一次 `npm run dev:mp-weixin`。这是新手最容易卡住的地方,
> 详见 [docs/SETUP.md](docs/SETUP.md)。

跑起来后你应该看到:底部 5 个 tab,首页有乡贤分布排行与公告,
点「地图」能看到潮汕与珠三角密集的成员点,缩放到市级会自动聚合成带人数的气泡。

---

## 技术栈

| 层         | 选型                      | 版本                      | 为什么                                                      |
| ---------- | ------------------------- | ------------------------- | ----------------------------------------------------------- |
| 跨端框架   | uni-app(CLI 模式)         | `3.0.0-5020420260813003`  | Vue 3 语法可迁移到Web 岗位;保留出 H5 的后路                 |
| 框架       | Vue 3                     | `3.4.21`(被 uni-app 钉死) | —                                                           |
| 语言       | TypeScript                | `~4.9` + `vue-tsc 1.x`    | **配套的一对,不要单独升 TS**                                |
| 构建       | Vite                      | `5.2.8`                   | preset 锁定值,**不能升到 8**                                |
| UI         | `@tdesign/uniapp`         | `0.10.3` 精确锁版         | 腾讯一方;与将来 React 官网的 `tdesign-react` 同一套设计语言 |
| 状态       | Pinia                     | `2.2.4`                   | **不能装 2.2.5+/3.x**,它们要求 Vue ≥3.5.11                  |
| 地图       | uni-app `<map>`(微信原生) | —                         | 底图即腾讯地图,打点与聚合免费、无需 key                     |
| 样式预处理 | Less                      | `^4.9.1`                  | TDesign 的样式入口是 `theme.less`                           |

完整版本约束与踩坑记录见 [docs/SETUP.md](docs/SETUP.md) 和 [docs/FAQ.md](docs/FAQ.md)。

---

## 目录结构

```
src/
├── pages/        页面:只做展示与交互,不发请求、不写业务逻辑
├── components/   业务组件(TDesign 的包装层)
├── api/          接口声明:只描述"调什么、传什么、回什么"
├── utils/        request.ts 是全项目唯一的网络出口
├── mock/         本地模拟后端。可整目录删除而不影响业务代码
├── stores/       Pinia。只放跨页面共享的状态(现在只有两个)
├── types/        与后端契约的类型化表达
├── constants/    行业、行政区划等字典
└── styles/       主题 token 覆盖 + 通用工具类
```

分层规则、数据流向、以及"什么状态该进 Pinia"的判断标准:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 常用命令

| 命令                        | 作用                                   |
| --------------------------- | -------------------------------------- |
| `npm run dev:mp-weixin`     | 开发编译,产物在 `dist/dev/mp-weixin`   |
| `npm run build:mp-weixin`   | 生产构建,产物在 `dist/build/mp-weixin` |
| `npm run type-check`        | `vue-tsc --noEmit`,提交前自查          |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修                   |
| `npm run format`            | Prettier 格式化                        |
| `npm run gen:mock`          | 重新生成 mock 成员数据                 |
| `npm run check:docs`        | 检查文档内部相对链接是否失效           |

---

## 怎么连真后端

后端仓库 `tsa-api`(Spring Boot)还没动工,但接口契约已经定死在
[docs/API.md](docs/API.md)。等它跑起来后,只需要改一个地方:

```bash
# .env.development
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

`api/`、`pages/`、`stores/` 一行都不用改。前提是后端返回
`{ code, message, data }` 这个统一壳 —— 这条约束写在 API.md 第一行。

---

## 给学生:从哪开始

1. 先读 [docs/SETUP.md](docs/SETUP.md) 把项目跑起来,再读代码;
2. 读 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 弄清分层,不要跳;
3. 从 [docs/TASKS.md](docs/TASKS.md) 的 **L1** 任务开始动手,别一上来挑 L4;
4. 卡住了先查 [docs/FAQ.md](docs/FAQ.md),没有答案就把踩的坑补写进去 ——
   这份文档是累积资产,后来的同学会感谢你先。

提交前会自动跑 lint 与 commit message 校验,规范见
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)。

---

## 当前进度与边界

第一阶段(本仓库现状):小程序脚手架 + 地图/名录/首页/活动/我的,数据全 mock。

**明确不做**(原因见计划):真实微信登录、用户定位与隐私授权、腾讯位置服务
逆地理编码与搜索、活动报名签到、文件上传、海外潮籍乡亲分布。
这些都在第二阶段,原因集中在两件事:需要正式 AppID 审核,或需要后端代理密钥。
