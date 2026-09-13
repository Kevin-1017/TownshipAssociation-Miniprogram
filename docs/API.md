# 接口契约

这份文档是 `tsa-miniprogram` 与 `tsa-api` 之间的**唯一契约**。
小程序照它 mock,后端照它实现;两边分组开发时不互相阻塞。

代码化的表达在 `src/types/*.d.ts`,**改任何一边都要同步改另一边和这份文档**。

---

## 统一响应壳(不可协商)

```jsonc
{
  "code": 200, // 200 = 成功;其余为业务错误码
  "message": "操作成功", // 失败时给用户的中文提示
  "data": {}, // 载荷;失败时可以为 null
}
```

`src/utils/request.ts` 依赖这个形状做统一拆壳:页面**永远只拿到 `data`**,
不碰 `code`/`message`,也不需要写 `try-catch`。

> 后端(tsa-api)已按此形状实现:`@RestControllerAdvice` 全局异常 +
> 统一 `Result<T>` 包装,HTTP 状态码恒为 200,成败看 `code`。

### 分页结构

```jsonc
{ "list": [], "total": 300, "page": 1, "pageSize": 20 }
```

---

## 错误码

与 `tsa-api` 的 `common/ResultCode.java` 完全一致;业务码 1xxx 起,
按模块分段(成员 10xx / 活动 11xx / 公告 12xx),加码两边同步。

| code   | 含义                              | 前端行为                                                               |
| ------ | --------------------------------- | ---------------------------------------------------------------------- |
| `200`  | 成功                              | 返回 data                                                              |
| `400`  | 参数校验失败                      | toast `message`(内含字段提示)                                          |
| `401`  | 微信登录态失效(未登录/token 过期) | request 层单飞静默重登并重放一次;仍失败才清 token、跳「我的」页、toast |
| `403`  | 已登录但无权限                    | toast 提示                                                             |
| `404`  | 资源不存在                        | toast 提示(后续可优化为空态)                                           |
| `500`  | 服务器内部错误                    | toast「网络异常,请稍后重试」                                           |
| `1001` | 该微信已注册过成员                | toast `message`                                                        |
| `1002` | 数据不存在                        | toast `message`                                                        |
| `1301` | 查看资料仅限乡会会员              | 详情页清本地核验态,显示授权闸门                                        |
| `1302` | 手机号核验失败,请重试             | toast,停留授权按钮可重试                                               |
| `1303` | 微信登录失败,请重试               | silentLogin 回 `retryable`,只提示稍后重试,**不清登录态**               |
| `1306` | 操作过于频繁(登录/核验限频)       | 同 1303:可重试,不是登录失效,不清登录态                                 |

---

## 鉴权

```
POST /tsa/auth/wechat-login        // 第一期已上线(原「二期实现」)
  body: { "code": "<wx.login 拿到的 code>" }
  200 : { "token": "<Sa-Token 令牌>", "user": MemberDetail | null }  // user:null = 已登录未建档
  错误: 400(code 为空)/ 1303(微信侧换码失败)/ 1306(限频 10 次/分/IP)

POST /tsa/auth/verify-phone          // 乡会身份核验(一期已上线;限频 5 次/分/IP → 1306)
  body: { "code": "<getPhoneNumber 按钮的动态 code>" }
  200 : { "verified": true, "token": "<乡会令牌>", "name": "...", "role": "..." }  // 命中名册
  200 : { "verified": false }         // 未命中名册 —— 正常业务结果,不是错误

POST /tsa/auth/logout                // 本期新增:服务端注销
  header: Authorization: Bearer <token>(可选;无 token 也幂等 200)
  200 : null                          // 只注销当前 Bearer 会话,assoc 会话(loginId 不同)不受影响
```

- 后端用 `code` 调微信 `jscode2session` 换 `openid`(session_key 就地丢弃、不落库不下发),
  再 `StpUtil.login(openid)` 签发登录态;`user` 为该 openid 已建档的乡贤档案,可为 null;
- **两个 code 不是同一个**:`wechat-login` 用 `wx.login` 的 code;`verify-phone` 用
  `<button open-type="getPhoneNumber">` 回调里的动态 code(5 分钟有效、严格一次性,
  禁止缓存/重试同一 code);
