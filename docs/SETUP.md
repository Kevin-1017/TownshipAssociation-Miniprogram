# 环境搭建

面向第一次接触本项目的同学。**照着做完一定能跑起来**;跑不起来的部分,
答案大概率在 [FAQ.md](FAQ.md) 里。

---

## 0. 前置要求

| 工具           | 要求                 | 检查命令        |
| -------------- | -------------------- | --------------- |
| Node.js        | **≥ 20**,推荐 24 LTS | `node -v`       |
| npm            | 随 Node 安装         | `npm -v`        |
| Git            | 任意近年的版本       | `git --version` |
| 微信开发者工具 | 最新稳定版           | 单独下载        |

微信开发者工具下载:<https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>

### 为什么是 Node ≥ 20 而不是"越高越好"

`package.json` 里的 `engines.node` 写的是 `>=20.0.0`,这是**下限**。
不要手动去升 uni-app 依赖的任何版本号,原因见下一节。

### ⚠️ nvm-windows 不会自动读 `.nvmrc`

`nvm-windows`(coreybutler 版)长期不支持 `.nvmrc`,所以本仓库**不放**
`.nvmrc`(放了也没用,反而会让人误以为生效了)。

统一版本靠两条真正生效的机制:

1. `package.json` 的 `engines.node` —— 版本不匹配时 npm 会打警告;
2. `package.json` 的 `volta.node` —— 装了 Volta 的同学会自动切到 24.20.0。

用 nvm-windows 的同学请手动执行:

```bash
nvm install 24.20.0
nvm use 24.20.0
```

`nvm use` 在 Windows 上需要重新指向符号链接,若报权限错误请**以管理员身份**打开终端。

---

## 1. 安装依赖

```bash
npm install
```

国内网络已配好镜像(`.npmrc` 里 `registry=https://registry.npmmirror.com`)。

### ⚠️ npm 11 会拦 install script,已经处理过了但你要知道

npm 11 默认不再自动执行依赖的安装脚本。本项目需要跑脚本的两个包已在
`package.json` 的 `allowScripts` 里显式放行:

- `esbuild` —— 下载平台原生二进制,不放行则 Vite 起不来;
- `vue-demi` —— pinia 依赖它按 Vue 版本切换入口。

如果你新增了带 install script 的依赖,`npm install` 后会看到
`packages have install scripts not yet covered by allowScripts` 的警告。
**确认包可信**后再执行:

```bash
npm install-scripts approve <包名>
```

### ⚠️ 为什么 `.npmrc` 里有 `legacy-peer-deps=true`

一句话:npm 11 会尝试满足 pinia 那个 optional 的 Vue-2 peer
(`@vue/composition-api`,要求 vue < 2.7),而 uni-app 把 Vue 钉在 3.4.21,
于是报 ERESOLVE。**这不是真的不兼容**,运行时走的是 Vue 3 分支。

代价是本项目关闭了 peer 严格校验 —— 引入新依赖前自己确认 peer 满足,
别指望 npm 替你报错。完整推导见 [FAQ.md](FAQ.md)。

---

## 2. 先验证空项目能构建

```bash
npm run build:mp-weixin
```

看到 `DONE Build complete.` 才继续。这一步是为了把"环境问题"和
"你写的代码的问题"分开 —— 以后遇到构建失败,先想这一步当时是不是过了。

---

## 3. 导入微信开发者工具

```bash
npm run dev:mp-weixin        # 保持这个进程运行,它会监听改动
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

| 包                          | 锁定                     | 为什么不能动                                                     |
| --------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `vite`                      | `5.2.8`                  | npm 最新是 8.x,与 uni-app 插件不兼容                             |
| `@dcloudio/vite-plugin-uni` | `3.0.0-5020420260813003` | npm 的 `latest` tag 指向 **2021 年**的废 alpha,`npm i -D` 会装错 |
| `vue`                       | `3.4.21`                 | `@dcloudio/uni-app` 硬依赖 `@vue/shared@3.4.21`                  |
| `typescript`                | `^4.9.4`                 | 与 `vue-tsc@^1.0.24` 配套;单独升 TS 会让 type-check 挂           |
| `vue-tsc`                   | `^1.0.24`                | 同上                                                             |
| `pinia`                     | `2.2.4`                  | 2.2.5 起要求 Vue ≥3.5.11,与 uni-app 冲突                         |
| `@tdesign/uniapp`           | `0.10.3`                 | pre-1.0,不加 `^`,升级只改 `components/` 包装层                   |

要升任何一个,必须同时验证:`npm run type-check` + `npm run build:mp-weixin`

- 开发者工具真机预览三件事都过。
