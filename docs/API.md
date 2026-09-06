# 接口契约

这份文档是 `tsa-miniprogram` 与 `tsa-api` 之间的**唯一契约**。
小程序照它 mock,后端照它实现;两边分组开发时不互相阻塞。

代码化的表达在 `src/types/*.d.ts`,**改任何一边都要同步改另一边和这份文档**。

---

## 统一响应壳(不可协商)

```jsonc
{
  "code": 0, // 0 = 成功;非 0 为业务错误码
  "message": "ok", // 失败时给用户的中文提示
  "data": {}, // 载荷;失败时可以为 null
}
```

`src/utils/request.ts` 依赖这个形状做统一拆壳:页面**永远只拿到 `data`**,
不碰 `code`/`message`,也不需要写 `try-catch`。

> **Spring Boot 侧请用 `@RestControllerAdvice` 全局包装返回值**,
> 不要让每个 Controller 自己 `new Result(...)`。
> 同时保持 HTTP 状态码为 200(业务错误也用 200 + 非零 code),
> 只有真正的网关/服务不可用才用 4xx/5xx —— 前端对这两类处理路径不同。

### 分页结构

```jsonc
{ "list": [], "total": 300, "page": 1, "pageSize": 20 }
```

---

## 错误码

| code   | 含义                       | 前端行为                     |
| ------ | -------------------------- | ---------------------------- |
| `0`    | 成功                       | 返回 data                    |
| `401`  | 未登录 / token 失效        | 清本地 token,跳「我的」页    |
| `403`  | 已登录但无权限             | toast 提示                   |
| `404`  | 资源不存在                 | 页面显示空态                 |
| `1001` | 参数校验失败               | toast `message`              |
| `1002` | 业务规则不满足(如名额已满) | toast `message`              |
| `5000` | 服务器内部错误             | toast「网络异常,请稍后重试」 |

错误码增量维护:后端新增时在本表加一行,并在 `src/utils/request.ts` 确认默认行为可接受。

---

## 鉴权

```
POST /auth/wechat-login
  body: { "code": "<wx.login 拿到的 code>" }
  200 : { "token": "<JWT>", "user": MemberDetail | null }
```

- 后端用 `code` 调微信 `code2session` 换 `openid`,再查会员表决定身份;
- **`AppSecret` 只存在于服务端**,绝不下发给前端;
- 前端把 `token` 存本地,之后每个请求带 `Authorization: Bearer <token>`;
- mock 阶段该接口**不校验 code、直接发假 token**,只为让 UI 链路走得通,
  不代表鉴权已验证。

---

## 成员

```
GET /members/map-data
  → MemberMapPoint[]                     // 地图专用,不分页
```

只返回渲染必需的 8 个字段(`id name avatar lat lng province city industry`)。
**后端 SQL 只 SELECT 这些列** —— 300 人时全字段与投影差 4~5 倍体积,
再涨到几千人时这个接口必须保持轻量。

```
GET /members
  query: page, pageSize, province, city, industry, keyword
  → PageResult<MemberListItem>

GET /members/{id}
  → MemberDetail

GET /members/stats/province
  → ProvinceStat[]                       // [{ province, count }],按 count 降序
```

### 隐私(后端必须落实)

`MemberDetail.contactVisible` 为 `false` 时,**后端必须把 `wechatId`、`phone`
字段从响应里剔除**,而不是返回出去让前端隐藏。

抓包就能看到未脱敏的数据 —— 前端的 `v-if` 拦不住任何人。
mock 阶段把 phone 全塞进 JSON 只是因为那是假数据,不构成后端的理由。

---

## 活动

```
GET /events            query: page, pageSize, status, city → PageResult<EventListItem>
GET /events/{id}                                              → EventDetail
POST /events/{id}/register                                    → { ok: true }   // 第二阶段
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
GET /notices      → NoticeItem[]    // 置顶由后端排好序返回,不分页
GET /notices/{id} → NoticeItem
```

`content` 当前是**纯文本含 `\n`**,前端用 `white-space: pre-wrap` 渲染。
将来若要支持加粗/图片,后端返回受限 HTML,前端必须改用 `<rich-text :nodes>` ——
小程序里没有 `v-html`。

---

## 当前用户

```
GET /user/me   → MemberDetail | null    // 未登录返回 code=401
```

---

## 字段约定

| 约定                                                               | 原因                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| 时间一律 **ISO 8601 字符串带时区**(如 `2026-09-27T18:00:00+08:00`) | 数字时间戳没有时区语义;格式化在前端做,后端不返回中文日期 |
| `id` 用字符串业务编号(`m0001` / `e001` / `n001`)                   | 不用数据库自增 int 暴露在 URL 上,避免被遍历猜量          |
| 字典存 code,不存中文(`industry: "trade"`)                          | 中文改名不动数据;`src/constants/industry.ts` 是映射表    |
| 坐标字段 `lat` / `lng`,GCJ-02                                      | 微信底图坐标系。见 [MAP.md](MAP.md)                      |
| `country` 恒为 `"中国"`,但保留字段                                 | 第二阶段要展示海外潮籍乡亲,现在留字段避免返工            |

---

## 版本与前缀

所有接口挂在 `/api/v1` 下,由 `VITE_API_BASE_URL` 提供(`…/api/v1`)。
**代码里不出现 `/api/v1` 字符串**,只写 `/members`。

将来官网(React)接入时用的是同一批接口,不改后端 —— 这正是当初
坚持把后端拆成独立仓库的原因。
