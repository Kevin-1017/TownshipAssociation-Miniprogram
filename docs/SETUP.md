# 环境搭建

面向第一次接触本项目的同学。**照着做完一定能跑起来**;跑不起来的部分,
答案大概率在 [FAQ.md](FAQ.md) 里。

---

## 0. 前置要求

| 工具           | 要求                   | 检查命令        |
| -------------- | ---------------------- | --------------- |
| Node.js        | **≥ 20**,推荐 24 LTS   | `node -v`       |
| **pnpm**       | 12.3.4(由 corepack 管) | `pnpm -v`       |
| Git            | 任意近年的版本         | `git --version` |
| 微信开发者工具 | 最新稳定版             | 单独下载        |

微信开发者工具下载:<https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>

### 本项目只用 pnpm,不用 npm

`package.json` 里有两处强制:

```jsonc
"packageManager": "pnpm@12.3.4",              // corepack 据此自动切版本
"scripts": { "preinstall": "npx --yes only-allow pnpm" }  // 误用 npm/yarn 会直接报错退出
```

这不是洁癖:如果 A 同学用 npm、B 同学用 pnpm,仓库里会同时出现
`package-lock.json` 和 `pnpm-lock.yaml`,两边装出的依赖树**可以不一样**,
然后出现"我这里好的啊"这种无从下手的 bug。

**启用 pnpm(只需一次)** —— Node 自带 corepack:

```bash
corepack enable pnpm
pnpm -v          # 应输出 12.3.4
```

国内网络建议加镜像,否则 corepack 会去国外拉:

```bash
COREPACK_NPM_REGISTRY=https://registry.npmmirror.com corepack enable pnpm
```

### 为什么是 Node ≥ 20 而不是"越高越好"

`package.json` 里的 `engines.node` 写的是 `>=20.0.0`,这是**下限**。
不要手动去升 uni-app 依赖的任何版本号,原因见第 5 节的版本约束总表。

### ⚠️ nvm-windows 不会自动读 `.nvmrc`

`nvm-windows`(coreybutler 版)长期不支持 `.nvmrc`,所以本仓库**不放**
`.nvmrc`(放了也没用,反而会让人误以为生效了)。

统一版本靠三条真正生效的机制:

1. `package.json` 的 `engines.node` —— 版本不匹配时包管理器会警告;
2. `package.json` 的 `volta.node` —— 装了 Volta 的同学会自动切到 24.20.0;
3. `packageManager` 字段 —— 装了 corepack 的同学,pnpm 版本也被锁死。

用 nvm-windows 的同学请手动执行:

```bash
nvm install 24.20.0
nvm use 24.20.0
```

`nvm use` 在 Windows 上需要重新指向符号链接,若报权限错误请**以管理员身份**打开终端。

---

## 1. 安装依赖

```bash
pnpm install
```

镜像已配好(`.npmrc` 里 `registry=https://registry.npmmirror.com`)。
lockfile 是 `pnpm-lock.yaml`,**必须提交**,不要删。

### ⚠️ pnpm 默认拒绝执行依赖的构建脚本

pnpm 12 比 npm 11 更严:**任何**依赖的 `postinstall` 默认都不执行,
而且不是警告、是**直接报错中断安装**:

```
ERR_PNPM_IGNORED_BUILDS
  × installing dependencies
  ╰─▶ Ignored build scripts: esbuild@0.20.2, vue-demi@0.14.10, ...
```

本项目需要的两个已在 `pnpm-workspace.yaml` 里逐项放行:

| 依赖       | 为什么必须放行                                                       |
| ---------- | -------------------------------------------------------------------- |
| `esbuild`  | 它的 postinstall 负责下载**平台原生二进制**,不放行则 Vite 完全起不来 |
| `vue-demi` | pinia 依赖它按 Vue 版本切换入口                                      |

`core-js`、`core-js-pure`、`@tdesign/uniapp` 显式设为 `false` ——
它们的脚本只打印捐赠信息或 Vue2 适配警告,不放行没有任何影响。

**新增带构建脚本的依赖时**,不要跑交互式 `pnpm approve-builds` 一路回车,
请在 `pnpm-workspace.yaml` 里手动加一行 `包名: true` 并写明原因 ——
"谁被执行了"必须在 code review 里看得见。

### pnpm 下不需要 `legacy-peer-deps`

这是换 pnpm 白捡的收益。npm 11 因为误判 pinia 的 optional peer,
不得不在 `.npmrc` 里关掉整个 peer 校验;pnpm 正确处理 optional peer,
**所以本项目的 peer 校验是开着的**。原因写在 [FAQ.md](FAQ.md) 的「依赖解析」。

### ⚠️ pnpm 12 的 `minimumReleaseAge` 会拦新发布的包

pnpm 12 默认拒绝安装"发布未满一段时间"的版本(防供应链抢发投毒)。
本项目实际撞上过一次:`eslint-plugin-vue@10.11.0` 刚发布就被拦。

