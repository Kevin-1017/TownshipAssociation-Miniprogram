# 第一期微信登录落地方案 — v1.1(对抗核验修订版)

> 2026-09-13 由 workflow「wx-login-plan」15 个 agent 产出:4 路调研 → 最小改动/安全稳健/体验优先三方案 → 综合 → 逐断言证伪。
> 32 条断言:25 条通过、7 条被证伪;批评者提出 10 gaps + 7 mustFix。
> **实施以本修订 + 下方原计划共同为准;两处冲突时,以修订为准。**

## 修订(v1.1,实施必须照改)

### A. 必改的逻辑修复(mustFix)
1. 【§2/F1/F3】`silentLogin` 增加 `force` 语义:401 自愈入口必须调 `silentLogin({ force: true })` 跳过 isLogin 快路径。原因:`stores/user.ts:23` 的 isLogin 只判 storage 有无 token——后端重启后旧 token 还在,快路径秒回 true,重放用的还是同一枚死 token,自愈必坏(原计划 §9.10 的「无感自愈」按字面设计不可能成立)。快路径只保护「主动登录」场景。
2. 【§2/F1】401 自愈失败分支一律走 store 清理(新增 `clearToken()`,ref+storage 一并清),**禁止** request 层直接 `removeStorageSync(TOKEN_KEY)`。原因:`setToken` 是 ref+storage 双写,只清 storage 则 isLogin 恒真 → profile 硬门形同虚设 → 每个受保护请求循环「重登(快路径)→重放→401→toast+switchTab」。
3. 【F2/F3】`authApi.wechatLogin` 必须静默:`showLoading:false` + `silentError:true`(或新增 silent 变体)。原因:`request.ts:98-100,114` 的 toast/loading 发生在 silentLogin 的 catch **之前**,USE_MOCK=false 且后端未起时每次冷启必炸脸,与「失败仅 console.warn」直接矛盾。
4. 【F3/§2】`silentLogin` 返回值三态:`'ok' | 'retryable'(1303/1306 壳码) | 'invalid'`。仅 invalid 清态+switchTab+失效 toast;retryable 只 toast「稍后重试」不清态——1306 是限频,当登录失效处理会误导用户。
5. 【F6】`profile.vue:88` 的 `loadProfile()` 现在是 `<script setup>` **顶层调用**,不在 onLoad 里——只在 onLoad 加守卫拦不住它。改:移进 onLoad 守卫成功分支;`onSubmit :116-117` 的 `user.profile!.name=...` 在「已登录无档案」(=本期所有新用户)必 TypeError 白屏,先判 `!user.profile` 则只写本地 form+提示未建档,绝不写 `profile!`。
6. 【B3】prod fail-fast 守卫按原条件(「active 含 prod」)是**永不触发的死代码**:`application.yml:11` 写死 `active: dev`,全仓库无 application-prod.yml,Dockerfile/docker-compose 都不设 profile——生产就是 dev 裸跑。改条件为:「active profile ∉ {dev,test} 且任一 mock 开关为 true → 拒绝启动」,同时部署脚本强制 `SPRING_PROFILES_ACTIVE=prod`(进 §9.E 清单)。
7. 【§0/§4 新增 B16】登录上线会把 `POST /tsa/members` 从死接口变成钓鱼通道:`MemberSaveRequest:26-28` openid 客户端自报 + `MemberServiceImpl:89-90` 按它查重 → 任何人可对任意 openid(含 `mock-openid-local`)预插假档案,受害者 user/me 本人视角不裁,攻击者数据被当成本人资料回填展示。本期就改:register 的 openid 从 Bearer loginId 推导、请求体删 openid 字段(前端零调用,回归面≈0),别等决策#1。
8. 【B12】限频 `getRemoteAddr()`:一旦套 nginx,全体用户共享一个桶,10/分≈全球限流。处理:文档写明「直连/dev 用 remoteAddr;反代部署必配 `server.forward-headers-strategy`」,application.yml 加注释掉的策略开关;§9.E 清单加对应核验项。

