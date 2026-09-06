# 协作规范

---

## 一、分支策略

```
main        ← 始终可运行。只有评审通过的代码能进
  └── feat/xxx   从 main 切,做完提 PR 回 main
  └── fix/xxx    同上
```

**不在 main 上直接提交。** 每个人一个短分支,名字说明在做什么:

```bash
git checkout -b feat/map-region-count
```

改完提 PR,至少一人评审后合并。**评审不是形式** —— 教学项目里,
读别人的代码是主要的学习途径之一。

---

## 二、Commit message

由 commitlint 强制校验,格式不对**提交不进去**。

```
<type>: <subject>

feat: 地图页增加当前视野成员计数
fix: 修复聚合点被点击时误弹成员卡片
docs: 补充 MAP.md 的 includePoints 用法
```

| type       | 用途               |
| ---------- | ------------------ |
| `feat`     | 新功能             |
| `fix`      | 修 bug             |
| `docs`     | 文档               |
| `style`    | 格式(不改逻辑)     |
| `refactor` | 重构(不改外部行为) |
| `perf`     | 性能               |
| `test`     | 测试               |
| `chore`    | 构建/工具链        |
| `revert`   | 回滚               |

要求:

- **中文 subject 允许**(团队配置已放开 `subject-case`);
- 标题 ≤ 72 字符,一句话说清「做了什么」;
- **不要写「修改」「更新」「fix bug」这种无信息量的话**;
- 改了行为原因,写在 body 里。标题说「改了什么」,正文说「为什么」。

一次提交只做一件事。不要把「重命名变量」和「新增功能」混在一个 commit 里 ——
那会让 code review 和回滚都变困难。

---

## 三、提交时会自动跑什么

husky 配了两个钩子:

| 钩子         | 做什么                                                 |
| ------------ | ------------------------------------------------------ |
| `pre-commit` | 对**暂存区文件**跑 `eslint --fix` + `prettier --write` |
| `commit-msg` | commitlint 校验 message 格式                           |

**pre-commit 刻意不跑 `type-check`** —— vue-tsc 全量要十几秒,
放这里学生很快就会开始用 `--no-verify`,那比不检查更糟。

所以请自己在提交前跑:

```bash
npm run type-check    # 十几秒,但必须过
npm run lint          # 快
```

### 关于 `--no-verify`

`git commit --no-verify` 能绕过钩子。**不要用**,除非在写 WIP 提交。
绕过 lint 的后果是同一段代码在两个人机器上格式化结果不一致,
然后产生满屏假 diff。

---

## 四、代码规范要点

规则本体在 `eslint.config.mjs`,取向是**宽松起步**:只留真 bug 类规则,
风格交给 Prettier。原因写在配置注释里。

几条人工约定(lint 管不到的):

1. **页面不发请求。** 所有网络调用走 `src/api/`,由它调 `utils/request.ts`。
2. **不裸用 TDesign 做业务 UI。** 有业务含义的组合要包成 `components/Tsa*`,
   理由(升级隔离)见 `docs/ARCHITECTURE.md`。原子控件如 `t-button` 不必包。
3. **不往 Pinia 塞页面私有状态。** 判据见 ARCHITECTURE.md 第四节。
4. **注释解释「为什么」,不复述「是什么」。**
   本项目里每个看起来奇怪的写法都配了一条说明原因的注释 ——
   那是给下一个人的路标,不要删。
5. **不写用不到的代码。** 空目录、预留但没人调的函数、注释掉的旧实现,
   都不要留在仓库里。要删就删干净,git 记得住。

---

## 五、PR 描述模板

```markdown
## 做了什么

一两句话。

## 为什么

动机 / 关联的任务编号(见 docs/TASKS.md)。

## 怎么验证的

- [ ] npm run type-check 通过
- [ ] npm run lint 通过
- [ ] npm run dev:mp-weixin,微信开发者工具里实际点了哪些路径

## 影响面

改了哪几层;有没有动 types/ 或 mock 路由表(动了要同步 docs/API.md)。
```

最后一项最重要:**`src/types/` 和 `docs/API.md` 和 `src/mock/index.ts` 三处
必须同时一致**。不同步是这类分层项目最容易出的问题,评审时优先看这个。

---

## 六、加一个接口的标准动作(四步,顺序不能省)

以「增加乡贤荣誉墙列表」为例:

1. `src/types/` 加类型 → 定契约;
2. `docs/API.md` 加接口条目 → 让后端同学能看到;
3. `src/mock/index.ts` 路由表 + `src/mock/data/` 数据 → 前端能立即开工;
4. `src/api/honor.ts` 声明 → 页面开始用。

漏掉第 2 步的后果:后端按自己的想象实现,联调时两边对不上。
漏掉第 3 步的后果:页面空白,你开始怀疑是渲染问题。
