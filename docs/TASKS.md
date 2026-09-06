# 学生任务清单

任务按难度分级,**每个都自带验收标准**。选题原则:真实需要(不是练习题),
且改动范围与层级对应。

> 动手前先读 [ARCHITECTURE.md](ARCHITECTURE.md)。卡住先查 [FAQ.md](FAQ.md)。
> 提交规范见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## ⭐ L1 —— 单文件,改配置或文案

目标:熟悉项目结构、跑通构建与提交流程。**不含逻辑**。

### L1-1 换主题色

把品牌蓝换成乡会 VI 色。

- 涉及:`src/styles/tdesign-override.less`、`src/pages.json` 的 `tabBar.selectedColor`
- 验收:所有按钮、tag、tabBar 高亮同步变化
- **注意**:地图页 `cover-view` 里有几处硬编码的 `#0052d9`。
  先读 [MAP.md](MAP.md) 的说明 —— 那里记录了为什么暂时用字面值、
  以及 CSS 变量在 cover-view 上的生效情况**尚未真机验证**。
  请你在真机上测出来,把结论补进 MAP.md,再决定要不要改成变量

### L1-2 行业字典补一项

加「文化艺术」行业。

- 涉及:`src/constants/industry.ts`、`scripts/gen-mock.mjs`(让它出现在数据里)
- 验收:筛选面板出现新选项且能筛出人;`npm run gen:mock` 后总数仍是 300

### L1-3 首页文案与乡会介绍

补全乡会简介段落、修正错别字。

- 涉及:`src/pages/index/index.vue`
- 验收:排版不破;不改任何逻辑

---

## ⭐⭐ L2 —— 跨四层加一个只读列表

目标:走通 `types → API.md → mock → api → page` 的完整链路。

### L2-1 乡贤荣誉墙(新增列表页)

展示乡会理事名单(姓名/职务/分工/照片占位)。

- 涉及:`src/types/honor.d.ts`、`src/api/honor.ts`、`src/mock/index.ts` 路由、
  `src/mock/data/honors.json`、`src/pages/honor/list.vue`、`src/pages.json`
- 验收:
  - [ ] 页面能打开并显示数据
  - [ ] Console 无 `[mock] 未定义的接口`
  - [ ] `docs/API.md` 新增了对应条目
  - [ ] 把 `VITE_USE_MOCK` 改 false,页面报「网络异常」toast 而**不是白屏**

### L2-2 成员详情页加「同乡还在哪些城市」

用现有 `getMapData` 数据做同城推荐。

- 涉及:仅 `src/pages/member/detail.vue`
- 验收:点击进入对应成员详情;排除自己;空城市时不显示该区块

### L2-3 活动列表按城市分组

- 涉及:`src/pages/event/list.vue`(可加一个城市筛选)
- 验收:切城市后列表正确;返回上级页再进来筛选状态合理(说明为什么这样设计)

---

## ⭐⭐⭐ L3 —— 性能与复杂查询

目标:碰 `utils/` 与地图,开始考虑数据量。

### L3-1 地图当前视野成员计数

监听 `regionchange`,显示「视野内 N 位乡贤」。

- 涉及:`src/pages/map/index.vue`、`src/utils/geo.ts`(**新建**,距离/矩形包含计算)
- 难点:**不能回写 center**(会让地图抖动,见 [MAP.md](MAP.md) 第 5 条)
- 验收:拖动时数字变化;松手后地图不跳回;帧率不明显下降(自己节流)

### L3-2 地图按省份着色 / 排行榜

用已有 `/members/stats/province` 接口做区域热度。

- 涉及:map 页 + 一个新组件
- 验收:数字与 mock 自检输出一致

### L3-3 列表页图片与请求优化

把 `memberApi.getMapData()` 的结果缓存,避免首页/地图页各拉一次。

- 涉及:`src/utils/request.ts` 或新增 `utils/cache.ts`
- 验收:两个页面共享一次请求;加缓存失效策略并说明取舍

---

## ⭐⭐⭐⭐ L4 —— 基础设施

目标:理解请求生命周期与并发。改动会影响全站,**必须先写清方案再动手**。

### L4-1 request 层加请求去重与短期缓存

同一接口并发调用只发一次;GET 结果可缓存 N 秒。

- 涉及:仅 `src/utils/request.ts`
- 验收:并发调 `getMapData()` 两次,mock 只被进入一次(加计数器证明);
  缓存过期后能重新拉;`showLoading` 行为不被破坏

### L4-2 全局错误上报与空态治理

把散落的 `uni.showToast` 收敛成统一错误处理 + 统一空态组件 `TsaEmpty`。

- 涉及:`src/utils/request.ts`、`components/TsaEmpty/`、各页面
- 验收:任何接口失败都有明确用户反馈且**不会静默**;各列表空态样式一致

### L4-3 真机性能报告

用开发者工具「性能」面板量首屏,列出 3 个瓶颈与优化动作。

- 验收:报告文档化,数据前后对比

---

## ⭐⭐⭐⭐⭐ L5 —— 跨仓库联调与架构

### L5-1 接真后端(tsa-api)

与后端组协同,把 `/members/*` 三个接口从 mock 切到真实实现。

- 涉及:`.env.development`、契约偏差修正
- 验收:关掉 mock 后地图与列表完全正常;`docs/API.md` 记录了所有实际偏差
- **重点**:后端有没有按 `contact_visible` 真的剔除字段?抓包验证 ——
  前端 `v-if` 不算数(见 [API.md](API.md) 隐私一节)

### L5-2 引入真实微信登录

需正式 AppID + 后端 `code2session`。

- 验收:真机(非模拟器)能完成登录;token 过期后能自动跳登录;
  `Authorization` 头正确携带

### L5-3 接腾讯位置服务(经后端代理)

逆地理编码:注册时选点自动填省市。

- 验收:**小程序包里 grep 不到 key**(自己验证:
  `grep -r <key> dist/build/mp-weixin`);key 只在后端配置里

### L5-4 海外潮籍乡亲分布

第二阶段最有价值的功能。潮汕是最大侨乡之一,海外潮人约 1500 万。

- 涉及:`country` 字段启用、mock 数据加东南亚/欧美点、地图加「全球」视角档
- 难点:低缩放级别下腾讯地图海外标注稀疏,要验证可读性
- 验收:三档视角(家乡/全国/全球)都清楚;国内数据不回归

### L5-5 出 H5 版

`npm run build:h5` 跑通并适配桌面布局。

- **重点**:地图页在 H5 是另一套实现,`cover-view` 行为不同,必须单独回归
  (见 [MAP.md](MAP.md) 第 8 条)

---

## 给老师的分组建议

两人一组起步:**A 组后端(tsa-api)、B 组前端(本仓库)**。
先共同评审 `docs/API.md`(这是唯一契约),定稿后两组并行,
到 L5-1 才需要碰头 —— 这样最大化并行度,也最接近真实协作。

前端组内部:每人至少一个 L1 + 一个 L2,L3 以上按兴趣认领。
**L1 的验收重点不是"做完了",是"提交流程走对了"** —— 分支、commit message、
PR 描述,这三样在 L1 阶段就要养成习惯。