处理方式是在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 里
**豁免单个精确版本**,而不是调低全局 `minimumReleaseAge`。

---

## 2. 先验证空项目能构建

```bash
pnpm run build:mp-weixin
```

看到 `DONE Build complete.` 才继续。这一步是为了把"环境问题"和
"你写的代码的问题"分开 —— 以后遇到构建失败,先想这一步当时是不是过了。

---

## 3. 导入微信开发者工具

```bash
pnpm run dev:mp-weixin        # 保持这个进程运行,它会监听改动
```

**别关掉这个终端**。然后:

1. 打开微信开发者工具 → 「导入项目」;
2. 目录选:`<本仓库路径>/dist/dev/mp-weixin`
   - ⚠️ 是 `dist/dev/mp-weixin`,**不是仓库根目录**。
     选错会报「找不到 app.json」;
   - ⚠️ `dist/` 被 gitignore,刚 clone 时不存在,必须先跑上面的命令;
3. AppID:填 `wx578511d4e7324722`(或选「测试号」也能看);
4. 若提示域名/合法校验问题:右上角「详情」→「本地设置」→
   勾选「**不校验合法域名、web-view、TLS 版本以及 HTTPS 证书**」。
   `src/manifest.json` 里的 `urlCheck: false` 就是帮你在编译期自动关掉它。

改代码后开发者工具会自动热更新;没反应就点「编译」按钮。

---

## 4. 自检清单

跑起来后逐条确认,不对就去 FAQ:

- [ ] 底部有 5 个 tab:首页 / 地图 / 乡贤 / 活动 / 我的
- [ ] 首页显示乡贤总数 300、省市排行榜、5 条公告
- [ ] 地图页潮汕一带点位密集、珠三角次密集、全国有散点
- [ ] 地图缩放到市级时,密集点合并成带数字的聚合气泡
- [ ] 点单个标记弹出 callout 与底部成员卡片
- [ ] 右上角「全国」/「家乡」能切换视角
- [ ] 筛选选「深圳市」后地图点变少,再切到「乡贤」tab,列表也是深圳的
      ← 这条验证 Pinia 跨页共享生效
- [ ] 开发者工具 Console 里 **没有** `[mock] 未定义的接口` 警告
- [ ] 「我的」点「mock 登录」后,顶部变成一位真实乡贤的资料

---

## 5. 版本约束总表(**不要单方面升级**)

以下数值都实测验证过,改动任何一项都可能直接构建失败:

| 包                          | 锁定                      | 为什么不能动                                                        |
| --------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `vite`                      | `5.2.8`                   | npm 最新是 8.x,与 uni-app 插件不兼容                                |
| `@dcloudio/vite-plugin-uni` | `3.0.0-5020420260813003`  | 其 npm `latest` tag 指向 **2021 年**的废 alpha,`pnpm add -D` 会装错 |
| `vue`                       | **`3.4.21`(精确,无 `^`)** | 见下方说明 —— preset 原本写 `^3.4.21`,是个真 bug                    |
| `@vue/runtime-core`         | `3.4.21`(精确)            | 与 `vue` 同版本                                                     |
| `typescript`                | `^4.9.4`                  | 与 `vue-tsc@^1.0.24` 配套;单独升 TS 会让 type-check 挂              |
| `vue-tsc`                   | `^1.0.24`                 | 同上                                                                |
| `pinia`                     | `2.2.4`                   | 2.2.5 起要求 Vue ≥3.5.11,与 uni-app 冲突                            |
| `@tdesign/uniapp`           | `0.10.3`                  | pre-1.0,不加 `^`,升级只改 `components/` 包装层                      |

### 为什么 `vue` 必须是精确版本

`@dcloudio/uni-app` 硬依赖 `@vue/shared@3.4.21`(**精确值**)。
而 uni-app preset 把顶层 `vue` 写成 `^3.4.21` —— 这个 caret 允许解析到 3.5.42,
于是 **`vue` 与 `@vue/shared` 会被装成两个不同版本**,行为不可预期。

之前在 npm 下能正常跑,只是因为 `package-lock.json` 恰好把它锁在了 3.4.21 ——
**那是运气,不是配置**。实测:改用 pnpm 重新解析,`vue` 立刻变成 3.5.42。

所以本项目把 `vue` 钉成精确的 `3.4.21`。**任何 `vue` 的版本变更都必须与
uni-app 的 `@vue/shared` 对齐**,否则不要动。

### 升级流程

要动上表里任何一个版本,必须三件事全部通过:

1. `pnpm run type-check` 零错误;
2. `pnpm run build:mp-weixin` 构建通过;
3. 微信开发者工具里**真机预览**核心路径(地图聚合、筛选、列表分页)。

只过前两条不算过 —— 小程序运行时的问题编译期看不出来。