- **`/tsa/user/** 起需登录**:`Authorization: Bearer <token>`。401 = 微信会话失效,
由前端 request 层**静默重登 + 重放一次**兜住(单飞去重),救不回才清态跳「我的」页;
身份类失败仍是 1301 语义不变(X-Assoc-Token 体系)。loginId 以 `assoc-` 开头的
  令牌冒充 Bearer 一律按 401 拒绝;
- 登录/核验限频为**内存实现**(单实例假设);反代部署必须配 `forward-headers-strategy`;
- `verify-phone` 核验成功后下发的 `token` 放 **`X-Assoc-Token`** 请求头访问受限资源
  (成员详情);令牌失效/伪造统一返回 1301(**绝不出 401** —— 401 归微信登录态语义,
  会触发前端静默重登,两套身份不许互踩);
- 手机号核验依赖微信 getuserphonenumber 接口,要求小程序为**企业认证主体**
  (个人主体无权限);后端本地联调有 `WECHAT_MOCK_MODE` 逃生通道(把 code 原样当手机号);
- **`AppSecret` 只存在于服务端**,绝不下发给前端;
- 前端把 `token` 存本地,之后每个请求带 `Authorization: Bearer <token>`
  (后端 Sa-Token 已按此读取:token-name=Authorization, token-prefix=Bearer);
- mock 阶段 wechat-login **不校验 code、直接发假 token**(`mock-token-for-development-only`),
  但 `/tsa/user/**` 两个受保护路由会校验这枚 Bearer 并回 401 壳 ——
  「401 → 静默重登 → 重放」全链路在 mock 下同样可演练。

### 登录态时效(7 天,以及为什么 `wx.checkSession` 不参与判定)

- 后端签发的登录会话时效 **7 天**(Sa-Token `timeout`,yml 一行配置)。会话目前存在
  后端进程内存里(Redis 二期),**后端重启 = 全员 token 失效** —— 这由前端 401 自愈吸收,
  用户无感,不需要为此提前做什么。
- 这枚 token 才是「你是谁」到达 tsa-api 的凭证;微信自带的会话体系(`wx.checkSession`、
  `session_key`)管的只是「加密数据(如手机号)解密密钥」的生命周期 —— 本项目从不下发
  也不留存 session_key,请求到达后端时微信**不会**替我们标注调用者是谁,
  token→openid 映射必须我们自己持有(Sa-Token 现成能力,本期新增代码≈0)。
- 所以 **401 是登录态失效的唯一权威信号**,`checkSession` 无判定权,前端不调它做登录态
  辅助校验(v1.1 已论证并拒绝该方案)。失效后由 request 层自动 `wx.login` →
  `POST /tsa/auth/wechat-login` 换新 token 并重放原请求(单飞,并发 401 只重登一次);
  连换码也失败才清态跳「我的」页。
- 将来管理系统复用同一套 Sa-Token(loginId 加 `admin-` 前缀),与 openid / `assoc-`
  三个命名空间互斥,不另起炉灶。

---

## 成员

```
GET /tsa/members/map-data
  → MemberMapPoint[]                     // 地图专用,不分页
```

只返回渲染必需的 8 个字段(`id name avatarUrl lat lng province city industry`)。
**后端 SQL 只 SELECT 这些列** —— 300 人时全字段与投影差 4~5 倍体积,
再涨到几千人时这个接口必须保持轻量。

```
GET /tsa/members
  query: page, pageSize, province, city, industry, keyword
  → PageResult<MemberListItem>

GET /tsa/members/{id}               // 乡会用户专享
  header: X-Assoc-Token            // verify-phone 核验成功后签发,缺失/失效返回 1301
  → MemberDetail

GET /tsa/members/stats/province       // 公开免 token;第一期已上线(原「二期实现」)
  → ProvinceStat[]                       // [{ province, count }],按 count 降序
  // 统计口径:member 表 status=1(审核通过)且 deleted=0,GROUP BY province
```

### 隐私(后端必须落实)

**1301 闸门(行级)**:成员详情只对乡会用户开放 —— 前端本地已核验时不发注定失败的
请求(直接亮授权闸门),但**服务端必须独立裁决**,前端核验态只是 UI 捷径。

**contactVisible 裁剪(字段级)**:

`MemberDetail.contactVisible` 为 `false` 时,**后端必须把 `wechatId`、`phone`
字段从响应里剔除**,而不是返回出去让前端隐藏。

抓包就能看到未脱敏的数据 —— 前端的 `v-if` 拦不住任何人。
**mock 与真实后端行为一致**：mock 的 members/{id} 路由同样按 contactVisible 剔除字段,
并校验 X-Assoc-Token(无/不匹配返回 1301)。

---

## 活动

```
GET /tsa/events      query: page(默认1), pageSize(默认10,钳 1..50), year(可选,4位年份,按 start_time 年) → PageResult<EventListItem>
GET /tsa/events/{id}                                                        → EventDetail   // 查无 code=1002
```

- **正文不进小程序**(D2 定案):列表 `EventListItem = { id,title,cover,summary,startTime,status }`;
  详情只多一个 `articleUrl`(公众号文章永久链接 `https://mp.weixin.qq.com/s/xxx`,
  未整理则为 null)。小程序端用 `wx.openOfficialAccountArticle` 在点击回调内同步拉起
  微信原生文章页;低版本/失败兜底复制链接。
- `cover`/`summary`/`articleUrl` 为 `string | null`,`null` 时前端渲染占位/置灰按钮。
- `status` 只有 `upcoming | past` 两态,**由服务端比较 start_time 与当前时间派生**(不落库),
  不要让前端比时间 —— 客户端时间不可信。列表排序 `start_time DESC`。
- **报名接口已撤**(`POST /tsa/events/{id}/register` 不再存在):本期不做报名,
  activity_registration 表继续闲置;名额并发/幂等等真做报名再议。

---

## 公告

```
GET /tsa/notices      → NoticeItem[]    // 置顶由后端排好序返回,不分页
GET /tsa/notices/{id} → NoticeItem      // 不存在返回 code=1002
```

`NoticeItem`:`id title summary content publishedAt pinned(boolean)`。
`summary` 是列表摘要(后端表列,发布时填写);`pinned` 由后端把 0/1 转成布尔。

`content` 当前是**纯文本含 `\n`**,前端用 `white-space: pre-wrap` 渲染。
将来若要支持加粗/图片,后端返回受限 HTML,前端必须改用 `<rich-text :nodes>` ——
小程序里没有 `v-html`。

---

## 基金会

```
GET    /tsa/foundation               → { rewards: FoundationRewardItem[], donations: FoundationDonationItem[] }
GET    /tsa/foundation/rewards       → { categories: string[], records: RewardRecord[] }   // 详情页 tab0
GET    /tsa/foundation/donations     → DonationRecord[]                                     // 详情页 tab1,按日期倒序
```

- `FoundationRewardItem`: `id label amount sponsor`;`RewardRecord`: `id categoryId categoryName recipient amount`;
  `FoundationDonationItem` / `DonationRecord`: `id donorName amount date`
- **`amount` 单位为元**(与 mock 数值一致,前端 `formatAmount` 负责展示格式化)
- 管理端写接口(一期不鉴权,管理后台二期收口):`POST/PUT/DELETE /tsa/foundation/{categories|records|donations}[/{id}]`
- 删除奖项类别会连带软删其下的获奖记录

---

## 社区动态（前端已删除 · 后端接口保留备回归）

> **2026-09-12**：个人主体小程序不可提供「用户发布且他人可浏览」的 UGC 功能
> （《微信小程序平台运营规范》5.7.1 主体未开放类目）。前端相关代码**已整体删除**：
> `api/community.ts`、`types/community.d.ts`、mock 路由与数据、列表/详情/发布/点赞/评论页面与路由注册
> （git 历史可找回）。广场 tab 三入口改为**编辑部官方采编的只读内容**（美食图鉴/校园资讯/流年志），不调用下列任何接口。
> **tsa-api 侧五个接口刻意保留**（含存量数据），主体变更 + 报备【社交-社区/论坛】类目后，按本节契约重建前端即可回归。

```
GET  /tsa/community/posts       query: page,pageSize,type,cuisine,region,keyword → PageResult<CommunityPost>
GET  /tsa/community/posts/{id}                                                  → CommunityPost(含 commentsList)
POST /tsa/community/posts       body: CommunityPostPayload                      → string(新动态 id)
POST /tsa/community/posts/{id}/like                                             → number(点赞后总数)
POST /tsa/community/posts/{id}/comments  body: CommentPayload                   → CommentItem
```

- `type` 为 `food`/`campus`;`cuisine`/`region` 仅美食动态携带
- **一期无登录**:发布与评论的 `author` 为表单自由填写的昵称(前端默认取 `userStore.displayName`);
  点赞只做计数 +1,不支持取消
- 列表接口**不下发** `commentsList`(只给派生的 `comments` 计数);详情接口才带评论树
- 无 `id` 命中详情/点赞/评论时返回 `code=1002`

---

## 当前用户

```
GET /tsa/user/me        header: Authorization: Bearer → MemberDetail | null
  // null = 已登录但没建档(本期所有新用户的初始态);未登录/失效/assoc 令牌冒充 → 401 壳
  // 本人视角不裁 phone/wechatId(裁剪只发生在对外详情接口 GET /tsa/members/{id})

PUT /tsa/user/profile   header: Bearer;body: 见下 → MemberDetail(更新后的本人视角档案)
  { "name?","gender?","phone?","wechatId?","graduationYear?","major?","intro?","avatarUrl?" }
```

- 请求体**全部可选,页面只提交改动过的字段**;后端按白名单更新,
  `status/province/city/openid` 不在其列(归属与审核态由秘书处侧维护)。
- openid 由服务端从 Bearer loginId 推导(`assoc-` 前缀拒绝 → 401),请求体没有它;
- **首次提交 → INSERT status=0(待审)+ source=1**;已有行 → 白名单 update。
  秘书处审核工作流本期不做,SQL 改 `status=1` 放行上墙。
- 校验:name≤32、wechatId≤32、major≤64、intro≤200、avatarUrl≤255、
  graduationYear ∈ [1950,2100]、gender ∈ {0,1,2}。

---

## 文件上传

```
POST /tsa/files   header: Bearer;multipart 字段名 "file" → { "path": "/tsa/files/<uuid>.<ext>" }
GET  /tsa/files/{name}   公开,按扩展名回 Content-Type
  // name 必须匹配 ^[0-9a-f-]{32,36}\.[a-z]{3,4}$,否则 404 —— 防目录穿越
```

- ≤2MB,类型白名单 `image/jpeg|png|webp`,超限/不符 → 400「文件超限或类型不支持」;
  POST 路由由 SaRouter 单独锁 Bearer 门(公开只读 GET);
- 文件落**本地磁盘**(配置键 `tsa.files.dir`,默认 `./upload-data`),不落库、不建表;
- `path` 是**相对路径,入库也存它本身**(头像 → `member.avatar_url`),**展示时才**由前端
  `buildFileUrl()` 拼绝对址(见 `src/utils/request.ts`)——API 域名是编译期常量,
  把绝对 URL 写进存量数据,换正式域名(§9.E)时会集体失效;与 tsa-api 侧 FileUploadVO 口径一致。
- 本期消费方:profile 页头像(chooseAvatar 临时路径必须落盘,重启不丢);
  事件封面将来同通道。
- mock 下 `uploadFile()` 直接回显传入的临时路径(不发请求,演练链路用)。

---

## 字段约定

| 约定                                                               | 原因                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 时间一律 **ISO 8601 字符串带时区**(如 `2026-09-27T18:00:00+08:00`) | 数字时间戳没有时区语义;格式化在前端做,后端不返回中文日期                         |
| `id` 是**字符串**(数据库自增主键的字符串形式,如 `"12"`)            | 后端 Long 超过 2^53 时前端 number 会丢精度;字符串也避免 URL 上暴露数字递增可遍历 |
| 字典存 code,不存中文(`industry: "internet"`)                       | 中文改名不动数据;`src/constants/industry.ts` 是映射表                            |
| 坐标字段 `lat` / `lng`,GCJ-02                                      | 微信底图坐标系。见 [TECHNOLOGY.md](TECHNOLOGY.md) §6                             |
| `country` 恒为 `"中国"`,但保留字段                                 | 第二阶段要展示海外潮籍乡亲,现在留字段避免返工                                    |

---

## 版本与前缀

所有接口挂在 `/tsa` 下。**`VITE_API_BASE_URL` 不带 `/tsa`**(如 `http://localhost:8080`),前端代码里
路径以 `/tsa/` 开头,拼接后组成完整地址 `/tsa/...`。`/tsa` 前缀由后端 Controller 的
`ApiConstants.BASE_PATH` 拥有(后端无 `context-path`),base 里再写一次会拼成 `/tsa/tsa/...` 双前缀。

将来官网(React)接入时用的是同一批接口,不改后端 —— 这正是当初
坚持把后端拆成独立仓库的原因。