### B. 证伪澄清(方案不变,引用原文时别把下面几处当「现状」)
9. 「assoc token 塞 Bearer → 401」**不会自动发生**:assoc 会话是同一 StpUtil 体系签发的合法会话(`AuthServiceImpl:48`),而 `application.yml:37-38` token-name=Authorization + prefix=Bearer 会把它当正常登录态读取,单纯 `checkLogin()` 放行——B8 `currentUser()` 里「loginId 以 assoc- 开头 → 抛 NotLoginException」是必写代码且是唯一防线(与「assoc 链路零改动」不冲突,改动全在登录侧)。
10. `POST /tsa/auth/logout` 是**全新端点**(后端 grep logout 零命中;前端 auth.ts:39-42 现状是纯本地清、注释明写「不需要请求后端」)。原计划「logout 维持现有语义」的说法不成立:这是契约级新增,须同步 api/auth.ts、mock 路由、两份 API.md;B14 补 logout 用例,「无 token 幂等 200」是对 Sa-Token 行为的未验证假设,要实测;is-concurrent:true + is-share:false 下 StpUtil.logout 只注销当前 token、同 openid 旧 token 服务端滞留(本期可接受,文档交代)。
11. 「1301 由页面 catch」目前**只存在于注释**:member/detail.vue 是 29 行占位页,`memberApi.getDetail` 与 `clearAssoc` 全仓库零调用点。本期无调用方=1301 无人消费(可接受),C 路重建详情页时 catch+clearAssoc 接线是该页前置,写进 §10 防止后人误以为已有保护。
12. §7「13 页」是计数笔误:口径应为 15 注册页 − mine/index − mine/profile = 13(含 detail/privacy/agreement),实质结论(所列页零身份依赖)经逐页核实为真。另:「no-login」≠「现状可用」——`event/list.vue:28` 静态 import mock/events.json,生产构建会带假事件数据(「联调三大坑」同款),处置随决策 C(见 userDecisions #4)。
13. F9/§9 文档同步措辞修正:wechat-login(tsa-miniprogram/docs/API.md:57-59 注「二期实现」)、user/me(:201-203)、stats/province(:104-105)在小程序侧文档**已存在**,该文件是「改口径」非「新增」;真正双份新增的只有 logout 与 1303/1306;改 tsa-api/docs/API.md 推迟清单 :92-98 时须连 :96 一并改写(stats/province 本期落地;map-data 那行早已过期——后端 MemberController:52-55 已实现)。

### C. 批评者 gaps(补进验收与 TODO)
14. 真机前提补进 §9.D:`.env.development.local` 写开发机局域网 IP(.env.development 头注释预留该机制)+ 开发者工具勾「不校验合法域名」——否则真机访问不到 localhost。
15. §9.E 提审清单加:MP 后台「用户隐私保护指引」同步(chooseImage 属隐私接口、本期新增 openid 收集,不同步线上会调用失败/驳回)。
16. mock 层补 `user:null` 开关:现状 mock wechat-login/user-me 恒回 members[0],「已登录无档案」这个本期核心态在全 mock 验收(§9.12)演练不到;与 F8 并列做。
17. B14 的 standalone MockMvc 范式有意绕开 Sa-Token 拦截器(现有测试类注释自证),故 /tsa/user/** 的 401、assoc- 拒绝、1306 在 CI **零覆盖**——要么补一个 @SpringBootTest 切片,要么在 B14 注释里明写「此三项仅靠 §9 curl 手工覆盖」。

---

## 原计划(workflow 综合稿,与上文修订冲突处以修订为准)

# 最终落地计划:第一期「openid 静默登录主干 + 双身份隔离 + 401 自愈」

合并基准:以【最小改动】方案为主干(不建幽灵成员行、零 DDL、受保护面只圈 `/tsa/user/**`、公开接口零回归),吸收【安全稳健】的 mock 独立开关+生产 fail-fast、/tsa/auth/** 限频、NoResourceFoundException→404 拆伪装层,吸收【体验优先】的 401 静默重登+单飞+单次重放、displayName 三态、mock 双模式对称、首页 Promise.all 拆雷。仓库根:`D:/Kevin/项目/TownshipAssociation/`(`tsa-api/`、`tsa-miniprogram/`),下文证据一律 `相对路径:行号`。

## 0. 一句话范围
后端新增 4 个真端点(`POST /tsa/auth/wechat-login`、`POST /tsa/auth/logout`、`GET /tsa/user/me`、`GET /tsa/members/stats/province`)+ 1 条拦截规则 + 3 个防事故件;前端把登录从 mine 页写死 `'mock-code'` 的假按钮(`tsa-miniprogram/src/pages/mine/index.vue:54`)升级为 App 冷启动静默登录 + request 层 401 自愈;verify-phone/X-Assoc-Token/1301 链路(`AuthServiceImpl.java:39-78`、`MemberServiceImpl.java:103-133`)**零改动**;member/detail 占位页本期不重建。

## 1. 身份模型(两把钥匙,一期定稿)
| 身份 | 载体 | loginId | 签发 | 失败语义 |
|---|---|---|---|---|
| 微信登录态(本期新增) | `Authorization: Bearer <token>`(Sa-Token 装配已对齐:`application.yml:37-38`) | **裸 openid** | `POST /tsa/auth/wechat-login` → `StpUtil.login(openid)` | 401(触发前端静默重登重放) |
| 乡会核验(已有,不动) | `X-Assoc-Token: <裸token>`(不带 Bearer 前缀,`AuthServiceImpl.java:64` 直读) | `"assoc-" + association_member.id`(`AuthServiceImpl.java:33,48`) | `POST /tsa/auth/verify-phone` | 一律 1301,绝不出 401(`AuthServiceImpl.java:66-68`) |

- 命名空间天然隔离:openid 不以 `assoc-` 开头,`ensureAssoc` 的 startsWith 检查(`AuthServiceImpl.java:70`)互不误认;反向防御在 `GET /tsa/user/me`:若 Bearer 解析出的 loginId 以 `assoc-` 开头 → 抛 `NotLoginException`(→401),防 assoc 令牌冒充登录态。
- **首登无档案不建 member 行**:`member` 表 `name/province/city NOT NULL`(`sql/schema.sql:25,30,31`),占位行需要假值且会打死注册链路(`MemberServiceImpl.java:91-93` 的 1001 查重,见 rejectedIdeas)。契约:`LoginResult.user` 与 `GET /tsa/user/me` 的 `data` 允许 null——前端类型本就兼容(`tsa-miniprogram/src/api/auth.ts:7,37`;`tsa-miniprogram/docs/API.md:202`)。
- 会话仍存 JVM 内存(Redis 二期,pom 注释):后端重启全员 token 失效 → 由前端 401 自愈吸收(§5)。
- `AuthServiceImpl.java:21-24` 注释原设想"二期 loginId=member.id",本期实现与注释冲突处以本计划为准,同步改注释;是否将来迁移列 userDecisions #2。

## 2. 端到端时序
```
App 冷启动
 └─ App.vue onLaunch(现空:src/App.vue:3-5)
     ├─ setReloginHandler(fn) → fn 委托 userStore.silentLogin()   [注入点,避免 request→store 循环 import]
     └─ if (!user.isLogin) void user.silentLogin()                [不 await、不阻塞首屏、失败仅 console.warn]
          └─ USE_MOCK=true → loginWithCode('mock-code')(mock 路由 src/mock/index.ts:250-254 已有)
             USE_MOCK=false → uni.login(success 回调取 code)      [回调式锁死返回形状,同 request.ts:52-58 教训]
               └─ POST /tsa/auth/wechat-login {code}  (无 Authorization)
                   └─ AuthController.wechatLogin
                       ├─ @Valid:code 空 → 400
                       ├─ 限频拦截器(/tsa/auth/**,IP 窗口)超限 → 1306
                       ├─ WechatClient.exchangeOpenid(code)
                       │    ├─ login-mock-mode=true → openid="mock-openid-local"(固定常量,严禁由 code 派生——wx.login code 每次新)
                       │    └─ 真:GET api.weixin.qq.com/sns/jscode2session?appid&secret&js_code&grant_type=authorization_code
                       │         (不需 access_token;errcode≠0 或 openid 空 → 1303;session_key 就地丢弃,不落库不下发)
                       ├─ memberMapper.selectOne(eq openid)(@TableLogic 自动滤 deleted)→ 可为 null
                       ├─ StpUtil.login(openid) → token = StpUtil.getTokenValue()(uuid,7天,application.yml:39,43)
                       └─ 200 {token, user: null | MemberDetailVO}
                   └─ 前端 setToken → storage 'tsa_token'(stores/user.ts:59-62 唯一写点)+ profile.value=res.user

任意后续请求
 └─ request() → rawRequest 固定拼 Authorization: Bearer <storage 现读>(request.ts:62,69)
     └─ 命中受保护路由 /tsa/user/** → SaRouter checkLogin → 未登录/重启失效 → 200 壳 code=401
         └─ unwrap 抛 ApiError(401)【不再即时清态跳转】
             └─ request 层:非 /tsa/auth/** 且未重试过 → reloginPromise ??= reloginHandler()(单飞去重,
                N 个并发 401 只触发一次 wx.login+一次 wechat-login)→ 成功 → 原请求重放一次(rawRequest
                每次从 storage 现读 token,自动带新值)→ 仍失败 → removeStorageSync(TOKEN_KEY) +
                switchTab('/pages/mine/index') + toast(非 silentError)

路由门(profile)
 └─ onLoad → 未登录则 await silentLogin() 自救一次 → 仍失败 → toast「请先登录」+ navigateBack
```

## 3. 接口契约

### 3.1 POST /tsa/auth/wechat-login(公开,限频 10 次/分/IP)
请求 `{"code": "wx.login 返回值,@NotBlank,≤128 字符"}`。响应(HTTP 恒 200,看 code):
```json
{ "code": 200, "message": "操作成功", "data": { "token": "uuid-串", "user": null } }
```
`user` 非空时为 `MemberDetailVO`(`tsa-api/src/main/java/com/tsa/api/dto/MemberDetailVO.java`,id 字符串序列化、时间带时区,与前端 `types/member` 1:1);本人视角不裁 phone/wechatId。错误:`400` code 为空(message 含「登录凭证」)、`1303` 微信登录失败请重试(code 无效 40029/40163、被风控 40226、appid/secret 未配、上游异常统一此码,真实 errcode 只进日志)、`1306` 操作过频。幂等:同一 code 重放必 40029→1303,前端永不缓存/重发 code。

### 3.2 GET /tsa/user/me(受保护:/tsa/user/** checkLogin)
200 → `{"code":200,"data": MemberDetailVO | null}`(null=已登录未建档);401 未登录/token 失效/loginId 为 assoc- 前缀。无参数、无路径变量。

### 3.3 POST /tsa/auth/logout(无需守卫,前端静默调用)
200 `data:null`;服务端 `StpUtil.logout()` 仅注销当前 Bearer 会话,**assoc 会话(loginId 不同)不受影响**;无 token 时幂等 200。

### 3.4 GET /tsa/members/stats/province(公开)
200 → `data: [{"province":"广东省","count":12}, ...]`(仅 status=1;契约已在 mock 存在 `tsa-miniprogram/src/mock/index.ts:187`,前端消费方 `src/types/member.d.ts:65 ProvinceStat`、`src/api/member.ts:49`、首页 `src/pages/index/index.vue:67`、我的页 `src/pages/mine/index.vue:79`)。

### 3.5 状态码增量(tsa-api/src/main/java/com/tsa/api/common/ResultCode.java,现止于 :38 的 1302)
`1303 WECHAT_LOGIN_FAILED("微信登录失败,请重试")`、`1306 TOO_MANY_REQUESTS("操作过于频繁,请稍后再试")`。1301/1302 语义不动。

## 4. 后端改动文件清单(tsa-api)
| # | 文件 | 改动 |
|---|---|---|
| B1 | `src/main/java/com/tsa/api/client/WechatClient.java` | 加 `String exchangeOpenid(String jsCode)`;javadoc 写明此 code 与 `exchangePhone` 的 code 不通用(呼应 :14-17 既有警示),失败统一 1303 |
| B2 | `src/main/java/com/tsa/api/client/impl/WechatClientImpl.java` | 实现 exchangeOpenid:复用构造器已建 RestClient 与 3s/5s 超时(:67-73)与已注入 appId/appSecret(:58-59),GET `/sns/jscode2session`(不经 `/cgi-bin/token`,不碰 :135-174 缓存);新私有 record `Code2SessionResponse(@JsonProperty("openid") String openid, @JsonProperty("session_key") String sessionKey, Integer errcode, String errmsg)`;session_key 显式丢弃+注释(官方禁令);mock 分支走**新独立键** login-mock-mode 返回固定 `"mock-openid-local"`+log.warn;空凭据/errcode≠0/openid 空 → `BusinessException(WECHAT_LOGIN_FAILED)`,errcode 进 log.error(对照 :140-143 写法) |
| B3 | 同 B2 文件 | 注入 `Environment`,加 `@PostConstruct` 守卫:active profiles 含 `prod` 且 (mockMode || loginMockMode) → 启动失败(把「mock 带上线=身份体系归零」从注释自觉变成机制拦截) |
| B4 | `src/main/java/com/tsa/api/common/ResultCode.java` | +1303、+1306(:38 之后,13xx 段) |
| B5 | `src/main/java/com/tsa/api/common/GlobalExceptionHandler.java` | 加 `@ExceptionHandler(NoResourceFoundException.class)` → `Result.fail(NOT_FOUND)`,终结 Boot 3.5 资源处理器 miss 落 :61-65 catch-all 伪装成 HTTP200+500 的陷阱(现 :55-58 只接 NoHandlerFoundException) |
| B6 | `src/main/java/com/tsa/api/dto/WechatLoginRequest.java`(新)、`dto/LoginVO.java`(新) | 请求 `{@NotBlank(message="登录凭证不能为空") String code}` 镜像 `VerifyPhoneRequest.java:12-17`;LoginVO{token, MemberDetailVO user}+静态工厂,**类上不加 NON_NULL**(Result 无 @JsonInclude,`data.user:null` 要出现在 JSON 里) |
| B7 | `src/main/java/com/tsa/api/service/AuthService.java` | +`LoginVO wechatLogin(String jsCode)`、+`MemberDetailVO currentUser()`(可 null)、+`void logout()`;更新 :8-10 前缀规划注释(loginId=裸 openid vs assoc-) |
| B8 | `src/main/java/com/tsa/api/service/impl/AuthServiceImpl.java` | **注入 `com.tsa.api.mapper.MemberMapper`,严禁注入 MemberService**(MemberServiceImpl.java:49 已反向注入 AuthService,构造器循环依赖 Spring Boot 3.5 默认启动失败;Service→Mapper 合法,参照 docs/API.md:100-108 模板)。wechatLogin 按 §2 时序;currentUser:`StpUtil.getLoginIdDefaultNull()`→null 或 assoc- 前缀 → `throw NotLoginException`→由 :49-52 转 401;否则按 openid 查 member 投影(查无 return null);私有 `toOwnDetail(Member)`:copy 时剔除 phone/wechatId/contactVisible 后本人视角全量回填(参考 MemberServiceImpl.java:116-122 的 country/seniority 处理,不做 contactVisible 裁剪) |
| B9 | `src/main/java/com/tsa/api/controller/AuthController.java` | 类注释(:17-22)更新为「微信登录+乡会身份」;+`@PostMapping("/wechat-login")`(@Valid→authService.wechatLogin)、+`@PostMapping("/logout")`→Result.ok();风格逐字对齐 :31-37 |
| B10 | `src/main/java/com/tsa/api/controller/UserController.java`(新) | `@RequestMapping(ApiConstants.BASE_PATH + "/user")`(BASE_PATH=/tsa,`config/ApiConstants.java:9`)+ `@GetMapping("/me")` → Result.ok(authService.currentUser());Controller 零逻辑,类结构照抄 MemberController.java:37-41 |
| B11 | `src/main/java/com/tsa/api/config/SaTokenConfig.java` | 既有 SaInterceptor lambda(:24-28)内追加 `SaRouter.match("/tsa/user/**").check(r -> StpUtil.checkLogin())`——本期唯一新增受保护路由;/tsa/admin/** 与其余公开路由不动 |
| B12 | `src/main/java/com/tsa/api/config/AuthRateLimitInterceptor.java`(新) | HandlerInterceptor,注册在 SaTokenConfig.addInterceptors 第二个拦截器,`addPathPatterns("/tsa/auth/**")`;Hutool `cn.hutool.cache.impl.TimedCache`(hutool-all 已在 pom:99-101)做 IP 固定 60s 窗口计数:wechat-login 阈 10/分、verify-phone 阈 5/分,超限抛 `BusinessException(TOO_MANY_REQUESTS)`(preHandle 异常走 @RestControllerAdvice,与 :25-29 一致);IP 取 `request.getRemoteAddr()`,注释标明单实例内存实现、XFF 仅在确认受信反代后启用、Redis 化随二期 |
| B13 | `controller/MemberController.java`、`service/MemberService.java`、`service/impl/MemberServiceImpl.java`、`dto/ProvinceStatVO.java`(新) | +`GET /tsa/members/stats/province`(字面量路径与 `/{id}` 无冲突,先例见 MemberController.java:70 注释);Impl 用 `listMaps(new QueryWrapper<Member>().select("province","COUNT(*) AS cnt").eq("status",1).groupBy("province"))`(@TableLogic 自动 deleted=0) |
| B14 | `src/test/java/com/tsa/api/controller/AuthControllerTest.java`、`UserControllerTest.java`(新)、`MemberControllerTest.java` | 模板=standalone MockMvc mock Service(现有 :36-42):wechat-login 空 code→400 且 message 含「登录凭证」、桩成功→200+token+user 可 null、桩抛 1303 透传;user/me 桩 NotLoginException→401 壳、user null→200 data null、assoc loginId→401;stats→200 列表。运行 `JAVA_HOME="D:/JDK/jdk-25" ./mvnw.cmd clean test` 全绿 |
| B15 | `docs/API.md` | 状态码表(:25-36)+1303/1306;认证约定(:41-50):`/tsa/user/**` 起需登录、401=微信会话失效(前端负责静默重登重放,身份类失败仍 1301 语义不变)、限频为内存实现单实例假设;接口清单(:52-74)+4 条;推迟清单(:92-98)删登录两行、:96 改「stats/province 已实现,map-data 已上线」。**加码先更本表+两份 API.md+ResultCode 三处同步**(:38-39 既有纪律) |

## 5. application.yml 配置键(tsa-api)
```yaml
tsa:
  wechat:
    app-id: ${WECHAT_APP_ID:}          # 已有 :60,真链路必填(与 manifest.json:53 appid wx578511d4e7324722 配对)
    app-secret: ${WECHAT_APP_SECRET:}  # 已有 :61
    mock-mode: ${WECHAT_MOCK_MODE:false}          # 已有 :64,只管换号
    login-mock-mode: ${WECHAT_LOGIN_MOCK_MODE:false}  # 新增,只管 code2Session;两键独立可各测
  rate-limit:
    login-per-minute: ${RATE_LIMIT_LOGIN_PER_MIN:10}       # 新增
    verify-phone-per-minute: ${RATE_LIMIT_VERIFY_PER_MIN:5} # 新增
```
无新 Maven 依赖、无新表、无 DDL。application-dev.yml 不覆盖 mock 键(维持默认 false,与现状一致)。

## 6. 前端改动文件清单(tsa-miniprogram)
| # | 文件 | 改动 |
|---|---|---|
| F1 | `src/utils/request.ts`(核心) | ① 导出 `isMockMode()`;② 新增 `setReloginHandler(fn)` 模块级 + `let reloginPromise: Promise<boolean>\|null`(单飞,`finally` 置 null)——handler 由 App.vue 注入,规避 request→stores→api→request 循环 import(不用动态 import,:109 注释既有教训);③ unwrap 的 401 分支(:91-96)删「清 token+即时 switchTab+toast」,只抛 `ApiError(401)`;④ request() 重构为统一 dispatch:mock 分支(:110-112)先像 rawRequest 那样把 `Authorization` 从 storage 合并进 opts.header 再 mockDispatch(双模式对称的前提),真分支原样;两路共用一个 `attempt(retried)` 循环:捕 `ApiError && code===401 && !url.startsWith('/tsa/auth/') && !retried` → `await (reloginPromise ??= reloginHandler().finally(...))` → 成功 `attempt(true)` 重放一次(rawRequest:62 每次现读 storage,新 token 自动带上)→ 失败/二次 401 → removeStorageSync(TOKEN_KEY) + `uni.switchTab({url:'/pages/mine/index'})`(tab 页约束,:94 注释)+ 非 silentError toast「登录已失效,请重新登录」+ 抛错。auth 前缀守卫防 wechat-login/logout 自身 401 成环;1301/1302 逻辑一行不改(无专门分支,由页面 catch 的现有约定保持) |
| F2 | `src/api/auth.ts` | wechatLogin/verifyPhone(:18-19,29-35)签名不动;getProfile(:37)加 `showLoading:false, silentError:true`(onShow 轮询防闪 loading/双 toast,失败表现由 store/重登兜);logout(:40-42)升级 async:POST `/tsa/auth/logout`(silentError+showLoading:false,catch 吞)后再 removeStorageSync;删 :14-16「真实链路要等 code2session」过时注释 |
| F3 | `src/stores/user.ts` | +`wxLoginCode()`(uni.login 用 success/fail 回调用法包 Promise,同 request.ts:52-58 教训;fail 带 errno console.warn 后 reject);+`silentLogin(): Promise<boolean>`(isLogin 快路径;共享 `let pending` 单飞,与 request 层 relogin 互斥叠加无害;USE_MOCK→loginWithCode('mock-code'),否则 wxLoginCode→loginWithCode;catch 全部异常 console.warn→false,绝不 throw/绝不 toast);displayName(:27)三态:`!isLogin→'未登录的乡友'`,`isLogin && !profile→'点击完善资料'`;logout 改 async 调 authApi.logout+本地清(:76-81 注释「不动 assoc」语义维持);loginWithCode/fetchProfile/setToken/saveAssoc/clearAssoc 不动 |
| F4 | `src/App.vue`(:3-5 现空 onLaunch) | `const user = useUserStore(); setReloginHandler(() => user.silentLogin()); if (!user.isLogin) void user.silentLogin()`(main.ts 已先装 pinia,App 生命周期内可用) |
| F5 | `src/pages/mine/index.vue` | onLogin(:48-56)未登录分支→`const ok = await user.silentLogin()`+toast(成功「已登录」/失败「登录失败,请重试」);已登录分支维持 logout(:50-52);按钮文案(:103)`'mock 登录'→'一键登录'`;删 :9-15「mock 假登录」过时页头注释;onShow(:74-84):fetchProfile 保持(本期 user/me 已是真路由,失败经重登自愈),`getProvinceStats()`(stats 后端本期补上)与 `getList()` 各自独立 try-catch + `silentError/showLoading:false`(降级显示 0/『-』,单点失败不再打整页) |
| F6 | `src/pages/mine/profile.vue`(16 页中唯一必须补硬门的现存页) | 删 :88 裸 `loadProfile()`;onLoad(`@dcloudio/uni-app`)async 守卫:`if (!user.isLogin) await user.silentLogin()` → 仍 !isLogin → toast「请先登录」+`uni.navigateBack()`+return;`if (!user.profile) await user.fetchProfile()`;然后 loadProfile(:70-85 回填逻辑不动,profile 仍 null 走空表单+顶部提示「填写提交后经秘书处审核展示在乡贤列表」);onSubmit 的 setTimeout 假保存(:115-121)本期保留,按钮旁加灰字「本地预览,暂未同步服务器」(真保存契约列 userDecisions #1) |
| F7 | `src/pages/index/index.vue` | load()(:65-74)`Promise.all` 拆两路独立 catch:stats 正常;events catch 后 `events.value=[]` 且事件卡 `v-if` 隐藏(/tsa/events 后端永不做,`tsa-api/docs/API.md:97-98`;终态形态列 userDecisions #4,本期只保证「任一失败不拖垮整卡+不弹 500/404 toast」,两调用加 silentError) |
| F8 | `src/mock/index.ts` | `'GET /tsa/user/me'`(:202)加校验:`(o.header ?? {})['Authorization'] !== 'Bearer mock-token-for-development-only'` → 返回 `{code:401,...}` 壳(:280-283 壳透传机制现成)——配合 F1 mock 分支并 header,使 401→静默重登→重放全链路在 USE_MOCK=true 下可手测;wechat-login 桩(:250-254)不动;+`'POST /tsa/auth/logout': () => null`;verify-phone(:203-215)与 1301 模拟(:227-237)不动 |
| F9 | `docs/API.md`(小程序侧)+ 构建纪律 | :43(401 行为改「清 token+静默重登重放,失败才跳我的页」)、:54-80 鉴权节(wechat-login/user/me 由「二期实现」:57 改本期已上线)、:202 确认 data 可 null;`.env.development`(USE_MOCK=false、base=localhost:8080)不动;改完必重编译——BASE_URL/USE_MOCK 是编译期常量(`dist/dev/mp-weixin/utils/request.js:3` 为现场证据),验收只认 `dist/dev/mp-weixin` |

## 7. 页面门清单(定稿)
| 页面 | 门 | 本期动作 |
|---|---|---|
| pages/index/index、map/index、notice/detail、foundation/index、event/list、event/detail、community/index+food+campus+chronicle、mine/privacy、mine/agreement(13 页) | no-login | 不改门;privacy/agreement 按监管**禁止**加门 |
| pages/mine/index(tab) | soft-login | 它本身是登录/登出入口;401 兜底 switchTab 的目的地,天然可达 |
| pages/mine/profile | **hard-wall(登录 token)** | F6 守卫;真保存待决策#1 |
| pages/member/detail(占位) | hard-wall(钥匙=**X-Assoc-Token/1301**,非登录) | 后端数据面已硬拦(`MemberServiceImpl.java:106`);页面重建随 C 路拍板(决策#3),本期保持 t-empty;闸门失败**永不自动拉起**登录/核验(1301≠401 的分层考虑,`AuthServiceImpl.java:66-68`) |
后端配套鉴权债(foundation 9 写接口裸奔 `FoundationController.java:63-121`、community 3 写接口可达但前端链路已删)属提审收口议题,列决策#5,不在本期偷改。

## 8. verify-phone 未来 mode 分支的接口预留(本期零代码实现)
- 请求体演进向后兼容:`{"code"}`(`VerifyPhoneRequest.java:12-17` 现状)→ 未来 `{mode?: "phoneCode"|"smsCode"|"inviteCode", code?, phone?, smsCode?, inviteCode?}`,**mode 缺省=phoneCode**,老客户端不破;`AuthService.verifyPhone` 届时的形状改造(入参对象化)是唯一签名变点。
- 三种 mode 一律走同一个出口:命中 `association_member` → `StpUtil.login("assoc-"+id)` + session 存手机号 → 同一 `X-Assoc-Token`/1301 契约(`AuthServiceImpl.java:48-54,58-78`)——本期登录主干与门钥匙完全不受 mode 演进影响。
- 个人主体约束定死路线:`getPhoneNumber` 组件永久不可用(官方要求非个人+认证主体)→ A 路(phoneCode)在主体变更前无真链路,C 路(邀请码/openid 认领)是首个可闭环模式;`association_member.member_ref_id`(一期 NULL,`sql/schema.sql:115-145`)就是为「名册↔openid 认领」预留的回填列。前端 `authApi.verifyPhone` 与 `tsa_assoc` 存储形状(`request.ts:26-28`)已为此预留,不在本期写死。
- 本期唯一与 verify-phone 相关的代码改动 = B12 给它加 IP 限频(mock-mode 下它是伪造手机号入口)。

## 9. 联调验证步骤
**A. 后端单测/起服**
1. `cd tsa-api && JAVA_HOME="D:/JDK/jdk-25" ./mvnw.cmd clean test` → 全绿(新增 B14 用例)。
2. 无凭据起服:`WECHAT_LOGIN_MOCK_MODE=true ./mvnw.cmd spring-boot:run`(不设 appid 也能全链路);单独验换号 mock 不受牵连:只开 LOGIN_MOCK 时 `POST /tsa/auth/verify-phone {"code":"13800000001"}` → 1302(换号 mock 未开),两开关独立成立。
**B. curl 契约验证(Git Bash;载荷无中文,中文载荷一律 `--data-binary @f.json` 防转码坑)**
3. `curl -s -X POST localhost:8080/tsa/auth/wechat-login -H "Content-Type: application/json" -d '{"code":"x"}'` → `data.token` 非空、`"user":null` 键在场(Result 无 NON_NULL,已核实 `Result.java:29-30`)。
4. 空 code → 400「登录凭证不能为空」;同 code 连发 11 次 → 第 11 次 1306。
5. `curl -s localhost:8080/tsa/user/me` → 401;带 `-H "Authorization: Bearer <token>"` → 200 data null。手工 `INSERT INTO member(openid,name,gender,province,city,status) VALUES('mock-openid-local','测试',0,'广东省','汕头市',1)` 后 `PUT`?不——直接重查 `curl -s /tsa/user/me -H ...` → 200 全量 MemberDetailVO(**含 phone 原值,本人视角不裁**)。
6. `curl -s -X POST /tsa/auth/logout -H "Authorization: Bearer <token>"` → 200;同 token 再查 /tsa/user/me → 401(证明服务端注销,非仅本地)。
7. 伪装层拆除:`curl -s localhost:8080/tsa/events | python -m json.tool` → code **404**(原 500「服务器繁忙」);`curl -s /tsa/members/stats/province` → 200 数组。
8. assoc 前缀反向防御:先 `verify-phone`(开 WECHAT_MOCK_MODE=true,code=13800000001,名册种子)拿 token,把它当 Bearer 调 /tsa/user/me → **401**;新登录 token 当 X-Assoc-Token 调 `/tsa/members/{id}` → **1301**(两把钥匙互不通用双向验证)。
**C. 微信开发者工具(前端)**
9. 后端 `WECHAT_LOGIN_MOCK_MODE=true`;`npm run dev:mp-weixin`(USE_MOCK=false)→ 工具「清缓存→全部清除」后编译进首页:Network 自动出现 `POST /tsa/auth/wechat-login`,「我的」页 hero 变已登录态、displayName 显示「点击完善资料」;冷启动期间其余请求不阻塞。
10. 401 自愈:**重启后端**(内存会话全灭)→ 切「我的」tab → Network 只出现**一次** wechat-login(单飞)且原请求以新 token 重放成功,UI 无感、控制台仅 warn。
11. 硬门:登录态清除且后端停服时进 profile → toast+navigateBack;正常冷启动直进深链 profile → 无感自救。
12. mock 对称:`VITE_USE_MOCK=true` 重编译 → 删 storage tsa_token 重进 profile → 演练同一条 401→重登→重放路径(F8 使 mock 会发 401);全 mock 演示链路(首页/详情 1301/verify-phone 哨兵)不回归。
13. 四 tab 页真机回归各一遍(401 行为变更触碰唯一网络出口)。
**D. 真链路(有 appid/secret 时)**:注入 `WECHAT_APP_ID/WECHAT_APP_SECRET`(appid=manifest.json:53),LOGIN_MOCK 不设 → 真机冷启动验 openid 落库前 user=null、注册一条真实 member 后 user 回填;**实测服务器出口 IP 在 MP 后台开 API IP 白名单前后各跑一次**(官方未明示 jscode2session 是否受白名单约束——被 40164 拦则后台加白)。
**E. 提审前 checklist(行政)**:`.env.production:3` 的 `https://api.example.org` 占位域名替换+MP 后台 request 合法域名;部署环境 `WECHAT_MOCK_MODE` 与 `WECHAT_LOGIN_MOCK_MODE` 双 false(B3 守卫兜底 prod profile);foundation/community 写接口处置按决策#5。

## 10. 本期明确不碰(防 scope creep)
member/detail 页重建与 1301 授权卡 UI;verify-phone mode 分支任何代码;POST /tsa/members 注册链路(含 openid 收口改造,随决策#1 一起做);foundation/community 接口鉴权收口(决策#5);地图、events 后端;Redis 会话;.env.production 域名;社区功能回归。

---

# v1.2 拍板记录(2026-09-13,用户追问后增补)

## D1. 用户唯一性与「有多少用户」——新增 wechat_user 轻埋点表
用户疑问:「不做注册,我怎么知道小程序有多少用户?没有字段证明用户唯一性」。澄清+方案:
- **openid 就是微信给每个用户在你这个小程序下的唯一 ID**(同一个人+同一 appid 永远同一个 openid,不同小程序不同 openid)。wechat-login 的 loginId=裸 openid 已经建立在它之上,唯一性证明天然存在。
- 但 v1.1 主干「登录不留档」确实导致无法统计用户量(会话在内存,重启即灭)。补一张**与 member 名册彻底分离**的埋点表:
```sql
CREATE TABLE wechat_user (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL,
  unionid VARCHAR(64) NULL,
  first_login_at DATETIME NOT NULL,
  last_login_at DATETIME NOT NULL,
  login_count INT NOT NULL DEFAULT 1,
  UNIQUE KEY uk_openid (openid)
) COMMENT '小程序登录用户埋点(访客),区别于 association_member 名册与 member 乡贤档案';
```
- wechatLogin 服务内 `INSERT ... ON DUPLICATE KEY UPDATE last_login_at=NOW(), login_count=login_count+1`(失败仅 log.warn,**不阻断登录**)。统计口径:总用户=COUNT(*),新增=first_login_at 区间,活跃=last_login_at 区间。
- 这推翻了 rejectedIdeas「独立 wechat_user 表过早」——用户提出了明确的运营统计需求,前提变了。仍不做的是:member 幽灵行(不变)。
- 注册逻辑的正解:小程序行业惯例没有「注册页」,点进/一键登录即自动建档=openid;真正的「注册入册」=完善资料提交审核(profile 真保存,见 D3),三层各归各位:wechat_user(来过)→ member(登记为乡贤)→ association_member(乡会身份核验)。

## D2. 事件模块 → 跳转公众号文章路线(官方文档已核实,含对用户提供 URL 的勘误)
- **勘误**:用户翻到的 `platform-capabilities/miniapp/new-capability/official-account.html` 是**多端框架(App OpenSDK)**文档(讲自有 App 内 webview 文章卡片跳回小程序),不是小程序能力本体。
- 小程序侧真实能力:**`wx.openOfficialAccountArticle`(基础库 3.4.8+,2024-06-19 上线)**。官方 API 页原文:「通过小程序打开**任意公众号文章**(不包括临时链接等异常状态下的公众号文章),**必须有点击行为才能调用成功**」。逐字核实:API 页全文**无主体类型条款**(个人主体既未禁止也未背书,真机实测为准,列入 §9.D);「需先关联公众号」是第三方以讹传讹——同组 chat/profile 两 API 明示「需同主体或关联主体」而 article API **不写**,对照即证据。形态=拉起微信**原生文章阅读页**(非小程序页内嵌),带确定/取消确认交互;不支持 Promise 式调用;fail 无错误码枚举,低版本/异常链接需兜底。
- **web-view 内嵌正文路线对个人主体双重封死**(组件文档「个人类型的小程序暂不支持使用」+ 业务域名「仅支持非个人主体」),任何套壳第三方插件触 8.4/5.19 规避条款,处罚落自己头上,禁选。
- 落地形态(与用户「正文跟公众号保持一致、不进小程序重抄」诉求吻合):
  - `activity` 表加两列:`article_url VARCHAR(500)`(公众号永久链接 /s/xxx)、`summary VARCHAR(500)`(小程序侧一句话简介,列表用;cover_url 列已存在)。
  - 后端只读两接口:`GET /tsa/events`(分页,列表字段,支持 year 筛选——mock 列表页有年份筛选逻辑,对齐字段)、`GET /tsa/events/{id}`。**不做报名**(activity_registration 表继续躺)。
  - 前端:`event/list.vue` 删 `:28` 的 mock 直引(生产包会带 100 条假事件,「联调三大坑」同款),改走接口,卡片补点击(现状**卡片根本没有点击事件**,仅首页入口跳 detail);detail 页重做为「封面+标题+摘要+发布时间 +『阅读公众号全文』按钮」→ 点击行为内调 `wx.openOfficialAccountArticle`,fail 或基础库 <3.4.8 → `uni.setClipboardData` 复制文章链接 + toast「链接已复制,请在微信内打开」。**不在 pages.json 摘除 event/detail 注册**(这次它成为真页面,与 community publish/detail 的提审摘除逻辑不同)。
  - 秘书处编辑:本期无管理界面,走 SQL 直插(表字段简单);「自己上传封面」依赖 D3 的上传接口,填 URL 进 cover_url。可选二期加分项:后端代抓文章页 og:image 自动带封面(合规中性、实现简单),本期不做。
  - 契约同步:tsa-miniprogram/docs/API.md:124-139 与 tsa-api/docs/API.md:97-98 矛盾(前者还写着报名/详情富文本),两份都改成本形态。
## D3. 头像昵称填写 + 最小文件上传进一期(用户贴官方文档确认为唯一路线)
- 用户确认路线=「头像昵称填写能力」(button open-type=chooseAvatar + input type=nickname,2.21.2 起,2.24.4 起微信自动接入内容安全检测)——与 v1.1 调研结论一致,个人主体可用。**必须用户主动点击**,无静默获取;wx.getUserProfile 系 2022-10 起只回匿名数据,死路。
- 依赖链:chooseAvatar 给的是**临时路径**,profile.vue 现状(:129-137)存进 Pinia 假保存,与 community_post.images 存 wxfile:// 假 URL 同坑。→ 本期落地最小上传:`POST /tsa/files`(multipart,Bearer 门,FileStorageService **本地磁盘实现** @Profile("!prod")兜底 + 接口注释更新,prod 部署时注 OSS 实现),≤2MB,jpg/png/webp 白名单,返回 `/tsa/files/{id}` 静态 URL 存库。头像与事件封面共用,顺带消掉旧坑。
- profile 真保存(原决策#1)随本期一起做:`PUT /tsa/user/profile`,openid 从 Bearer 推导;无 member 行 → INSERT **status=0 待审** + source=1,昵称→name、临时→intro、头像→avatar_url、手机→phone;有行 → 白名单更新。**不碰 register 路径**(A7 的 register openid 推导改动照做)。province/city/address:address 表单字段无对应列 → 砍掉或并入 intro(实施时定,倾向砍)。秘书处审核工作流本期不做(status=0 即待审态,SQL 改 status=1 放行)。
## D4. 凭据与密钥处理(用户已提供)
- AppID `wx578511d4e7324722`(与 manifest.json:53 一致,核验通过);AppSecret 用户已在会话中给出——**处置纪律**:只注入环境变量 `WECHAT_APP_SECRET`(启动脚本/IDE run config),**绝不写入任何仓库文件**;tsa-api 的 application*.yml 不在 .gitignore 内(已核实),写进去=入库。另:密钥出现过在聊天记录中,建议在 MP 后台「重置」一次再配正式部署环境变量,零成本消险。
- 凭据就绪 → 本期直接跑 §9.D 真链路(真机冷启动验 openid),顺手实测 jscode2session 是否受出口 IP 白名单约束(被 40164 拦则后台加白)。login-mock-mode 仍保留给无凭据开发。
## D5. 「微信自带会话时效」不能替掉后端登录态(回应用户对 6 篇登录文档的直觉)
- 微信的 `wx.checkSession`/`api_checksessionkey`/`api_resetusersessionkey` 管的全是 **session_key**——那是「微信加密数据的解密密钥」的生命周期,不是「你后端的登录态」。请求到达 tsa-api 时,微信**不会**替我们标注调用者是谁(jscode2session 只在换 token 那一刻出场一次),所以「token→openid」映射必须我们自己有——这不是「维护一套逻辑」,而是 Sa-Token 现成能力:timeout=7d 是 yml 里一行配置,拦截器校验是框架内置,**本期新增代码≈0**。
- 因此 checkSession 辅助轨维持 rejectedIdeas #4 不变:我们不留存 session_key,checkSession 无判定权,401 是唯一权威信号。
- 用户「留给管理系统」的方向是对的且更近一步:后台管理系统将来**复用同一套 Sa-Token**(多账号体系,loginId 用 `admin-` 前缀,与 openid/`assoc-` 三命名空间互斥——v1.1 修订 A9 已确立前缀显式拒绝原则),不必另起炉灶。
## D6. 「写接口收口」通俗化解释(用户问「这是什么意思」)
- 现状:秘书处用的「新增捐赠/改奖励项目」等 9 个接口,后端**完全没锁**——任何知道地址的人都能往你服务器写/改/删捐赠数据。community 3 个写接口同(幸而前端入口已删)。
- 「收口」=上线前把这几扇门锁上(锁法:管理令牌/挪进已鉴权的 /tsa/admin/**/暂时禁用,三选一)。当前生产未部署(占位域名),无现实风险,**维持「提审前处理」决策不变**,已在 §9.E 清单。D3 落地后 profile/foundation 新增写路径均带 Bearer 门,不扩大本问题。
## v1.2 一期最终范围(在原 §0 基础上 +)
①登录主干(v1.1 全部)②wechat_user 埋点表(D1)③事件模块轻量版:activity 加列+读接口+list/detail 改造+跳公众号文章(D2)④profile 真保存+头像昵称填写+最小文件上传(D3)⑤真链路凭据(D4)。
仍不做:管理系统、verify-phone mode 分支、member/detail 重建、写接口收口(提审前)、Redis、地图、报名。

