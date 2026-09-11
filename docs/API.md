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

| code   | 含义                       | 前端行为                     |
| ------ | -------------------------- | ---------------------------- |
| `200`  | 成功                       | 返回 data                    |
| `400`  | 参数校验失败               | toast `message`(内含字段提示) |
| `401`  | 未登录 / token 失效        | 清本地 token,跳「我的」页    |
| `403`  | 已登录但无权限             | toast 提示                   |
| `404`  | 资源不存在                 | toast 提示(后续可优化为空态) |
| `500`  | 服务器内部错误             | toast「网络异常,请稍后重试」 |
| `1001` | 该微信已注册过成员         | toast `message`              |
| `1002` | 数据不存在                 | toast `message`              |
| `1301` | 查看资料仅限乡会会员       | 详情页清本地核验态,显示授权闸门 |
| `1302` | 手机号核验失败,请重试     | toast,停留授权按钮可重试     |

---

## 鉴权

```
POST /tsa/auth/wechat-login          // 二期实现
  body: { "code": "<wx.login 拿到的 code>" }
  200 : { "token": "<Sa-Token 令牌>", "user": MemberDetail | null }

POST /tsa/auth/verify-phone          // 乡会身份核验(一期已上线)
  body: { "code": "<getPhoneNumber 按钮的动态 code>" }
  200 : { "verified": true, "token": "<乡会令牌>", "name": "...", "role": "..." }  // 命中名册
  200 : { "verified": false }         // 未命中名册 —— 正常业务结果,不是错误
```

- 后端用 `code` 调微信 `code2session` 换 `openid`,再查会员表决定身份;
- **两个 code 不是同一个**:`wechat-login` 用 `wx.login` 的 code;`verify-phone` 用
  `<button open-type="getPhoneNumber">` 回调里的动态 code(5 分钟有效、严格一次性,
  禁止缓存/重试同一 code);
- `verify-phone` 核验成功后下发的 `token` 放 **`X-Assoc-Token`** 请求头访问受限资源
  (成员详情);令牌失效/伪造统一返回 1301(**不是 401** —— 401 会触发前端
  「清登录态跳我的页」,语义错乱);
- 手机号核验依赖微信 getuserphonenumber 接口,要求小程序为**企业认证主体**
  (个人主体无权限);后端本地联调有 `WECHAT_MOCK_MODE` 逃生通道(把 code 原样当手机号);
- **`AppSecret` 只存在于服务端**,绝不下发给前端;
- 前端把 `token` 存本地,之后每个请求带 `Authorization: Bearer <token>`
  (后端 Sa-Token 已按此读取:token-name=Authorization, token-prefix=Bearer);
- mock 阶段该接口**不校验 code、直接发假 token**,只为让 UI 链路走得通,
  不代表鉴权已验证。

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

GET /tsa/members/stats/province
  → ProvinceStat[]                       // [{ province, count }],按 count 降序
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
GET /tsa/events            query: page, pageSize, status, city → PageResult<EventListItem>
GET /tsa/events/{id}                                              → EventDetail
POST /tsa/events/{id}/register                                    → { ok: true }   // 第二阶段
```

`EventListItem` 不含 `content`/`lat`/`lng`/`organizer`/`contactPhone`;
只有详情接口返回。列表页不需要富文本正文,下发它是纯浪费。

`status` 枚举:`upcoming | ongoing | past | cancelled`。
**由服务端计算并返回**,不要让前端比较时间 —— 客户端时间不可信。

第二阶段做报名时必须处理:名额并发扣减(数据库唯一约束或 Redis 原子操作)、
重复提交幂等(同一会员同一活动只能有一条报名记录)。

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

## 社区动态(美食基地 / 校园广场)

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
GET /tsa/user/me   → MemberDetail | null    // 未登录返回 code=401
```

---

## 字段约定

| 约定                                                               | 原因                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| 时间一律 **ISO 8601 字符串带时区**(如 `2026-09-27T18:00:00+08:00`) | 数字时间戳没有时区语义;格式化在前端做,后端不返回中文日期 |
| `id` 是**字符串**(数据库自增主键的字符串形式,如 `"12"`)            | 后端 Long 超过 2^53 时前端 number 会丢精度;字符串也避免 URL 上暴露数字递增可遍历 |
| 字典存 code,不存中文(`industry: "internet"`)                       | 中文改名不动数据;`src/constants/industry.ts` 是映射表    |
| 坐标字段 `lat` / `lng`,GCJ-02                                      | 微信底图坐标系。见 [TECHNOLOGY.md](TECHNOLOGY.md) §6     |
| `country` 恒为 `"中国"`,但保留字段                                 | 第二阶段要展示海外潮籍乡亲,现在留字段避免返工            |

---

## 版本与前缀

所有接口挂在 `/tsa` 下。**`VITE_API_BASE_URL` 不带 `/tsa`**(如 `http://localhost:8080`),前端代码里
路径以 `/tsa/` 开头,拼接后组成完整地址 `/tsa/...`。`/tsa` 前缀由后端 Controller 的
`ApiConstants.BASE_PATH` 拥有(后端无 `context-path`),base 里再写一次会拼成 `/tsa/tsa/...` 双前缀。

将来官网(React)接入时用的是同一批接口,不改后端 —— 这正是当初
坚持把后端拆成独立仓库的原因。
