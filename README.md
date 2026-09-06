# 汕头乡会小程序 (tsa-miniprogram)

uni-app + Vue 3 + TypeScript + TDesign 的微信小程序。技术亮点是**乡贤分布地图**:
可视化成员的地理分布,支持点聚合与按省市/行业筛选。

本仓库**只有三份文档**,各自负责一个互不重叠的范围。遇到问题先看这张表:

| 你要找什么           | 去哪份                                     | 内容                                                                                                                                   |
| -------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **写代码该怎么写**   | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | SFC 块顺序与 `<script setup>` 内部分区、命名、分层边界、TypeScript、Pinia 归属、样式、注释、Git 与提交规范、code review 清单、禁止事项 |
| **项目为什么是这样** | [docs/TECHNOLOGY.md](docs/TECHNOLOGY.md)   | 选型与代价、**版本约束(改前必读)**、环境搭建与运行命令、架构与数据流、地图技术方案与八条实现约束、领域模型、已知平台坑、当前边界       |
| **接口长什么样**     | [docs/API.md](docs/API.md)                 | 前后端契约:统一响应壳、错误码、各接口的路径/参数/返回、隐私要求。`tsa-api` 与官网都照这份实现                                          |

一条知识只有一个出处。**发现同一件事在两份文档里都写了,就是需要修合并并。**

---

## 跑起来

```bash
corepack enable pnpm     # 一次性;本仓库只用 pnpm,npm/yarn 会被 preinstall 拦下
pnpm install
pnpm run dev:mp-weixin   # 保持进程
```

微信开发者工具导入 **`dist/dev/mp-weixin`**(不是仓库根目录;`dist/` 是构建产物,
被 gitignore,必须先跑上面这条命令)。

完整步骤、版本要求、pnpm 配置说明:[TECHNOLOGY.md §4](docs/TECHNOLOGY.md)。

---

## 工程化现状

`type-check` / `lint` / `format` / `build` 四条命令均通过;
husky 的 `pre-commit`(lint-staged)与 `commit-msg`(commitlint)已生效;
mock 数据 300 条潮汕乡贤,生产构建下已被 tree-shake 出包外。