## D7. 追问二轮拍板(2026-09-13)
- **登录态托管追问**:用户问能否不自己管 token、只调接口验时效。结论:该形态=云开发(平台自动注入 openid),自建 tsa-api 不可得(请求到达时无身份载体;session_key 系只覆盖加密数据通道,非 API 调用凭证)。维持 v1.1 方案:Sa-Token 存量已含签发/时效/校验(各≈一行配置),checkSession 辅助轨维持 rejectedIdeas#4;管理系统将来复用同套 Sa-Token(admin- 前缀),不新起轮子。§9.E 中「写接口三选一收口」撤销,改为:
- **foundation/community 写接口**:用户确认——前端零调用,系秘书处管理端预留接口,终态=迁入后期管理系统并自带登录态。本期零动作;§9.E 提审清单该条改写为「写接口保持仅服务端可达现状,管理系统接入时统一加鉴权」。

---

# 实施落地记录(v1.2,2026-09-13,workflow wechat-login-v12-impl)

## 验收状态
- 后端:tsa-api `mvnw -o clean test` 44/44 绿;前端 type-check/eslint/prettier/`build:mp-weixin` 全绿。
- 活端点实测(DDL 落库+起服 curl)15 项全 PASS:空 code 400、登录签发(user 键在场)、401、服务端注销实锤、stats、assoc↔登录两把钥匙双向互斥、404 拆伪装、events 三态(分页/year/1002)、files 四态(含目录穿越三形态全拒)、profile 白名单+建档(status=0/source=1/地区 NULL)、注册 Bearer 新锁、限频精确不误伤(100/101 边界)、中文载荷回显。
- 对抗评审 5 条 critical/major 全修:①自愈三态不再被 boolean 压平(retryable 只节流 toast 不清态,A4 补全)②头像**相对路径入库**(修正 D3「avatar→avatar_url」歧义:上传返回 `/tsa/files/<uuid>.<ext>` 直接存,展示时才 buildFileUrl 拼域名——换正式域名不瞎)③A6 部署半边落地:Dockerfile 烧 `ENV SPRING_PROFILES_ACTIVE=prod` ④事件列表年份上限改动态(不再硬编码 2026)。

