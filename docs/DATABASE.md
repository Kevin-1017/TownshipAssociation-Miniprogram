# 数据模型设计

这份文档描述**领域模型**,是 `tsa-api` 将来建表的依据,也是
`src/types/*.d.ts` 的自然语言版说明。字段定义以 `src/types/` 为准,
两边不一致时以本文件讨论后同步修正。

---

## 一、实体关系概览

```
Member (乡贤)  ──┬──< EventRegistration >──  Event (活动)
                 │
                 └──  role: 理事/会员/志愿者   (第二阶段拆出 Membership 表)

Notice (公告)     独立实体,作者外键指向 Member
```

第一阶段实际只用三张表;报名关系(虚线)留到第二阶段。

---

## 二、member —— 乡贤

| 字段                        | 类型          | 约束            | 说明                                                |
| --------------------------- | ------------- | --------------- | --------------------------------------------------- |
| `id`                        | varchar(16)   | PK              | 业务编号 `m0001`。**不用自增 int**,避免被遍历       |
| `openid`                    | varchar(64)   | UNIQUE,可空     | 微信身份。未绑定微信的登记会员为空                  |
| `name`                      | varchar(32)   | NOT NULL        |                                                     |
| `avatar`                    | varchar(255)  | 可空            | 存对象存储 key,不存完整 URL                         |
| `gender`                    | tinyint       | 默认 0          | 0 未知 / 1 男 / 2 女                                |
| `province`                  | varchar(16)   | 索引            | **存中文全称**「广东省」(与前端字典一致,避免映射层) |
| `city`                      | varchar(16)   | 索引            | 「汕头市」                                          |
| `district`                  | varchar(16)   | 可空            | 「金平区」。非汕头会员为空                          |
| `country`                   | varchar(16)   | 默认 `'中国'`   | 为海外乡亲预留                                      |
| `lat`                       | decimal(10,6) | NOT NULL        | **GCJ-02**,不是 WGS-84                              |
| `lng`                       | decimal(10,6) | NOT NULL        |                                                     |
| `industry`                  | varchar(24)   | 索引            | 存 code:`trade/food/...`                            |
| `company`                   | varchar(64)   |                 |                                                     |
| `title`                     | varchar(32)   |                 | 职位                                                |
| `school`                    | varchar(64)   |                 | 毕业院校                                            |
| `major`                     | varchar(32)   |                 | 专业                                                |
| `graduation_year`           | smallint      |                 | 届别,便于按届统计                                   |
| `bio`                       | varchar(255)  |                 | 个人简介                                            |
| `wechat_id`                 | varchar(64)   |                 | **默认不出接口**                                    |
| `phone`                     | varchar(20)   |                 | **默认不出接口**                                    |
| `contact_visible`           | tinyint(1)    | 默认 0          | 权限位                                              |
| `status`                    | varchar(16)   | 默认 `'active'` | `active/pending/disabled`。审核用                   |
| `joined_at`                 | date          |                 | 入会时间                                            |
| `created_at` / `updated_at` | datetime      |                 |                                                     |

### 索引建议

```sql
INDEX idx_geo (lat, lng)              -- 地图按视野框取成员(将来数据量大时用)
INDEX idx_city (province, city)       -- 列表筛选
INDEX idx_industry (industry)
UNIQUE INDEX uk_openid (openid)
```

数据量到几万级后,地理范围查询考虑 MySQL 空间索引(`POINT` + `SPATIAL INDEX`)
或直接上 Redis GEO。

### 隐私:两条硬要求

1. **接口层按 `contact_visible` 剔除字段**,不是返回给前端让它 `v-if`。
   前端隐藏拦不住抓包。
2. `phone`、`wechat_id` 在**列表类接口里一律不出现** —— 只有详情接口、
   且只有 `contact_visible=1` 或本查看自己时才返回。

---

## 三、event —— 活动

| 字段                      | 类型          | 说明                                                                   |
| ------------------------- | ------------- | ---------------------------------------------------------------------- |
| `id`                      | varchar(16)   | `e001`                                                                 |
| `title`                   | varchar(128)  |                                                                        |
| `cover`                   | varchar(255)  | 对象存储 key                                                           |
| `start_time` / `end_time` | datetime      | 接口返回 ISO 8601 **带时区**                                           |
| `city` / `address`        | varchar       |                                                                        |
| `lat` / `lng`             | decimal(10,6) | GCJ-02,用于活动地图与将来的路线规划                                    |
| `quota`                   | int           | 0 表示不限                                                             |
| `registered_count`        | int           | **冗余计数列**,报名成功时原子自增;真实人数以关系表 count 为准,定时校准 |
| `status`                  | varchar(16)   | `upcoming/ongoing/past/cancelled`,**服务端计算**,不让前端比时间        |
| `content`                 | text          | 富文本或带 `\n` 纯文本                                                 |
| `organizer`               | varchar(64)   | 主办部门                                                               |
| `contact_phone`           | varchar(20)   |                                                                        |

---

## 四、event_registration —— 报名(第二阶段)

| 字段            | 类型        | 说明                            |
| --------------- | ----------- | ------------------------------- |
| `id`            | bigint      | 自增 PK(内部表,不对外)          |
| `event_id`      | varchar(16) |                                 |
| `member_id`     | varchar(16) |                                 |
| `status`        | varchar(16) | `registered/attended/cancelled` |
| `registered_at` | datetime    |                                 |

```sql
UNIQUE INDEX uk_event_member (event_id, member_id)   -- 幂等:重复报名直接冲突
```

**这个唯一约束是幂等的关键**,不要只靠应用层「先查再插」——
并发下会双写。名额扣减用 `UPDATE ... WHERE registered_count < quota` 判定影响行数。

---

## 五、notice —— 公告

| 字段               | 类型         | 说明                        |
| ------------------ | ------------ | --------------------------- |
| `id`               | varchar(16)  | `n001`                      |
| `title`            | varchar(128) |                             |
| `summary`          | varchar(255) | 列表页摘要,别让前端截断正文 |
| `content`          | text         |                             |
| `pinned`           | tinyint(1)   | 置顶,排序用                 |
| `published_at`     | datetime     |                             |
| `author_member_id` | varchar(16)  | 秘书处成员                  |

---

## 六、字典表

`industry`、行政区划目前硬编码在前端 `src/constants/`。
**会员数超过 500 或需要后台维护字典时,再建 `dict` 表** ——
现在建属于过度设计。届时的迁移成本很小:前端把常量换成接口即可。

---

## 七、通用约定

- 字符集 `utf8mb4`,排序规则 `utf8mb4_0900_ai_ci`(MySQL 8);
- 主键用**业务编号字符串**,内部关联表才用自增 bigint;
- 时间统一 `datetime`,存 UTC 或统一存东八区并**在文档里写死一种**;
  接口输出必须带时区偏移;
- 软删除用 `status='disabled'`,不用 `is_deleted` 布尔位(状态语义更丰富);
- 经纬度 `decimal(10,6)`:6 位小数约 0.1 米精度,足够。