## minor 16 条处置
- 已修 8:POST /tsa/files 漏挡 assoc 令牌(A9 原则补齐)、uk_openid 并发撞键重试一次+软删冲突回明确 1002(不再伪装 500)、displayName 空串兜底、mine hero 孤立「 · 」、地图页 NULL 城市 TypeError、首页「数据来自 mock」虚假文案、事件详情契约泄漏 status(mock 多带键)、本轮新增文件的 prettier 债。
- 计划外顺手修:JSON 接口收到 form-urlencoded 原会伪装 500 → GlobalExceptionHandler 加 HttpMediaTypeException→400(B5 同族)。
- 未修留账 2:(a)LocalFileStorageServiceImpl 刻意不加 @Profile("!prod")——Dockerfile 已强制 prod,加了反而无实现起不来服;二期接 OSS 时一并处理;(b)前端 MemberDetail 类型对 province/city 等「必有值」声明与实际可 NULL 的三方谎言——消费点现均有 ?? 兜底,随真机验收/管理系统一并收口。

## 契约口径补充(与正文冲突处以本节为准)
- files 路径含 uuid 文件名而非 {id}(不落库、不建表);限频桶按 IP+端点 独立计数;WechatLoginRequest 补 @Size(128);chooseAvatar 事件负载字段是 `detail.avatarUrl`;`setAuthHook({relogin:()=>Promise<SilentLoginState>, clearSession})`。

## 人工待办
1. §9.C 微信开发者工具回归(冷启登录/重启无感自愈/硬门/mock 对称)。
2. §9.D 真链路:env 注入 WECHAT_APP_ID/WECHAT_APP_SECRET 真机验 openid;若 40164 则 MP 后台加出口 IP 白名单;`openOfficialAccountArticle` 真机测试一并落在这步。
3. MP 后台「用户隐私保护指引」同步(新增 openid 收集+相册选择)。
4. 秘书处运维:事件内容 SQL 直插(title/cover_url/summary/article_url)、资料审核(status 0→1 并补 province/city)。
5. dev 库 activity id=1 的 article_url 是冒烟占位,提审前换真实公众号链接。
