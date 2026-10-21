# 衣橱 · Wardrobe — 设计与开发文档

> 版本：v1.7（M4 今日穿搭、天气、穿着记录已实现；含 M3 槽位搭配、M2 端上抠图与连续拍摄队列；M5 设计保留；含附录 A–E）
> 目标：仅凭本文档即可从零复刻出功能、数据、交互一致的软件。
> 文中所有「必须」为复刻一致性要求，「建议」为可替换实现。

---

## 目录

1. [产品定义](#1-产品定义)
2. [设计原则](#2-设计原则)
3. [系统架构](#3-系统架构)
4. [信息架构与路由](#4-信息架构与路由)
5. [数据模型](#5-数据模型)
6. [业务规则](#6-业务规则)
7. [图片处理流水线](#7-图片处理流水线)
8. [备份格式 v1](#8-备份格式-v1)
9. [PWA 与部署](#9-pwa-与部署)
10. [UI/UX 规范](#10-uiux-规范)
11. [代码结构](#11-代码结构)
12. [已实现功能与验收标准](#12-已实现功能与验收标准)
13. [测试](#13-测试)
14. [待开发功能详细设计](#14-待开发功能详细设计)
15. [已知问题与风险](#15-已知问题与风险)
16. [从零重建清单](#16-从零重建清单)
17. [附录：完整字典](#17-附录完整字典)

---

## 1. 产品定义

### 1.1 一句话

手机优先的私人衣橱与穿搭管理 PWA，衣服和照片全部存在手机本地，用于「知道自己有什么」和「快速决定今天穿什么」。

### 1.2 要解决的问题

| 问题 | 现状 | 软件的解法 |
| --- | --- | --- |
| 忘了自己有哪些衣服 | 衣柜塞满但只穿那几件 | 拍照建档 + 网格浏览 + 筛选 |
| 出门前决策慢 | 反复翻衣柜 | 套装预设（M3）+ 今日推荐（M4/M5） |
| 重复购买 | 不记得已有同类 | 按分类/颜色检索 |
| 衣物养护 | 不知道哪件该洗 | 清洁状态 + 穿着次数 |
| 数据被 App 绑架 | 换 App 就丢数据 | 纯本地 + 标准 zip 备份导出 |

### 1.3 目标用户

- 单人使用，衣物规模 **≤ 300 件**（当前版本按 ≤ 100 件优化）。
- 主要设备：**手机**（拍照和查看都在手机）。
- 可能同时拥有 iPhone 与 Android，但不要求实时同步。
- 不需要账号、不需要社交、不需要云端相册。

### 1.4 明确的非目标（不要做）

- 不做多用户 / 家庭共享 / 权限体系。
- 不做服务端数据库、登录、云同步（v1 不做；后续如需要，另立项目）。
- 不做电商比价、二手交易、社交分享社区。
- 不做自动识别品牌/款式的 AI 视觉（成本高、收益低）。
- 不做自由拖拽式无限画布（手机上不可用，见 §2）。

### 1.5 成功标准

- 录入一件衣服 **≤ 30 秒**（从点 + 到保存完成）。
- 新增 50 件后仍能在 2 次点击内找到任意一件。
- 备份文件可在另一台手机完整恢复（含图片与缩略图）。
- 断网可用（PWA 缓存 app shell）。

---

## 2. 设计原则

这些原则是**推导出来的约束**，复刻时不可随意更改，否则会破坏体验。

### 2.1 手机优先，桌面是副产物

- 布局按 390×844 设计，`viewport-fit=cover`，处理刘海与底部安全区。
- 触控目标最小 40×40，主按钮高度 46。
- 禁用双击缩放：`maximum-scale=1, user-scalable=no`。
- 灰屏、滚动链、`overscroll-behavior-y: none`。

### 2.2 零后端、零账号（数据主权）

- 数据只存在浏览器 IndexedDB，服务器只分发静态文件。
- 好处：无服务器成本、无隐私风险、离线可用。
- 代价：**数据按 origin 隔离**、**不会跨设备同步**、**清缓存即丢失**。因此备份是核心功能而非附加功能。

### 2.3 录入摩擦最小化

- 照片是唯一必填项之一，分类默认「上装」，其余字段全部可选。
- 高级字段折叠在「更多信息」里，默认不展开。
- 拍完照片后**自动识别主色**并预填，减少一次选择。
- 照片在客户端压缩，用户不需要关心尺寸。

### 2.4 视觉一致性优先于功能数量

- 单品图统一使用浅灰棋盘格底 + `object-fit: contain`，让不同来源的照片看起来像一套系统。
- M2 引入抠图的目的不是炫技，而是让「搭配预览」成立。

### 2.5 明确的状态机，而不是一堆布尔值

- 清洁状态用 4 态枚举表达，而不是 `isDirty` / `isWashing` 两个布尔。
- 单品与图片分表，避免列表查询把大 Blob 全读进内存。

---

## 3. 系统架构

### 3.1 架构图

```
┌────────────────────────────── 手机浏览器 / PWA ──────────────────────────────┐
│                                                                              │
│  Vue 3 SPA (hash 路由)                                                       │
│   ├─ Views ── Pinia Store ── db/repo ── Dexie ── IndexedDB                    │
│   │                                   ├─ items（标量 + thumb）                │
│   │                                   ├─ images（original / cutout）          │
│   │                                   ├─ outfits / outfitItems（M3）            │
│   │                                   ├─ wearLogs（M4）                          │
│   │                                   └─ settings（lastBackupAt、天气位置等）    │
│   ├─ services/image   拍照 → 压缩 → 缩略图 → 主色识别                          │
│   ├─ services/cutout  M2 端上抠图（WebGPU 优先 / CPU 回退、裁边补边）           │
│   ├─ services/collage M3 叠穿布局 / 封面合成 / 分享长图                         │
│   ├─ services/today   M4 日期 / 季节映射 / 候选套装筛选                         │
│   ├─ services/weather M4 Open-Meteo 天气、城市搜索与缓存                        │
│   ├─ services/storage 持久化申请 / 用量估算                                    │
│   └─ services/backup  zip 导出 / 导入（含搭配与穿着记录）                       │
│                                                                              │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ 仅首次加载静态资源（HTTPS）
                    ┌───────────▼───────────┐
                    │ 静态托管（Pages/CDN） │  dist/ 无任何用户数据
                    └───────────────────────┘
```

### 3.2 关键决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 形态 | PWA（可安装的 Web） | 双端一套代码，绕过 App Store；免 Mac 也能覆盖 iPhone |
| 路由 | **Hash 路由** `createWebHashHistory` | 静态托管无需配置 404 重写，`base` 可设为 `./` |
| 后端 | 无 | 单人本地数据，服务器只会增加成本和隐私风险 |
| 数据库 | IndexedDB（Dexie） | 能存 Blob、容量大、事务可靠 |
| 图片 | Blob 存 IndexedDB | 浏览器内无需文件系统权限 |
| 备份 | zip（fflate） | 单文件易传输，标准可解压 |
| 样式 | 手写 CSS + CSS 变量 | 无构建期样式依赖，产物小，移动端可控 |

### 3.3 数据边界（极重要）

衣服数据属于 **origin**（协议 + 域名 + 端口）：

- `http://192.168.0.122:5199` 与 `https://wardrobe.xxx.pages.dev` 是**两个独立数据库**。
- Cloudflare Pages 的 `https://<hash>.<project>.pages.dev` 预览域名与正式域名也是**两份数据**。
- 因此：**必须固定使用一个正式域名**，并在 UI/文档中提醒用户。

---

## 4. 信息架构与路由

### 4.1 底部 Tab（4 个）

| Tab | 路由 | 状态 |
| --- | --- | --- |
| 衣柜 | `/` | 已实现 |
| 搭配 | `/outfits` | 已实现（M3） |
| 今天 | `/today` | 已实现（M4） |
| 设置 | `/settings` | 已实现 |

Tab 栏仅在这 4 个路由显示（`route.meta.tab === true`），详情/编辑页不显示，改用顶部返回。

### 4.2 路由表

```ts
'/':               WardrobeView      meta.tab = true
'/outfits':        OutfitsView       meta.tab = true
'/outfits/new':    OutfitEditView
'/outfits/:id':    OutfitDetailView
'/outfits/:id/edit': OutfitEditView
'/today':          TodayView         meta.tab = true，今日穿搭 / 天气 / 穿着记录
'/settings':       SettingsView      meta.tab = true
'/capture':        CaptureView       连续拍摄队列（M2）
'/item/new':       ItemEditView
'/item/:id':       ItemDetailView
'/item/:id/edit':  ItemEditView
'/:pathMatch(.*)*' → '/'
```

`scrollBehavior`：有 `savedPosition` 用之，否则 `{ top: 0 }`（否则从编辑页跳详情会停在页面中部，这是已修复过的真实 bug）。

### 4.3 页面流转

```
衣柜 ──＋──> 添加单品 ──保存──> 单品详情 ──编辑──> 编辑单品
 ▲                                  │
 └──────────── 返回 ────────────────┘
衣柜 ──点卡片──> 单品详情
衣柜 ──相机──> 连续录入 ──批量分类──> 加入衣橱 ──> 衣柜（后台自动抠图）
衣柜 ──底部「搭配」──> 搭配列表 ──＋──> 新建搭配 ──槽位选衣──> 保存 ──> 搭配详情
搭配详情 ──分享长图──> 系统分享 / 下载
设置 ──导出/导入──> 文件系统
设置 ──重新抠图全部──> 后台抠图队列（任意页面继续）
```

---

## 5. 数据模型

### 5.1 建模原则

1. **大 Blob 与元数据分离**：`items` 只存 `thumb`（约 20–40KB），原图/抠图放 `images` 表。避免列表查询加载几十 MB。
2. **分类差异用 `attrs` JSON 兜底**，不为每个品类建表（鞋的跟高、外套的防水等）。
3. **枚举用字符串字面量**，不用数字（可读、可迁移）。
4. **ID 用 `crypto.randomUUID()`**，不可变。
5. **时间戳用 ISO 字符串**，`createdAt` 不可变，每次写入更新 `updatedAt`。

### 5.2 `Item`（items 表）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | UUID，主键 |
| `name` | string? | 否 | 用户命名；为空时展示 `subcategory` 或分类名 |
| `category` | CategoryId | 是 | 7 大类之一 |
| `subcategory` | string? | 否 | 自由文本，但编辑器只给预设选项 |
| `colorPrimary` | string? | 否 | 色板内 hex（自动识别后会吸附到色板） |
| `colorSecondary` | string[] | 是 | 副色，最多 2 个 |
| `pattern` | Pattern? | 否 | 图案枚举 |
| `material` | string? | 否 | 材质自由文本 |
| `seasons` | Season[] | 是 | 可多选，默认 `[]` |
| `styles` | Style[] | 是 | 可多选，默认 `[]` |
| `formality` | number? | 否 | 1–5，正式度 |
| `warmth` | number? | 否 | 1–5，保暖度 |
| `brand` | string? | 否 | |
| `size` | string? | 否 | 自由文本（M / 40 / 均码） |
| `price` | number? | 否 | 人民币，用于成本穿着比 |
| `purchaseDate` | string? | 否 | `YYYY-MM-DD` |
| `location` | string? | 否 | 物理位置，如「主卧衣柜 2 层」 |
| `status` | ItemStatus | 是 | `active` / `idle` / `pending`，默认 `active` |
| `cleanState` | CleanState | 是 | 默认 `clean` |
| `wearCount` | number | 是 | 默认 0，只增不减（删除记录除外） |
| `lastWornAt` | string? | 否 | `YYYY-MM-DD` |
| `attrs` | Record<string, string\|number> | 是 | 预留扩展，默认 `{}` |
| `tags` | string[] | 是 | 自由标签，默认 `[]` |
| `notes` | string? | 否 | 备注 |
| `hasOriginal` | boolean | 是 | 与 images 表同步的冗余标记 |
| `hasCutout` | boolean | 是 | 同上 |
| `thumb` | Blob? | 否 | 420px WebP，内联在 item 内 |
| `createdAt` | string | 是 | ISO |
| `updatedAt` | string | 是 | ISO |

### 5.3 `StoredImage`（images 表）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | **必须**为 `${itemId}:${kind}` |
| `itemId` | string | 归属单品 |
| `kind` | `'original' \| 'cutout' \| 'thumb'` | v1 写 original；M2 起写 cutout（thumb 仍在 item 内） |
| `blob` | Blob | WebP |

> `thumb` 虽在枚举里，但不往 images 表写缩略图，避免重复存储。

### 5.4 `Outfit` / `OutfitItem`（M3 已使用）

```
Outfit:      id, name?, cover?(Blob), occasions:string[], seasons:Season[],
             rating?:1-5, favorite:boolean, notes?, createdAt, updatedAt
OutfitItem:  id, outfitId, itemId, slot:CategoryId, layer:number
```

槽位复用 `CategoryId`（外套/上装/内搭/下装/鞋/箱包/配饰），`layer` 决定叠穿渲染顺序（数字大在上层）。

### 5.5 `WearLog`（M4 已使用）

```
id, date:'YYYY-MM-DD', outfitId?, itemIds:string[],
occasion?, weather?, rating?:1-5, createdAt
```

- `date` 为**本地日期**（`YYYY-MM-DD`），不是 UTC，避免晚上 8 点后被算成第二天。
- 同一天同一套装只保留一条记录（`date + outfitId` 去重），再次点击只更新场合/天气，不重复累计穿着次数。
- `itemIds` 存套装内的全部单品，用于单品维度的成本穿着比与「久未穿」统计（M5）。

### 5.6 `SettingRow`（settings 表，键值）

| key | 类型 | 说明 |
| --- | --- | --- |
| `lastBackupAt` | string(ISO) | 上次导出时间，设置页据此提示 |
| `weatherLocation` | `{ name, detail?, latitude, longitude }` | M4 天气城市，仅存本机 |
| `weatherCache` | `WeatherSnapshot` | M4 上次天气结果，离线时展示 |

### 5.7 Dexie schema 与索引理由

```ts
this.version(1).stores({
  items:      'id, category, status, cleanState, createdAt, updatedAt, *tags, *seasons',
  images:     'id, itemId, kind',
  outfits:    'id, createdAt, updatedAt',
  outfitItems:'id, outfitId, itemId, slot',
  wearLogs:   'id, date, outfitId',
  settings:   'key',
})
```

- `items` 的 `category` / `status` / `cleanState` 用于筛选；`createdAt` 用于倒序。
- `*tags` / `*seasons` 是多值索引（预留精确查询）。
- `images` 按 `itemId` 建索引，删除单品时按 `where('itemId')` 批量删。
- 升级 schema 时**必须**新增 `version(2)`，不能改 version(1)。

### 5.8 数据不变量（新代码必须维持）

1. `images.id === `${itemId}:${kind}``，保证幂等 upsert。
2. `hasOriginal/hasCutout` 必须与实际存在的图片行一致。
3. `thumb` 只存在 item 上，不写 images。
4. `category`/`status`/`cleanState` 永远在枚举范围内。
5. `wearCount >= 0`，`price >= 0`。
6. `colorPrimary` 必须来自 `PALETTE` 的 hex（可由 `nearestPaletteHex` 吸附）。
7. 删除单品时，同事务删除其所有图片与 `outfitItems` 引用；删除搭配时同事务删除其套内单品。
8. `wearLogs` 只由「今天穿了」写入；删除搭配/单品不删除历史记录，历史里显示「已删除搭配」或按 `itemIds` 计数。
8. `outfitItems.slot` 必须等于对应单品的 `category`；同一搭配内同一单品最多出现一次；`layer` 在保存时重新归一化。
9. 写入 IndexedDB 前必须去掉 Vue reactive Proxy（见 §15.1）。

---

## 6. 业务规则

### 6.1 录入规则

- **必填**：`category`（默认 `top`）+ 至少一张照片（新照片或已有原图）。
- 未满足时点保存 → Toast「请先拍照或选择一张照片」，不落库。
- 名称留空允许，展示名按 `name → subcategory → 分类中文名` 回退。
- 主色自动预填仅在 `colorPrimary` 为空时发生（不覆盖用户已选）。

### 6.2 清洁状态机

```
        ┌────────── 标记「今天穿了」──────────┐
        │                                      ▼
     [clean 干净] ───────────────────────> [worn 穿过]
        ▲                                      │
        │ 手动设为干净                          │ 手动/洗好
        │                                      ▼
     [washing 洗涤中] <── 手动 ── [to_wash 待洗]
```

- 只能通过用户显式操作流转（v1 不自动流转）。
- `markWorn` 的副作用：`wearCount += 1`，`lastWornAt = 今天(本地 YYYY-MM-DD)`，若原为 `clean` 则变 `worn`。
- 推荐/筛选中「干净」是可穿的前提（M4 起生效）。

### 6.3 筛选与搜索（`stores/wardrobe.ts`）

```
filtered = items
  .filter(category === 'all' || item.category === category)
  .filter(clean === 'all' || item.cleanState === clean)
  .filter(query === '' || haystack.includes(query.toLowerCase()))
```

其中 `haystack` 由以下字段以空格拼接后转小写：

```
name, brand, subcategory, location, material, ...tags, ...seasons, ...styles
```

排序：`createdAt` 倒序（最新录入在最前）。

> ⚠️ 已知缺陷（M2 未修，仍待办）：`seasons`/`styles` 拼的是枚举 id（`commute`），不是中文标签（`通勤`），所以搜「通勤」搜不到。修复方式见 §15.2 第 1 条。

### 6.4 分类与子类联动

- 切换大类时，若已选子类不属于新大类，则清空 `subcategory`。
- 子类选项来自 `CategoryDef.subcategories`（见 §17.1）。

### 6.5 统计口径（设置页）

- 件数：`items.length`
- 累计穿着次数：`Σ wearCount`
- 衣橱总价值：`Σ price`（缺失按 0）
- 分类分布：按 `category` 计数

### 6.6 删除规则

- 单品删除需二次确认（`window.confirm`），文案包含单品名。
- 删除后回到衣柜页，Toast「已删除」。
- v1 无回收站/撤销。

---

## 7. 图片处理流水线

### 7.1 流程

```
<input type=file accept=image/* capture=environment>  （或相册选择）
        │
        ▼
  decode(Blob) ── createImageBitmap({imageOrientation:'from-image'})
        │          └─ 失败则 createImageBitmap(blob)
        │          └─ 再失败则 <img> + ObjectURL
        ▼
  ┌───────────────┬────────────────┬──────────────────┐
  │ 1600px 原图    │ 420px 缩略图    │ 96px 主色采样     │
  │ WebP q0.85    │ WebP q0.85     │ 桶统计 + 吸附色板  │
  └───────────────┴────────────────┴──────────────────┘
        │                │                  │
    images(original)  item.thumb      item.colorPrimary
```

### 7.2 参数（必须一致）

| 参数 | 值 |
| --- | --- |
| `ORIGINAL_MAX_EDGE` | 1600 |
| `THUMB_MAX_EDGE` | 420 |
| `SAMPLE_MAX_EDGE` | 96 |
| `QUALITY` | 0.85 |
| 缩放策略 | `Math.min(1, maxEdge / max(w,h))`，保持比例 |

### 7.3 编码降级

1. 先探测 WebP：编码 2×2 空画布，检查 `blob.type === 'image/webp'`，结果缓存在模块变量。
2. 支持则 `toBlob('image/webp', 0.85)`。
3. 不支持或返回 null 则 `toBlob('image/jpeg', 0.85)`。
4. 仍失败抛 `图片编码失败`。

### 7.4 主色识别算法（伪代码）

```
canvas = render(src, 96)
data = getImageData()
corners = 四角像素颜色
for each pixel:
    if alpha < 200: skip
    if 与任意角落颜色三通道差值均 < 42: skip   // 判定为背景
    key = (r>>4)<<8 | (g>>4)<<4 | (b>>4)        // 16 级量化
    bucket[key] 累加 n, r, g, b
取 n 最大的桶，计算平均 RGB → hex
hex → nearestPaletteHex(hex)   // 欧氏距离最近的色板项
```

失败（读不到像素、无有效像素）→ `colorHex = undefined`，照片仍成功保存。

### 7.5 失败处理

- `processPhoto` 抛错 → 编辑页 Toast「照片处理失败，请重试」，`processing` 复位。
- 解码使用 `finally` 关闭 `ImageBitmap`，避免内存泄漏。

### 7.6 M2 抠图（已实现）

- 新增 `kind: 'cutout'`，写入 `images` 表，`hasCutout = true`。
- 在 1024px 图上执行，输出带 alpha 的 WebP（浏览器不支持 WebP alpha 时退回 PNG）。
- 抠图后做**透明边裁切 + 4px 内边距**，同时生成透明底缩略图并覆盖 `item.thumb`，
  因此衣柜卡片与搭配预览默认显示透明底。
- 失败不阻断：保留原图，`hasCutout = false`；详情页「一键抠图」与设置页「重新抠图全部」
  均可重试（后台队列见 `src/stores/cutout.ts`）。

---

## 8. 备份格式 v1

### 8.1 文件

- 扩展名：`.wardrobe`（本质是 zip）
- 文件名：`wardrobe-YYYYMMDD-HHmm.wardrobe`
- MIME：`application/zip`

### 8.2 内部结构

```
manifest.json
items.json
outfits.json
outfitItems.json
wearLogs.json                  （M4 新增；旧备份可能没有）
settings.json
README.txt
thumbs/<itemId>.webp
images/<itemId>.original.webp
images/<itemId>.cutout.webp     （M2 后可能出现）
covers/<outfitId>.webp          （M3 后可能出现）
```

### 8.3 `manifest.json`

```json
{
  "format": "wardrobe-backup",
  "version": 1,
  "exportedAt": "2026-10-20T01:15:00.000Z",
  "counts": { "items": 1, "images": 2, "outfits": 1, "outfitItems": 3, "wearLogs": 2 }
}
```

### 8.4 `items.json`

`Item[]` 的 JSON，**移除 `thumb` Blob**，改为记录路径：

```json
[{
  "id": "uuid",
  "category": "top",
  "seasons": ["spring"],
  "tags": ["基础款"],
  "hasOriginal": true,
  "hasCutout": false,
  "thumbFile": "thumbs/uuid.webp",
  "...": "其余字段同 §5.2"
}]
```

### 8.5 `settings.json`

`SettingRow[]`（含 `lastBackupAt`）。

> `outfits.json` 为 `Outfit[]`，移除 `cover` Blob 并记录 `coverFile`；`outfitItems.json` 为 `OutfitItem[]`；`wearLogs.json` 为 `WearLog[]`。

### 8.6 导出流程

1. 读 `items`、`images`、`outfits`、`outfitItems`、`wearLogs`、`settings` 全表。
2. 逐条把 Blob 转 `Uint8Array`，按 §8.2 的路径放入 map。
3. `zip(files, { level: 6 })`（异步，避免长时间阻塞）。
4. `Blob` + `<a download>` 触发下载（ObjectURL 10 秒后回收）。
5. 成功后写 `settings.lastBackupAt = now`，刷新设置页提示。

### 8.7 导入流程

```
unzipSync(ArrayBuffer)
  └─ 失败 → "无法解压，文件可能已损坏"
读 manifest.json
  ├─ format !== 'wardrobe-backup' → "不是有效的衣橱备份文件"
  └─ version > 1 → "备份来自更新的版本，请先升级应用"
读 items.json / settings.json（缺失 settings 允许）
读 outfits.json / outfitItems.json（缺失时视为旧版备份，保留本机搭配）
读 wearLogs.json（缺失时视为旧版备份，保留本机穿着记录）
逐条校验：id 为 string、category 为 string；数组/对象字段给默认值
thumb 从 thumbFile 读取并按 itemId 重建 Blob
images 按 images/<itemId>.<kind>.webp 重建，id = `${itemId}:${kind}`
cover 从 coverFile 读取并按 outfitId 重建 Blob
wearLog 校验 id/date/itemIds；缺失字段给默认值
单个 rw 事务：
  replace → clear items + images；若备份含 outfits.json，同时 clear outfits + outfitItems
            若备份含 wearLogs.json，同时 clear wearLogs
  merge   → 直接 bulkPut（按主键 upsert）
  settings 不因 replace 清空
```

导入前必须 `window.confirm` 告知模式（合并/覆盖）。

### 8.8 版本演进

- 只增字段不删字段；
- M3 新增 `outfits.json` / `outfitItems.json` / `covers/` 为可选内容，`version` 保持 1：
  旧版导入会忽略未知文件；新版导入旧备份时保留本机搭配；
- M4 新增 `wearLogs.json` 为可选内容，同样保持 `version` 1；导入旧备份时保留本机穿着记录；
- 后续出现破坏性变更时再递增 `version`，导入端对低版本做默认值补齐；
- 高版本文件拒绝导入并提示升级 App。

---

## 9. PWA 与部署

### 9.1 构建配置要点

```ts
base: './',

VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {
    name: '衣橱 · Wardrobe',
    short_name: '衣橱',
    lang: 'zh-CN',
    theme_color: '#191b22',
    background_color: '#191b22',
    display: 'standalone',
    orientation: 'portrait',
    start_url: './',
    scope: './',
    icons: [
      { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    // M2：抠图模型与资源走 CDN，首次下载后 CacheFirst 缓存，二次离线可用
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/staticimgly\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'imgly-cutout-model',
          expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
          rangeRequests: true,
        },
      },
    ],
  },
})
```

### 9.2 `index.html` 必需 meta

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
<meta name="theme-color" content="#191b22" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="衣橱" />
<meta name="mobile-web-app-capable" content="yes" />
<link rel="apple-touch-icon" href="./apple-touch-icon.png" />
```

### 9.3 图标

- 源文件 `public/favicon.svg`：紫蓝渐变圆角方块 + 深色衣架线条。
- `scripts/gen-icons.mjs` 用 sharp 生成：
  - `pwa-192.png` / `pwa-512.png` / `apple-touch-icon.png`（180）
  - `pwa-maskable-512.png`：内容缩到 380×380，四周补 66px 背景色 `#5b6fe0`。
- 命令：`npm run icons`。

### 9.4 部署

`dist/` 为纯静态产物，哈希路由无需重写规则。

```bash
npm run build
npx wrangler pages deploy dist --project-name wardrobe
```

或 Cloudflare 面板 Pages → 直接拖拽 `dist` 文件夹。

### 9.5 安装引导（设置页固定文案）

- iPhone：Safari → 分享 → 添加到主屏幕
- Android：Chrome → 菜单 → 安装应用
- 从主屏图标启动可获得独立窗口和更稳定的存储

### 9.6 存储持久化

- App 启动即调用 `navigator.storage.persist()`（`services/storage.ts`）。
- 设置页显示 `persisted()` 状态与 `estimate()` 用量条。
- 未授予时显示「申请持久化存储」按钮。

> iOS 上 PWA 存储仍可能被系统回收，因此 **导出备份是唯一的可靠保障**。

---

## 10. UI/UX 规范

### 10.1 设计 Token（`src/style.css`）

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#191b22` | 页面底色 |
| `--bg-elev` | `#22252f` | 卡片 / 输入区背景 |
| `--bg-elev-2` | `#2b2f3b` | 次级按钮 |
| `--bg-input` | `#2f3340` | 输入框 |
| `--border` | `#363b49` | 常规边框 |
| `--border-strong` | `#4a5063` | 强调边框 |
| `--text` | `#f4f6fb` | 主文字 |
| `--text-dim` | `#b6bdcd` | 次文字 |
| `--text-faint` | `#8d95a8` | 辅助文字 |
| `--accent` | `#9aaaff` | 主色（文字/选中） |
| `--accent-strong` | `#7c8fff` | 主按钮底色 |
| `--accent-soft` | `rgba(154,170,255,.16)` | 选中背景 |
| `--danger` | `#ff7b7b` | 删除 |
| `--radius` | 14px | 卡片 |
| `--radius-sm` | 10px | 输入框 |
| `--radius-lg` | 20px | 大图 |
| `--tabbar-h` | 58px | Tab 栏高度（叠加安全区） |

字体：`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Roboto, sans-serif`。

### 10.2 布局约定

| 元素 | 规范 |
| --- | --- |
| `.topbar` | sticky top 0，`padding-top: safe-top + 14px`，毛玻璃 88% + blur 14 |
| `.tabbar` | fixed bottom，高度 `58px + safe-bottom`，毛玻璃 92% |
| `.savebar` | fixed bottom，编辑页专用，`padding-bottom: safe-bottom + 12` |
| 页面底部留白 | 有 Tab 栏时 `--tabbar-h + safe-bottom`；编辑页 `96px` |
| 单列内容边距 | 左右 16px |
| 网格 | `repeat(auto-fill, minmax(142px, 1fr))`，gap `14px 12px` |
| FAB | 54×54，圆角 18，右下 `18px`，位于 Tab 栏之上 |
| 卡片图 | `aspect-ratio: 3/4`，棋盘格底，图片 `contain` |

### 10.3 组件清单（`src/components/`）

| 组件 | Props | 事件 | 说明 |
| --- | --- | --- | --- |
| `AppTabBar` | — | — | 4 个 Tab，读取 `route.name` 前缀高亮 |
| `Icon` | `name, size=22, stroke=1.7` | — | 内联 SVG 描边图标，20 个图标名 |
| `ToastHost` | — | — | 全局 Toast，底部居中，2.2s 自动消失 |
| `ChipGroup` | `options, modelValue:string[], multiple=true, scroll=false` | `update:modelValue` | 单选/多选 chips；单选可再次点击取消 |
| `CategoryPicker` | `modelValue: CategoryId` | `update:modelValue` | 4 列网格 + emoji |
| `ColorPicker` | `primary?, secondary=[], maxSecondary=2` | `update:primary`, `update:secondary` | 8 列色板，主色单选、副色多选 |
| `LevelPicker` | `value?, labels?, lowLabel?` | `update:value` | 1–5 档，柱状高度递增 |
| `PhotoField` | `blob, processing?, hasStored?` | `pick(file)`, `clear` | 拍照/相册双入口，预览 + 重拍/移除 |
| `ItemCard` | `item` | — | 衣柜网格卡片，含清洁状态角标与主色点；`item.hasCutout` 时透明底 + 棋盘格 |
| `BlobThumb` | `blob?` | — | `Blob → ObjectURL` 的 `<img>`，用于连拍队列/分类缩略图 |
| `CutoutIndicator` | — | — | 全局抠图进度胶囊，挂在 `App.vue`；完成时 Toast 汇总成功/失败数 |
| `OutfitPreview` | `pieces, aspectRatio?, emptyText?` | — | 按槽位与 `layer` 用 DOM 绝对定位叠放缩略图，无槽位时显示空态 |
| `OutfitCard` | `outfit, pieces, count` | — | 搭配列表卡片，优先显示 `cover`，无封面时用 `OutfitPreview` |
| `SlotPickerSheet` | `open, slot, items, excludeIds, seasons` | `close`, `select(item)` | 底部候选抽屉，默认过滤「干净 · 在役 · 当季」，可切「显示全部」 |
| `TodayPick` | `outfit, pieces, count, worn, picked` | `wear` | M4 今日候选套装卡片，优先 `cover`，无封面时用 `OutfitPreview` |

图标名：`grid, shirt, sun, gear, plus, camera, photo, back, trash, pencil, search, download, upload, close, check, alert, sparkle, hanger, pin, refresh`。

### 10.4 页面细节

#### 衣柜 `/`

- 顶部 sticky：标题「我的衣橱」+ 副标题「共 N 件 · 显示 M 件」+ 右上 `+`。
- 搜索框：占位「搜索名称、品牌、标签…」，有内容时显示清除按钮。
- 两行横向滚动 chips：分类（全部 + 7 类）、清洁状态（状态不限 + 4 态）。
- 网格卡片：缩略图、右上清洁 emoji 角标、左下主色圆点、名称、分类。
- 空状态分两种：完全没有衣服（引导「添加第一件」）与筛选无结果。
- FAB 仅在已有衣服时显示。

#### 添加/编辑 `/item/new`、`/item/:id/edit`

区块顺序：

1. 照片（4:5，虚线框空态 + 拍照/相册）
2. 分类（4 列网格）
3. 名称输入
4. 子类 chips
5. 适合季节 chips
6. 风格 chips
7. `<details>`「更多信息（可选）」：图案、颜色、正式度、保暖度、材质、品牌/尺码、价格/购入日期、存放位置、在役状态、清洁状态、标签、备注

- 顶部右上「保存」，底部固定「加入衣橱 / 保存修改」。
- 编辑模式会加载已有原图作为预览。
- 处理照片时覆盖「处理中…」遮罩，保存按钮禁用。

#### 单品详情 `/item/:id`

- 顶部返回 + 标题 + 编辑按钮。
- 1:1 大图，点击全屏查看（黑底 + 关闭按钮）。默认显示抠图（透明底 + 棋盘格）；无抠图时显示原图。
- 图片下方「原图 / 抠图」切换；无抠图时显示「一键抠图」（WebGPU 优先、失败回退 CPU，完成后自动切到抠图）。
- 操作行：「今天穿了」「编辑」。
- 清洁状态 4 个 chips，点击即改。
- Facts 行：颜色（带色点）、季节、风格、标签。
- 详细信息 dl：分类、图案、材质、品牌、尺码、价格、购入日期、存放位置、正式度、保暖度、在役状态、穿着次数、最后穿着。
- 「删除这件单品」红色按钮（确认后删除）。

#### 连续录入 `/capture`（M2）

- 无 Tab 栏，顶部返回；分两步：`capture`（拍摄队列）与 `classify`（批量分类）。
- 空态：大按钮「拍第一件」+「相册批量」。
- 队列态：横向滚动缩略图（处理中遮罩 / 失败角标 + 重试或移除），主按钮「拍下一件」，
  次按钮「下一步：分类（N 件）」；有处理中或失败时禁用。
- 分类态：每件一张卡片（缩略图 + 可选名称 + 7 个分类按钮），分类默认沿用上一张；
  底部固定「加入衣橱（N 件）」，保存后 Toast「已加入 N 件」并加入后台抠图队列。
- 队列与分类两步之间用 `onBeforeRouteLeave` 拦截未保存离开（`window.confirm`）。

#### 搭配列表 `/outfits`

- 顶部 sticky：标题「搭配」+ 副标题「共 N 套 · 用槽位把单品拼成套装」+ 右上 `+`。
- 网格卡片：封面（无封面时用叠穿缩略图）、名称、单品数、前 2 个场合、收藏星标。
- 空态引导「新建第一套」；已有搭配时显示 FAB。

#### 新建/编辑搭配 `/outfits/new`、`/outfits/:id/edit`

- 区块顺序：叠穿预览 → 名称 → 适合季节 → 场合 → 7 个纵向槽位卡片 → 备注。
- 槽位卡片显示已选单品缩略图与名称，点击打开底部候选抽屉；每个槽位可单独移除。
- 配饰槽允许多件，可「再添加一件」；其它槽位再次选择即替换。
- 候选默认「干净 · 在役 · 当季」，可切「显示全部」；已用于其它槽位的单品不再出现。
- 保存时至少需要 1 件单品；保存后生成 Canvas 封面并跳到搭配详情。

#### 搭配详情 `/outfits/:id`

- 顶部返回 + 名称 + 收藏 + 编辑；大图叠穿预览。
- 操作行：「分享长图」「编辑」。
- 单品清单按槽位分组，点击进入单品详情；单品被删除时显示「单品已删除」。
- 备注与「删除这套搭配」红色按钮（二次确认）。

#### 设置 `/settings`

1. 衣橱概览：3 个统计卡 + 分类分布列表。
2. 备份与迁移：备份提示（今天/ N 天前/超过 7 天警告）+ 导出 + 导入模式 chips + 选择文件。
3. 本地存储：用量条 + 持久化状态 + 申请按钮。
4. 照片与抠图（M2）：已抠图 N / M 件说明 + 队列进度条 + 「重新抠图全部」。
5. 安装到主屏幕：iOS/Android 操作说明。

#### 今日 `/today`（M4）

1. 顶部：标题「今天」+ 本地日期（`M月D日 周X`）+ 右上位置按钮。
2. 天气卡：
   - 已设置位置：天气 emoji + 温度 + 天气文案 + 刷新按钮；副行显示城市与更新时间和「季节 + 建议保暖级别」。
   - 未设置位置：提示「按天气挑今天穿什么」+「设置城市」按钮。
   - 底部弹层设置位置：搜索城市（Open-Meteo Geocoding）、使用当前定位、手动输入经纬度。
   - 离线或请求失败时显示 `settings.weatherCache` 上次数据，并标注「天气为上次数据」。
3. 今日记录：当天已记录的套装，显示名称、件数、场合、天气；刚记录的一条高亮。
4. 场合 chips：不限 / 通勤 / 休闲 / 正式 / 运动 / 约会。
5. 今天穿什么：候选套装最多 3 套，按收藏 > 评分 > 更新时间排序；每套显示封面/叠穿图、名称、件数与场合，按钮「穿这套」。
   - 「穿这套」写入 `wearLogs` 并对其所有单品执行 `markWorn`；同一天同一套重复点击只更新场合/天气，不重复累计。
   - 「随便穿一套」从当前候选里随机高亮一套。
   - 无候选时提示当前季节/场合筛选条件，给出「看看其他场合」或「去整理搭配」。
6. 最近穿过：默认最近 6 条历史记录，可展开全部；显示日期、名称、件数、场合、天气，点「查看」进入搭配详情。

筛选规则：套内单品必须存在、`status === 'active'` 且 `cleanState === 'clean'`；季节取 `outfit.seasons`，为空时取套内单品季节并集，仍为空则视为当季通用；选择了场合时要求 `outfit.occasions` 包含该场合。

无天气或未设置城市时，按当前月份推断季节。

### 10.5 文案规范

- 中文，口语化、短句，不用感叹号营销腔。
- 按钮用动词：「加入衣橱」「今天穿了」「导出备份」。
- 错误提示包含下一步：「照片处理失败，请重试」。
- 单位：件、次、天、MB。

### 10.6 交互约束

- 所有可点区域 `:active` 缩小到 0.95–0.98 或变色，给触觉反馈感。
- 危险操作二次确认。
- 操作结果一律 Toast，2.2 秒。
- 不使用 hover 作为唯一反馈（手机无 hover）。

---

## 11. 代码结构

```
wardrobe/
├─ index.html
├─ vite.config.ts            # base './'、@ 别名、PWA、vitest 配置
├─ tsconfig*.json            # paths: @/* → src/*
├─ package.json
├─ scripts/gen-icons.mjs     # sharp 生成 PWA 图标
├─ public/
│  ├─ favicon.svg            # 图标源
│  ├─ pwa-192.png
│  ├─ pwa-512.png
│  ├─ pwa-maskable-512.png
│  └─ apple-touch-icon.png
└─ src/
   ├─ main.ts                # createApp + pinia + router + 持久化申请
   ├─ App.vue                # 壳层：router-view + TabBar + Toast
   ├─ style.css              # 设计 token + 通用类
   ├─ router/index.ts        # hash 路由 + scrollBehavior
   ├─ db/
   │  ├─ types.ts            # 全部实体类型
   │  ├─ constants.ts        # 分类/枚举/色板/标签映射
   │  ├─ db.ts               # Dexie 定义与版本
   │  ├─ repo.ts             # item/image/outfit/wearLog/setting 读写 + newId/nowIso
   │  └─ repo.spec.ts
   ├─ services/
   │  ├─ image.ts            # 压缩、缩略图、主色、色板吸附
   │  ├─ image.spec.ts
   │  ├─ cutout.ts           # M2 抠图：动态 import + WebGPU/CPU + 裁边补边 + 透明 WebP
   │  ├─ collage.ts          # M3 叠穿布局、封面合成、分享长图 / 系统分享
   │  ├─ today.ts            # M4 本地日期、季节映射、候选筛选与排序
   │  ├─ today.spec.ts
   │  ├─ weather.ts          # M4 Open-Meteo 天气 + 城市搜索 + WMO 文案
   │  ├─ weather.spec.ts
   │  ├─ backup.ts           # zip 导出/导入（含 outfits/outfitItems/wearLogs）
   │  ├─ backup.spec.ts
   │  └─ storage.ts          # persist / estimate / formatBytes
   ├─ stores/
   │  ├─ wardrobe.ts         # 单品状态、筛选、CRUD、toPersistable、attachCutout
   │  ├─ outfits.ts          # M3 套装 CRUD、套内单品、layer 计算
   │  └─ cutout.ts           # M2 后台抠图队列（串行、进度、失败计数）
   ├─ composables/
   │  ├─ useObjectUrl.ts     # Blob → ObjectURL，自动回收
   │  └─ useToast.ts         # 模块级单例 Toast
   ├─ components/            # 见 §10.3
   ├─ views/                 # 见 §4.2
   └─ test/setup.ts          # fake-indexeddb + Node Blob
```

**依赖方向（必须单向）**：

```
views/components → stores → db/repo → db/db
                 ↘ services
composables 与 db/services 均可被 views/components 使用
db 不得 import stores/views
```

---

## 12. 已实现功能与验收标准

### 12.1 功能清单（M1）

| # | 功能 | 验收标准 |
| --- | --- | --- |
| 1 | 衣柜网格 | 有数据时按创建时间倒序展示；缩略图、名称、分类、清洁角标正确 |
| 2 | 拍照 / 相册导入 | 点击「拍照」调起相机；「相册」可选已有图；选图后出现预览 |
| 3 | 图片压缩 | 原图最长边 ≤1600px，缩略图 ≤420px，格式 WebP（不支持时 JPEG） |
| 4 | 主色自动识别 | 照片处理后自动选中一个色板颜色；用户可改 |
| 5 | 单品录入 | 分类 + 照片即可保存；其余字段可选 |
| 6 | 子类联动 | 切换大类后子类选项随之变化，非法子类被清空 |
| 7 | 单品详情 | 显示大图与全部已填字段；未填显示「—」 |
| 8 | 全屏看图 | 点击大图进入黑底全屏，可关闭 |
| 9 | 今天穿了 | 点击后 `wearCount+1`、写入 `lastWornAt`、`clean` 变 `worn` |
| 10 | 清洁状态 | 4 态可切换并持久化 |
| 11 | 编辑 | 回填全部字段与照片；保存后详情更新 |
| 12 | 删除 | 二次确认；同时删除图片行；返回衣柜 |
| 13 | 筛选 | 分类 + 清洁状态组合筛选即时生效 |
| 14 | 搜索 | 名称/品牌/子类/位置/材质/标签可命中 |
| 15 | 空状态 | 无数据与无筛选结果有不同引导 |
| 16 | 统计 | 件数、累计穿着、总价值、分类分布准确 |
| 17 | 存储信息 | 显示用量/配额与持久化状态；可申请持久化 |
| 18 | 导出备份 | 下载 `.wardrobe`；成功后记录 `lastBackupAt` 并更新提示 |
| 19 | 导入备份 | 合并/覆盖两种模式；导入后数据立即可见 |
| 20 | PWA | 生产构建生成 manifest 与 service worker，可安装 |
| 21 | 离线 | 已安装且访问过一次后，断网可打开 app shell |
| 22 | 移动端适配 | 390×844 下无横向滚动；安全区正确；无 300ms 延迟 |

### 12.2 功能清单（M2 + M3 + M4）

| # | 功能 | 验收标准 |
| --- | --- | --- |
| 23 | 端上抠图 | 拍照后自动生成透明底；失败不阻断保存，可重试 |
| 24 | WebGPU 优先 | 支持 WebGPU 时用 GPU，否则/失败回退 CPU |
| 25 | 抠图裁边补边 | 裁掉透明边界并四周补 4px，输出 WebP(alpha)，不支持时 PNG |
| 26 | 透明底缩略图 | 抠图成功后覆盖 `item.thumb`，卡片/详情默认透明底 + 棋盘格 |
| 27 | 后台抠图队列 | 串行执行，任意页面可见进度，完成 Toast 汇总成功/失败 |
| 28 | 连续拍摄队列 | `/capture` 可连拍 N 件，队列可预览、失败可重试、可移除 |
| 29 | 批量分类保存 | 每张一排 7 类按钮，默认沿用上张；一次入库并提示「已加入 N 件」 |
| 30 | 重新抠图全部 | 设置页一键入队全部有原图的单品，带进度与失败计数 |
| 31 | 搭配列表 | 展示封面或叠穿缩略图、名称、单品数、场合与收藏 |
| 32 | 槽位选衣 | 7 个槽位可单独选择/更换/移除；配饰可多件，其它槽位单选 |
| 33 | 候选过滤 | 抽屉默认「干净 · 在役 · 当季」，可切「显示全部」；排除已用单品 |
| 34 | 叠穿预览 | 修改槽位后即时刷新，按槽位和 `layer` 叠放 |
| 35 | 保存与复用 | 至少 1 件即可保存；列表/详情可再次打开、编辑、收藏、删除 |
| 36 | Canvas 封面 | 保存时生成 1080×1440 封面；失败不阻断保存 |
| 37 | 分享长图 | 生成 1080×1620 图片（预览 + 名称 + 标签 + 单品清单 + 日期）；系统分享优先，降级下载 |
| 38 | 搭配备份 | 导出/导入包含 `outfits / outfitItems / covers`；旧备份导入保留本机搭配 |
| 39 | 今日天气 | 可搜索城市 / 定位 / 手输经纬度；显示温度、天气文案、季节与建议保暖级别；离线显示上次缓存 |
| 40 | 候选套装 | 按「季节 ∩ 场合 ∩ 全部单品干净且在役」过滤，最多 3 套，收藏/评分优先 |
| 41 | 随便穿一套 | 从当前候选中随机高亮一套 |
| 42 | 记录穿着 | 点「穿这套」写入 `wearLogs`，套内单品 `wearCount+1`、`lastWornAt=今天`、`clean` 变 `worn` |
| 43 | 同日去重 | 同一天同一套装重复记录只覆盖，不重复累计穿着次数；同一天可记录多套 |
| 44 | 今日记录 | 当天记录置顶显示，刚记录的一条高亮 |
| 45 | 穿着历史 | 最近 6 条历史可展开全部，显示日期、名称、件数、场合、天气，可进入搭配详情 |
| 46 | 未设置天气降级 | 未设置城市时按当前月份推断季节；无网络仍可手动选择并记录 |
| 47 | 穿着记录备份 | 导出/导入包含 `wearLogs.json`；旧备份导入保留本机穿着记录 |

### 12.3 当前验证状态

```
npm run typecheck   ✔ 通过
npm test            ✔ 5 文件 / 31 用例通过
npm run build       ✔ 通过，PWA precache 44 项
Playwright 冒烟     ✔ 录入→详情→网格→导出备份，0 控制台错误
Playwright M2 E2E   ✔ 连拍上传→分类保存→后台抠图→衣柜透明底→详情切换
Playwright M3 E2E   ✔ 7 槽位选衣（配饰多件）→ 保存生成封面 → 详情/分享下载 → 收藏 → 编辑移除 → 列表封面，0 控制台错误
Playwright M4 E2E   ✔ 手动设置城市 → 天气渲染（模拟 Open-Meteo）→ 候选套装 → 穿这套写入穿着记录、单品转 worn → 备份含 wearLogs.json，0 控制台错误（截图见 docs/screenshots/m4）
抠图实测（无头）     ✔ 冷启动 71s（含 88MB 模型下载）；热启动 9.9s（单线程回退）
```

### 12.4 里程碑进度

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| M1 | 录入 / 详情 / 筛选搜索 / 统计 / 备份 / PWA | ✅ 已实现并上线（`https://wardrobe-eec.pages.dev`） |
| M2 | 端上抠图（`@imgly/background-removal`）+ 连续拍摄队列 | ✅ 已实现并上线（commit `08639f4`） |
| M3 | 槽位搭配、叠穿预览、分享长图 | ✅ 已实现（M3） |
| M4 | 今天 + 天气 + 穿着记录 | ✅ 已实现（M4） |
| M5 | 规则推荐 + 统计 | ⏳ 设计完成（§14.4），未开发 |

**下一步建议**：M5 规则评分与统计页（成本穿着比、久未穿、闲置提醒）。
M4 小改进：§15.2 第 9/10 条（清除天气位置、跨午夜日期刷新）。
顺手可修：§6.3 / §15.2 第 1 条的搜索中文标签缺陷。

---

## 13. 测试

### 13.1 策略

- 只测**纯逻辑与数据层**：repository、备份往返、颜色吸附。
- 图像处理依赖 Canvas，jsdom 无法真实渲染 → 只测纯函数 `nearestPaletteHex`。
- 抠图依赖 Canvas + ONNX/WASM，jsdom 无法运行 → 用真实无头 Chromium（`E:\workspace\HomemadeTools\headless_browser`）跑一次真实抠图与端到端流程。
- UI 用 Playwright 做冒烟，不做快照。

### 13.2 环境

```ts
// vite.config.ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.spec.ts'],
}
```

```ts
// src/test/setup.ts
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
// jsdom 的 Blob 没有 arrayBuffer，且无法被 structuredClone，必须替换
globalThis.Blob = NodeBlob as unknown as typeof Blob
```

### 13.3 现有用例

| 文件 | 用例 |
| --- | --- |
| `db/repo.spec.ts` | 单品/图片读写与级联删除；套装与套内单品 CRUD、整体替换、删除单品时清理套装引用；穿着记录写入、同日同套去重不重复累计、同日多套并存 |
| `services/backup.spec.ts` | 导出→清库→导入完整还原（含 thumb、原图、套装、套内单品、封面与穿着记录）；merge 幂等；replace 清理旧搭配与穿着记录；旧备份不含 `wearLogs.json` 时保留本机穿着记录；非法文件报错 |
| `services/image.spec.ts` | 色板精确命中；越界颜色吸附到最近项 |
| `services/today.spec.ts` | 本地日期 key 与今日标题；温度→季节与保暖级别；今天/昨天/跨年日期标签；套装季节回退、在役/干净/季节/场合过滤与收藏/评分排序；空季节套装视为通用 |
| `services/weather.spec.ts` | WMO 天气码中文文案与 emoji（晴/多云/雾/雨雪/雷阵雨）；未知天气码回退「天气未知」 |

### 13.4 每个用例的 beforeEach

```ts
await db.delete()
await db.open()
```

---

## 14. 后续功能详细设计

进度总览见 §12.4。

### 14.1 M2 — 端上抠图 + 连续拍摄队列（已实现）

> 状态：已实现（代码 M2）。抠图优先 WebGPU、失败回退 CPU；模型走 CDN 并纳入 SW 运行时缓存。

**目标**：让搭配预览好看；让批量录入 20 件成为可能。

**依赖**：`@imgly/background-removal`（浏览器端 ONNX，模型首次下载后缓存，无需服务端）。

**实现要点（与文档原始设想的差异）**

- 模型用 `isnet_fp16`（约 88MB）；优先 `device: 'gpu'`（WebGPU），不可用或抛错时回退 `device: 'cpu'`。
- 输出 WebP(alpha)；浏览器不支持 WebP alpha 时回退 PNG（**不能**回退 JPEG，会丢 alpha）。
- 抠图成功后同时生成透明底缩略图并覆盖 `item.thumb`，这样卡片与后续搭配预览无需另读 `cutout` 大图。
- 抠图队列独立于页面（`stores/cutout.ts`），保存/离开页面后继续执行；全局 `CutoutIndicator` 显示进度。
- 模型与 wasm 走 CDN，已加入 Workbox `runtimeCaching`（CacheFirst）。

**图片流程变更**

1. 现有流程保留，增加第 4 步：
   ```
   1024px 缩放 → background-removal → 透明 PNG
   → 裁掉透明边界 → 四周补 4px → 编码 WebP(alpha)
   → images(`${id}:cutout`) + hasCutout = true
   ```
2. 抠图失败不阻断保存：保留原图，`hasCutout = false`，Toast 提示「已保存，抠图稍后可重试」。

**连续拍摄队列**

- 新路由 `/capture`：
  - 大按钮「拍下一件」，可连续拍 N 张。
  - 每张进入队列：`{ tempId, blob, status: 'pending'|'processing'|'done'|'error' }`。
  - 队列可横向滑动预览，支持删除单张。
  - 全部拍完后进入「批量分类」：每张卡片下方一排 7 个分类按钮，默认沿用上一张的分类。
  - 一次性批量写入，全部完成显示「已加入 N 件」。

**UI 变更**

- 单品详情增加「原图 / 抠图」切换。
- 衣柜卡片优先显示抠图（透明底更统一），无抠图则显示原图。
- 设置页增加「重新抠图全部」入口（后台队列 + 进度）。

**验收**

- 单张抠图在 Android Chrome 中 ≤ 8 秒，失败可重试。
- 连续录入 20 件全程无需回到衣柜页。
- 抠图后搭配预览无白底。

---

### 14.2 M3 — 槽位搭配（已实现）

> 状态：已实现。手动选槽位组合，不做自由拖拽；封面与分享共用 `services/collage.ts` 的布局函数。

**目标**：把单品组合成可复用的「套装」。

**数据结构**：`outfit` / `outfitItem`，字段见 §5.4。

**槽位规则**

- 固定顺序：`外套 → 上装 → 内搭 → 下装 → 鞋 → 箱包 → 配饰`。
- 每个槽位默认 1 件；`配饰` 允许多件（`layer` 递增）。
- 同一单品不能出现在同套装的多个槽位（配饰槽内也去重）。
- `layer` 决定渲染层级：按 `layer` 升序绘制，数字大的在上层（配饰 70+ 最上）。

**交互（不用自由拖拽）**

- 搭配编辑页：顶部叠穿预览 + 名称 / 季节 / 场合 + **纵向槽位卡片**：
  ```
  [外套]  ← 点击选择 / 更换
  [上装]
  [内搭]
  [下装]
  [  鞋 ]
  [  包 ]
  [配饰]  ← 可多个，「再添加一件」
  ```
- 点击槽位 → 底部抽屉：候选单品网格，默认过滤「干净 + 在役 + 当前季节」，
  可切「显示全部」；已用于其它槽位的单品不出现。
- 选择后即时刷新叠穿预览；其它槽位再次选择即替换，配饰追加。
- 至少 1 件才能保存；保存后生成封面并进入详情。

**封面与分享**

- 保存时用 Canvas 合成 1080×1440 预览图作为 `Outfit.cover`；失败只忽略，不阻断保存。
- 「分享长图」1080×1620：上方叠穿预览（占 1180px 高），下方名称、季节/场合标签、
  按槽位分组的完整单品清单（最多 7 个槽位）与日期水印。
- `navigator.share({ files })` 优先；不支持或失败时降级下载 `outfit-<名称>.png`；
  用户取消分享时提示已取消。

**验收**

- 3 分钟内可创建一套搭配。
- 修改槽位后预览即时刷新。
- 套装列表显示封面与单品数。

**实现约定**

1. **`layer` 取值**：主槽位按固定顺序取 `(index + 1) × 10`（外套 10、上装 20…… 配饰 70）；
   配饰槽内第 n 件为 `70 + n`。编辑时每次增删都会重新归一化。
2. **合成参数（`services/collage.ts` 统一实现，不得散落各页）**：
   - `pieceLayout(slot, index, count)` 返回归一化中心点与宽高；Canvas 与 `OutfitPreview` 共用。
   - 槽位布局：外套 0.80×0.56 @ (0.5, 0.40)、上装 0.64×0.46 @ (0.5, 0.41)、
     内搭 0.50×0.36 @ (0.5, 0.43)、下装 0.58×0.42 @ (0.5, 0.69)、
     鞋 0.34×0.18 @ (0.5, 0.90)、包 0.30×0.30 @ (0.82, 0.70)、
     配饰 0.24×0.24 @ (0.18, 0.76)。
   - 配饰多件：2 件左右分列；≥3 件沿底部 0.1→0.9 横向均分，尺寸缩到 0.18。
   - 每件按槽位盒等比缩放（contain），居中绘制，带投影；绘制顺序即 `layer` 升序。
   - 预览用 DOM 绝对定位（item.thumb），导出用同参数 Canvas；不做 720 中间画布。
3. **候选过滤**：默认「`cleanState === 'clean'` ∩ 当季 ∩ `status === 'active'`」，
   `outfit.seasons` 为空时不做季节过滤；「显示全部」关闭全部过滤。
4. **路由**：`/outfits`、`/outfits/new`、`/outfits/:id`、`/outfits/:id/edit`；
   `AppTabBar` 高亮用 `String(route.name).startsWith(match)`。
5. **备份**：`services/backup.ts` 已包含 `outfits / outfitItems / covers`；
   `manifest.counts` 增加 `outfits / outfitItems`。文件为可选，`version` 保持 1，
   旧备份导入时保留本机搭配（§8.7 / §8.8）。
6. **实际文件**：`services/collage.ts`、`stores/outfits.ts`、`components/OutfitPreview.vue`、
   `components/SlotPickerSheet.vue`、`components/OutfitCard.vue`、`views/OutfitsView.vue`、
   `views/OutfitEditView.vue`、`views/OutfitDetailView.vue`。
7. **页面刷新**：hash 路由切换不会重建 Pinia，搭配页面进入时 `wardrobe.load(true)` /
   `outfits.load(true)`，避免单品删除或导入后仍用旧缓存。
8. **明确不做**：自由拖拽排版、自动推荐组合（M5）。

---

### 14.3 M4 — 今天 + 天气 + 穿着记录（已实现）

> 状态：已实现。天气走 Open-Meteo（免 Key），城市可搜索、定位或手输坐标；离线缓存上次结果；未设置城市时按当前月份推断季节。

**目标**：把「看衣柜」变成「决定穿什么」。

**天气**

- 使用 Open-Meteo（免 Key）：
  - 天气：`https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`
  - 城市搜索：`https://geocoding-api.open-meteo.com/v1/search?name=&count=6&language=zh&format=json`
- 城市存 `settings.weatherLocation = { name, detail?, latitude, longitude }`；天气结果存 `settings.weatherCache`。
- 设置入口是今日页右上角的位置按钮，打开底部弹层：搜索城市 / 使用当前定位 / 手动输入经纬度；位置只存本机。
- 离线或请求失败时使用上次缓存并标注「天气为上次数据」；没有缓存时按月份推断季节，仍可手动记录。
- WMO 天气码映射中文文案与 emoji（`services/weather.ts` 的 `describeWeather`）。

**温度 → 季节映射**

| 体感温度 | 季节 | 建议保暖度 |
| --- | --- | --- |
| ≥ 26℃ | summer | 1–2 |
| 18–25℃ | spring / autumn | 2–3 |
| 8–17℃ | autumn / winter | 3–4 |
| < 8℃ | winter | 4–5 |

**今日页结构**

1. 顶部：本地日期 + 天气卡（城市、温度、天气、更新时间、刷新）。
2. 今日记录：当天已记录套装，刚记录的高亮。
3. 场合 chips：不限 / 通勤 / 休闲 / 正式 / 运动 / 约会。
4. 候选套装：按「季节 ∩ 场合 ∩ 全部单品干净且在役」过滤，最多 3 套，按收藏 > 评分 > 更新时间排序。
5. 「随便穿一套」：从当前 3 套候选中随机高亮。
6. 「穿这套」：写入 `wearLogs`，并对其所有单品执行 `markWorn`。
7. 最近穿过：默认最近 6 条历史，可展开全部。

**候选筛选规则（`services/today.ts`）**

- 套内单品必须存在、`status === 'active'`、`cleanState === 'clean'`。
- 季节取 `outfit.seasons`；为空时取套内单品 `seasons` 并集；仍为空视为当季通用。
- 选择了场合时要求 `outfit.occasions` 包含该场合；未选择时不限。
- 无天气或未设置位置时，`seasonsForTemperature(undefined)` 回退到当前月份季节。

**穿着记录规则**

- 同一天同一套装重复记录 → 覆盖而非新增（以 `date + outfitId` 去重），只更新场合/天气。
- 首次记录才累计单品 `wearCount`，避免重复点击把次数刷高。
- 同一天可记录多套搭配（如白天通勤 + 晚上约会）。
- `date` 用本地日期 `YYYY-MM-DD`；单品维度的记录用于成本穿着比与「久未穿」统计（M5）。

**实现文件**

- `services/today.ts` / `today.spec.ts`：日期、季节、筛选、排序。
- `services/weather.ts` / `weather.spec.ts`：天气、城市搜索、WMO 文案。
- `components/TodayPick.vue`、`views/TodayView.vue`：今日页与天气设置弹层。
- `db/repo.ts`：`listWearLogs / recordOutfitWear`；`stores/wardrobe.ts`：`markWorn` 改用本地日期。
- `services/backup.ts`：`wearLogs.json` 可选导出/导入。

**验收**

- 选场合后 1 秒内给出候选。
- 一键记录后，单品穿着次数与清洁状态同步更新，重复点击不重复累计。
- 无网络或未设置城市时仍可手动选择并记录。
- 旧备份（无 `wearLogs.json`）导入时不清空本机穿着记录。

---

### 14.4 M5 — 规则推荐 + 统计（已设计，未开发）

**目标**：不依赖机器学习，用可解释规则给出「能穿出门」的组合。

**候选生成**

```
for slot in [上装, 下装, 鞋]:
    候选 = items.filter(干净 && 季节匹配 && 在役)
组合采样：随机取 200 组（不足则全取）
```

**评分函数（满分 100）**

| 维度 | 权重 | 规则 |
| --- | --- | --- |
| 色彩和谐 | 30 | 中性色互相 +30；1 个彩色 + 中性色 +25；2 个彩色 +10；≥3 个彩色 +0 |
| 正式度一致 | 20 | `20 - 10 × (max - min)`，最低 0 |
| 温度匹配 | 20 | 平均保暖度与目标值差 0 → 20，每差 1 减 6 |
| 新鲜度 | 15 | 距上次穿着天数 / 30 × 15，上限 15 |
| 历史偏好 | 15 | (单品评分均值 - 3) / 2 × 15 + 7.5 |

- 同分时按「久未穿」优先。
- 使用日期做随机种子，保证同一天结果稳定。

**统计页（并入设置或单独 Tab）**

- 成本穿着比：`price / max(wearCount, 1)`，按从高到低排序（最不划算的在前）。
- 久未穿：`today - lastWornAt` 降序。
- 闲置提醒：`status === 'idle'` 或 90 天未穿。
- 分类覆盖率：有穿着记录的单品数 / 总数。

**验收**

- 推荐结果不包含待洗/洗涤中单品。
- 同一天多次进入「今天」结果一致。
- 统计与原始数据一致，可导出 CSV（可选）。

---

## 15. 已知问题与风险

### 15.1 已修复但必须记住的坑

**Vue reactive Proxy 无法写入 IndexedDB**

- 现象：保存时 `DataCloneError`，Toast「保存失败」。
- 原因：`reactive()` 产生的 Proxy 不能被结构化克隆。
- 修复：`stores/wardrobe.ts` 的 `toPersistable(item)`，用 `toRaw` + 展开数组/对象后再 `put`。
- 规则：**任何新增的写库路径都必须经过 `toPersistable`**。

**详情页滚动位置错乱**

- 修复：路由 `scrollBehavior` 返回 `{ top: 0 }`。

**「今天穿了」日期跨天**

- 现象：晚上记录穿着，`lastWornAt` 变成第二天。
- 原因：`toISOString().slice(0, 10)` 取的是 UTC 日期。
- 修复：`services/today.ts` 的 `localDateKey()` 用本地 `getFullYear/getMonth/getDate` 拼接；`markWorn` 与穿着记录统一使用它。

**WMO 天气码误判**

- 现象：未知天气码（如 123）被显示成「雷阵雨」。
- 原因：只判断了 `code >= 95`，没有上限。
- 修复：`code >= 95 && code <= 99` 才映射雷阵雨，其余回退「天气未知」。

**Dexie 多表事务的 TS 重载上限**

- 现象：`db.transaction('rw', a, b, c, d, e, f, fn)` 报 “Expected 3-7 arguments”。
- 原因：Dexie 5 的表参数重载最多 5 张表，第 6 张起需要数组形式。
- 修复：`db.transaction('rw', [db.items, db.images, db.outfits, db.outfitItems, db.wearLogs, db.settings], fn)`。

### 15.2 现存缺陷

| # | 问题 | 影响 | 建议修复 |
| --- | --- | --- | --- |
| 1 | 搜索匹配的是枚举 id（`commute`）而非中文（`通勤`） | 搜中文风格/季节无结果 | 在 haystack 中拼接 `STYLES`/`SEASONS` 的 label |
| 2 | 无重复检测 | 同一件衣服可能录两次 | 保存时比较名称 + 主色 + 分类，提示疑似重复 |
| 3 | 批量分类后不可批量改分类/删除 | 录入几十件后整理麻烦 | 衣柜加多选模式，复用连拍分类的 7 类按钮 |
| 4 | 删除不可撤销 | 误删无法恢复 | 软删除（`deletedAt`）或 7 天回收站 |
| 5 | 备份整包在内存中构建 | 数百件时可能占 100MB+ 内存 | 改用 fflate 流式 zip 或分卷 |
| 6 | 使用 `window.confirm` | 视觉与系统不一致 | 自定义底部确认弹层 |
| 7 | 全部单品常驻内存 | 数千件时列表卡顿 | 分页 + 虚拟滚动 |
| 8 | 图片详情每次从 Blob 解码 | 首次打开有轻微延迟 | 缓存解码后的 ImageBitmap |
| 9 | 天气位置只能更换，不能清除 | 想回到「未设置」状态只能改选别的城市 | 天气设置弹层加「清除位置」，同时清 `settings.weatherLocation` 与 `settings.weatherCache` |
| 10 | 页面跨过午夜后日期不自动翻页 | 应用长时间停留在今日页时，`TODAY` 仍是昨天，记录会写到旧日期 | 监听 `visibilitychange` 或定时器，日期变化后重算 `TODAY`、刷新今日记录与候选 |

### 15.3 平台风险

| 风险 | 说明 | 对策 |
| --- | --- | --- |
| iOS 存储被回收 | 长期不打开或空间紧张时 IndexedDB 可能被清理 | 引导添加到主屏 + `persist()` + 每周备份提醒 |
| 域名隔离 | 换域名 = 空库；预览域名与正式域名不同 | 固定正式域名；文档与 UI 明示 |
| 抠图模型 CDN 不稳 | 首次下载 88MB，实测出现多次连接重置后重试成功 | 已加 SW 缓存；如长期不稳，改为自托管（Pages 单文件 ≤25MB，需 R2 或换小模型） |
| 抠图首帧偏慢 | 无多线程 wasm 时单线程推理约 10s | 真机 WebGPU 优先；批量场景交给后台队列，不阻塞操作 |
| Safari 的 WebP 编码 | 旧版可能不支持 `toBlob('image/webp')` | 已实现 JPEG 降级 |
| 相机需要安全上下文 | HTTP 下 `<input capture>` 可用，但 `getUserMedia` 不可用 | 当前只用 file input，无影响 |
| 开发模式无 Service Worker | `vite dev` 下不可离线 | 用 `npm run build && npm run preview` 或部署后验证 |

---

## 16. 从零重建清单

按顺序执行，每步都有验收点。

### 步骤 1：脚手架

```bash
npm create vite@latest wardrobe -- --template vue-ts
cd wardrobe
npm install
npm i vue-router@4 pinia dexie fflate @imgly/background-removal onnxruntime-web@1.21.0
npm i -D vite-plugin-pwa vitest fake-indexeddb jsdom @vue/test-utils sharp
```

验收：`npm run dev` 能打开默认页面。

### 步骤 2：工程配置

1. `vite.config.ts`
   - `base: './'`
   - `resolve.alias['@'] = ./src`
   - `VitePWA({...})` 按 §9.1
   - `test` 按 §13.2
   - `defineConfig` 从 `vitest/config` 导入
2. `tsconfig.app.json`
   - `types: ["vite/client", "vitest/globals", "node"]`
   - `paths: { "@/*": ["./src/*"] }`（**不要用 baseUrl**，TS 6 已弃用）
   - `noUnusedLocals` / `noUnusedParameters` 保持开启
3. `index.html` 按 §9.2 写 meta
4. `package.json` scripts：`dev / build / typecheck / test / test:watch / icons / preview`

验收：`npm run typecheck` 通过。

### 步骤 3：设计系统

1. 把 `src/style.css` 写成 §10.1 的 token + §10.2 的通用类（`.topbar` `.card` `.btn` `.chip` `.input` `.section` `.thumbsize` `.empty`）。
2. 全局 `box-sizing: border-box`、`overscroll-behavior-y: none`、`-webkit-tap-highlight-color: transparent`。

验收：任意页面背景为 `#191b22`，文字为 `#f4f6fb`。

### 步骤 4：数据层

1. `db/types.ts` — 按 §5 定义全部接口。
2. `db/constants.ts` — 按 §17 写死全部枚举与色板。
3. `db/db.ts` — Dexie 类 + §5.7 的索引。
4. `db/repo.ts` — `newId / nowIso / imageKey / listItems / getItem / putItem / putImage / getImage / listImages / deleteItem / listOutfits / getOutfit / putOutfit / listOutfitItems / replaceOutfitItems / deleteOutfit / listWearLogs / recordOutfitWear / getSetting / setSetting / countItems`。
   - `newId` 必须有 `crypto.randomUUID` 不可用时的降级。
   - `deleteItem` 同事务清理 `images` 与 `outfitItems`。
   - `recordOutfitWear` 在单个事务内按 `date + outfitId` 去重，并更新套内单品的穿着次数与清洁状态。

验收：`repo.spec.ts` 的全部用例通过（含套装 CRUD 与级联）。

### 步骤 5：服务层

1. `services/image.ts` 按 §7 实现，导出 `processPhoto` 与 `nearestPaletteHex`。
2. `services/cutout.ts` 按 §7.6 实现，导出 `createCutout(source, onProgress?) → { cutout, thumb }`。
   - 动态 `import('@imgly/background-removal')`；先试 `device:'gpu'`，失败回退 `'cpu'`。
   - 裁透明边 + 补 4px；输出 WebP(alpha)，回退 PNG。
3. `services/storage.ts` 实现 `requestPersistentStorage / isStoragePersistent / storageEstimate / formatBytes`。
4. `services/backup.ts` 按 §8 实现，导出 `buildBackup / backupFileName / downloadBlob / importBackup`；包含 `outfits / outfitItems / covers / wearLogs`。
5. `services/collage.ts` 实现 `pieceLayout / renderOutfitCover / buildOutfitShareImage / shareOutfitImage`。
   - `pieceLayout` 同时供 Canvas 与 `OutfitPreview.vue` 使用，槽位布局不得散落两处。
   - 封面 1080×1440；分享图 1080×1620；优先 `navigator.share({files})`，不可用则下载。
6. `services/today.ts` 实现 `localDateKey / todayHeading / seasonForDate / seasonsForTemperature / warmthRange / effectiveSeasons / isOutfitEligible / rankOutfits`（纯函数，便于单测）。
7. `services/weather.ts` 实现 `describeWeather / fetchWeather / searchPlaces / currentPosition`；请求带 8s 超时，结果写 `settings.weatherCache`。

验收：`npm test` 全绿（含备份往返）；无头 Chromium 能对一张图跑通 `createCutout`。

### 步骤 6：状态层

1. `stores/wardrobe.ts`
   - state：`items / loaded / loading / search / category / clean`
   - getters：`total / filtered / countByCategory / categoryStats / totalValue / wearCountTotal`
   - actions：`load / saveItem / attachCutout / removeItem / markWorn / setCleanState`
   - `markWorn` 的日期用本地 `YYYY-MM-DD`（不能用 `toISOString()`，否则晚上会被算成第二天）
   - `saveItem` 接受 `{ item, original?, cutout?, cutoutThumb? }`；换新原图但无新抠图时必须删旧 `cutout` 并置 `hasCutout=false`
   - **`toPersistable` 必须存在**（§15.1）
2. `stores/cutout.ts` — 后台抠图队列：`enqueue(ids, resetWhenIdle?)`、`running/total/done/failed/percent`；串行执行，失败只计数不中断。
3. `stores/outfits.ts` — `outfits / pieces / loaded`；`byId / piecesFor / countFor / load / saveOutfit / setCover / setFavorite / removeOutfit`。
   - `layerFor(slot, index)`：主槽位 `(SLOTS.indexOf(slot)+1)*10`，配饰再加序号。
   - `saveOutfit` 必须在事务外先 `toPersistable`，再 `replaceOutfitItems`。
4. `composables/useObjectUrl.ts` — watch Blob，创建/回收 URL。
5. `composables/useToast.ts` — 模块级 `message` + `show`。

验收：手动调用 `saveItem / saveOutfit` 不报 DataCloneError。

### 步骤 7：组件

按 §10.3 实现组件。注意：

- `ChipGroup` 单选时点击已选项要能取消。
- `ColorPicker` 副色达到上限后点击无效果。
- `PhotoField` 必须有两个 file input（相机带 `capture="environment"`）。
- `Icon` 用 `currentColor`，不引入图标库。
- `BlobThumb` 负责 `Blob → ObjectURL`（连拍/分类缩略图），不要在循环里手动建 URL。
- `CutoutIndicator` 挂在 `App.vue`，监听 `running` 由真变假时 Toast 汇总结果。
- `OutfitPreview` 的布局必须调用 `services/collage.ts` 的 `pieceLayout`。
- `SlotPickerSheet` 用 `Teleport` 挂到 body，`z-index` 高于 Tab 栏与保存条。

验收：组件在暗色背景下无白边、无错位。

### 步骤 8：页面与路由

1. `router/index.ts` 按 §4.2，含 `scrollBehavior`。
2. `App.vue`：`router-view` + 条件 `AppTabBar`（`route.meta.tab`）+ `CutoutIndicator` + `ToastHost`。
3. 依次实现 `WardrobeView`、`ItemEditView`、`ItemDetailView`、`CaptureView`、`OutfitsView`、`OutfitEditView`、`OutfitDetailView`、`TodayView`、`SettingsView`，细节按 §10.4。
4. `ItemEditView`：选图后先出预览再后台抠图；保存前若抠图未完成要 `await`，失败则按「无抠图」保存。
5. `CaptureView`：`reactive` 创建队列项（否则直接改目标对象不触发渲染），保存后 `cutout.enqueue(ids, true)` 再 `router.replace('/')`。
6. `OutfitEditView`：保存后 `renderOutfitCover`，封面失败只 Toast 不阻断；`OutfitDetailView` 分享失败回退下载。
7. 搭配相关页面加载时必须强制刷新 wardrobe/outfits store，避免从单品页返回后引用被删除的单品。
8. `TodayView`：进入时读 `settings.weatherLocation / weatherCache`；设置天气后刷新；「穿这套」调用 `recordOutfitWear` 后刷新本地候选与历史；`markWorn` 用本地日期。

验收：走通 §12.1 的 22 条、§12.2 的 25 条。

### 步骤 9：PWA 资源

1. 写 `public/favicon.svg`（渐变圆角方块 + 衣架）。
2. 写 `scripts/gen-icons.mjs`（sharp，输出 192/512/180/maskable）。
3. `npm run icons`。

验收：`dist/manifest.webmanifest` 含 3 个图标，`npm run build` 生成 `sw.js`。

### 步骤 10：最终验证

```bash
npm run typecheck
npm test
npm run build
```

再用移动端视口（390×844）走一遍：

1. 空衣柜 → 添加第一件
2. 拍照 → 自动主色 → 选分类 → 保存
3. 详情 → 今天穿了 → 清洁状态变化
4. 返回衣柜 → 卡片出现 → 搜索/筛选
5. 设置 → 导出备份 → 文件下载成功
6. 清库 → 导入备份 → 数据恢复
7. 刷新页面 → 数据仍在
8. M2：相机 → 连续录入 → 连拍 3 件 → 批量分类 → 加入衣橱 → 后台抠图完成 → 卡片透明底 → 详情「原图/抠图」切换
9. M2：设置 → 重新抠图全部 → 进度跑完 → 计数更新

全部通过即为功能等价。

---

## 17. 附录：完整字典

### 17.1 分类与子类

| id | 中文 | emoji | 子类 |
| --- | --- | --- | --- |
| `outer` | 外套 | 🧥 | 大衣、风衣、夹克、羽绒服、棉服、西服、马甲、针织开衫、皮衣、冲锋衣 |
| `top` | 上装 | 👕 | T恤、衬衫、Polo衫、小衫、针织衫、毛衫、毛衣、卫衣、背心、吊带衫 |
| `inner` | 内搭 | 🎽 | 打底衫、吊带背心、秋衣、内衣、保暖内衣 |
| `bottom` | 下装 | 👖 | 牛仔裤、休闲裤、西裤、运动裤、短裤、长裤、半身裙、连衣裙 |
| `shoes` | 鞋 | 👟 | 运动鞋、板鞋、皮鞋、靴子、凉鞋、拖鞋、帆布鞋、乐福鞋、高跟鞋 |
| `bag` | 箱包 | 👜 | 双肩包、单肩包、斜挎包、手提包、托特包、钱包、行李箱 |
| `accessory` | 配饰 | 🧣 | 帽子、围巾、腰带、眼镜、手套、袜子、首饰、领带、丝巾 |

### 17.2 季节 / 风格 / 图案

| 枚举 | 值 |
| --- | --- |
| Season | `spring 春 🌱`、`summer 夏 ☀️`、`autumn 秋 🍂`、`winter 冬 ❄️` |
| Style | `commute 通勤`、`casual 休闲`、`sport 运动`、`formal 正式`、`date 约会`、`home 居家` |
| Pattern | `solid 纯色`、`stripe 条纹`、`check 格子`、`floral 碎花`、`dot 波点`、`print 图案`、`other 其他` |

### 17.3 清洁状态 / 在役状态

| 枚举 | 值 |
| --- | --- |
| CleanState | `clean 干净 ✅`、`worn 穿过 👕`、`to_wash 待洗 🧺`、`washing 洗涤中 💧` |
| ItemStatus | `active 在役`、`idle 闲置`、`pending 待处理` |

### 17.4 档位文案

| 档位 | 正式度 | 保暖度 |
| --- | --- | --- |
| 1 | 很休闲 | 很薄 |
| 2 | 休闲 | 薄 |
| 3 | 日常 | 适中 |
| 4 | 偏正式 | 偏厚 |
| 5 | 正式 | 很厚 |

### 17.5 色板（19 色，`neutral` 标记用于 §14.4 色彩评分）

| 名称 | Hex | 中性 |
| --- | --- | --- |
| 黑 | `#1c1c1e` | 是 |
| 白 | `#f7f7f5` | 是 |
| 灰 | `#9a9a9d` | 是 |
| 米白 | `#e8e0d0` | 是 |
| 卡其 | `#c3a878` | 是 |
| 棕 | `#7a5236` | 否 |
| 深蓝 | `#22304f` | 是 |
| 牛仔蓝 | `#4a6b96` | 是 |
| 浅蓝 | `#a9c6e2` | 否 |
| 天蓝 | `#5aa9e6` | 否 |
| 藏青 | `#1b2138` | 是 |
| 红 | `#c0392b` | 否 |
| 酒红 | `#7b2d3b` | 否 |
| 粉 | `#e8a0b4` | 否 |
| 橙 | `#e07b39` | 否 |
| 黄 | `#e8c547` | 否 |
| 绿 | `#3f7d52` | 否 |
| 墨绿 | `#24443a` | 否 |
| 紫 | `#6b4a8f` | 否 |

### 17.6 术语

| 术语 | 含义 |
| --- | --- |
| 单品 | 一件衣服/鞋/包/配饰，`Item` |
| 套装 | 多件单品的组合，`Outfit` |
| 槽位 | 套装中的位置（外套/上装/…），决定叠穿层级 |
| 清洁状态 | 单品当前是否可穿 |
| 主色 | 单品的代表色，用于筛选与搭配评分 |
| 抠图 | 去除照片背景，生成透明底图 |
| 备份包 | `.wardrobe` 文件，zip 格式 |

---

## 附：本文档对应的关键文件

| 关注点 | 文件 |
| --- | --- |
| 类型定义 | `src/db/types.ts` |
| 枚举与色板 | `src/db/constants.ts` |
| 表结构与索引 | `src/db/db.ts` |
| 读写 API | `src/db/repo.ts` |
| 图片处理 | `src/services/image.ts` |
| 备份 | `src/services/backup.ts` |
| 存储与配额 | `src/services/storage.ts` |
| 业务状态与筛选 | `src/stores/wardrobe.ts` |
| 路由 | `src/router/index.ts` |
| 设计 token | `src/style.css` |
| PWA 配置 | `vite.config.ts` |
| 图标生成 | `scripts/gen-icons.mjs` |

---

## 18. 复刻保真度声明

按本文档（含附录 A–E）重建后，各维度预期一致度：

| 维度 | 一致度 | 保障来源 |
| --- | --- | --- |
| 功能与页面流程 | 100% | §4 路由表、§12 验收标准（38 条） |
| 数据模型与备份互通 | 100% | §5 字段表 + 不变量、§8 zip 结构 |
| 业务规则与算法 | 100% | §6 规则、§7 参数与伪代码 |
| 文案 | 100% | 附录 A |
| 图标 | 100% | 附录 B |
| 依赖行为 | 100% | 附录 C 精确版本 |
| 视觉 | ~95% | §10 token + 附录 E 截图与关键 CSS；剩余细节需并排比对 |

**结论**：功能、数据、交互、文案可完全一致；视觉以附录 E 截图为准做并排比对，通常 1–2 轮即可收敛到像素级。

---

## 附录 A：完整文案表

> 未特殊说明均为简体中文。`{}` 为插值。Toast 默认 2200ms 后消失。

### A1 底部 Tab（`AppTabBar`）

| 顺序 | 文案 | 图标 | 路由 |
| --- | --- | --- | --- |
| 1 | 衣柜 | `grid` | `/` |
| 2 | 搭配 | `shirt` | `/outfits` |
| 3 | 今天 | `sun` | `/today` |
| 4 | 设置 | `gear` | `/settings` |

### A2 衣柜页（`WardrobeView`）

| 位置 | 文案 |
| --- | --- |
| 标题 | 我的衣橱 |
| 副标题 | 共 {total} 件 · 显示 {filtered} 件 |
| 搜索占位 | 搜索名称、品牌、标签… |
| 右上按钮 aria | 添加单品 |
| 空库标题 | 衣橱还是空的 |
| 空库说明 | 拍下第一件衣服，开始建立你的衣橱 |
| 空库按钮 | 添加第一件 |
| 筛选无结果 | 没有符合条件的单品 |
| FAB aria | 添加单品 |
| 分类 chips | 全部、外套、上装、内搭、下装、鞋、箱包、配饰 |
| 清洁 chips | 状态不限、干净、穿过、待洗、洗涤中 |

### A3 添加/编辑单品（`ItemEditView`）

| 位置 | 文案 |
| --- | --- |
| 标题（新增） | 添加单品 |
| 标题（编辑） | 编辑单品 |
| 顶部按钮 | 保存 / 保存中 |
| 区块 1 | 分类 |
| 字段 | 名称（可选） |
| 占位 | 例如：白色亚麻衬衫 |
| 字段 | 子类 |
| 字段 | 适合季节 |
| 字段 | 风格 |
| 折叠摘要 | 更多信息（可选） |
| 字段 | 图案 |
| 字段 | 颜色 → 主色 / 副色（副色右侧提示：最多 2 个，可留空） |
| 字段 | 正式度 / 保暖度（未设置时副文案：未设置） |
| 字段 | 材质（占位：棉 / 羊毛 / 聚酯纤维…） |
| 字段 | 品牌 / 尺码（占位：M / 40） |
| 字段 | 价格（占位：0）/ 购入日期 |
| 字段 | 存放位置（占位：主卧衣柜 2 层 / 收纳箱 3） |
| 字段 | 在役状态 / 清洁状态 |
| 字段 | 标签（占位：用空格或顿号分隔） |
| 字段 | 备注 |
| 底部按钮 | 加入衣橱 / 保存修改 |
| Toast | 请先拍照或选择一张照片 |
| Toast | 照片处理失败，请重试 |
| Toast | 已保存 / 已加入衣橱 |
| Toast | 保存失败，请重试 |
| Toast | 单品不存在 |

### A4 照片组件（`PhotoField`）

| 位置 | 文案 |
| --- | --- |
| 空态提示 | 拍一张单品照片，其余信息可后补 |
| 按钮 | 拍照 / 相册 |
| 已存图提示 | 已有一张照片，重新拍摄将替换它 |
| 处理遮罩 | 处理中… |
| 预览操作 | 重拍 / 移除 |
| 图片 alt | 单品照片 |

### A5 单品详情（`ItemDetailView`）

| 位置 | 文案 |
| --- | --- |
| 操作 1 | 今天穿了 |
| 操作 2 | 编辑 |
| 区块 | 清洁状态 / 详细信息 / 备注 |
| 删除按钮 | 删除这件单品 |
| 详情行标签 | 分类、图案、材质、品牌、尺码、价格、购入日期、存放位置、正式度、保暖度、在役状态、穿着次数、最后穿着 |
| 空值 | — |
| 价格格式 | ¥{price} |
| 次数格式 | {wearCount} 次 |
| Toast | 已记录今天穿了这件 |
| Toast | 单品不存在 / 已删除 |
| 确认框 | 删除「{名称}」？此操作不可撤销。 |
| aria | 返回 / 编辑 / 关闭 |

### A6 搭配（M3）

`OutfitsView`：

| 位置 | 文案 |
| --- | --- |
| 标题/副标题 | 搭配 / 共 {n} 套 · 用槽位把单品拼成套装 |
| 右上/FAB aria | 新建搭配 |
| 空库标题 | 还没有搭配 |
| 空库说明 | 把不同单品组合成一套，保存后随时复用 |
| 空库按钮 | 新建第一套 |
| 卡片兜底名 | 未命名搭配 |
| 卡片副文案 | {n} 件 · {场合1 · 场合2} |

`OutfitEditView`：

| 位置 | 文案 |
| --- | --- |
| 标题 | 新建搭配 / 编辑搭配 |
| 名称占位 | 例如：通勤周一 |
| 预览空态 | 选择单品后自动叠穿预览 |
| 字段 | 搭配名称（可选）/ 适合季节 / 场合 / 备注 |
| 槽位提示 | 选择 / 更换 / 点击选择{槽位} / 再添加一件 |
| 按钮 | 创建搭配 / 保存修改 / 保存 / 保存中 |
| Toast | 先至少选择一件单品 / 已创建搭配 / 已保存 / 保存失败，请重试 / 搭配不存在 |

`OutfitDetailView`：

| 位置 | 文案 |
| --- | --- |
| 兜底标题 | 未命名搭配 |
| 按钮 | 分享长图 / 生成中 / 编辑 / 删除这套搭配 |
| 收藏 aria | 收藏 / 取消收藏 |
| Toast | 已收藏 / 已取消收藏 / 这套搭配还没有单品 / 已分享 / 已生成分享图 / 已取消分享 / 生成分享图失败，请重试 |
| 确认框 | 删除「{名称}」？此操作不可撤销。 |
| 空引用 | 单品已删除 |

`SlotPickerSheet`：

| 位置 | 文案 |
| --- | --- |
| 标题 | 选择{槽位} |
| 筛选 | 干净 · 在役 · 当季 / 显示全部 |
| 空态（默认） | 没有符合「干净 · 在役 · 当季」的单品 |
| 空态（全部） | 衣橱里还没有这一类的单品 |

### A7 设置（`SettingsView`）

| 位置 | 文案 |
| --- | --- |
| 标题 | 设置 |
| 区块 | 衣橱概览 / 备份与迁移 / 本地存储 / 安装到手机主屏幕 |
| 统计卡 | 件单品 / 累计穿着次数 / 衣橱总价值 |
| 备份提示（无） | 还没有备份过，建议先导出一次 |
| 备份提示（今天） | 今天已备份 |
| 备份提示（<7 天） | {n} 天前备份 |
| 备份提示（≥7 天） | 已 {n} 天没有备份，建议尽快导出 |
| 备份说明 | 数据只存在这台设备。换手机、双机共用或防止误删，都靠这个备份文件。 |
| 按钮 | 导出备份 / 选择备份文件导入 |
| 字段 | 导入方式 → 合并（保留现有）/ 覆盖（清空后导入） |
| 确认框 | 将「{文件名}」导入（{覆盖现有数据 \| 与现有数据合并}），继续？ |
| Toast | 已导出 {size} / 导出失败，请重试 |
| Toast | 导入完成：{n} 件单品，{m} 套搭配，{k} 条穿着记录（为 0 的段省略）/ 导入失败 |
| 存储 | 已用 {size} / 可用配额 {size} |
| 持久化 | 已开启持久化存储 / 未开启持久化，系统可能清理数据 |
| 按钮 | 申请持久化存储 |
| Toast | 已开启持久化存储 / 浏览器未授予，建议定期导出备份 |
| 安装说明 | iPhone：Safari → 分享 → 添加到主屏幕。<br>Android：Chrome → 菜单 → 安装应用。<br>从主屏图标打开可获得独立窗口和更稳定的本地存储。 |

### A8 今日（`TodayView`）

| 位置 | 文案 |
| --- | --- |
| 标题 | 今天 |
| 天气卡（无位置） | 按天气挑今天穿什么 / 设置城市后可按温度和季节筛选干净、在役的搭配。 / 设置城市 |
| 天气卡（有位置） | {天气文案} / {温度}° / {城市} {时间} 更新 / 建议保暖 {min}–{max} 级 · {保暖建议} |
| 天气卡（离线） | 天气为上次数据，联网后自动更新 |
| Toast | 天气更新失败，显示上次数据 / 天气获取失败，请稍后重试 |
| 区块 | 今日记录 / 今天什么场合 / 今天穿什么 / 最近穿过 |
| 场合 | 不限 / 通勤 / 休闲 / 正式 / 运动 / 约会（右上「清除」） |
| 候选提示 | {n} 套可选 |
| 空态（无搭配） | 还没有搭配 / 先把常穿的单品拼成套装，今天页就能直接挑。 / 新建搭配 |
| 空态（无候选） | 没有符合条件的套装 / 当前按「{季节}{ · 场合}」筛选，需要套装内单品都干净、在役，季节也要匹配。 / 看看其他场合 / 去整理搭配 |
| 操作 | 随便穿一套 / 穿这套 |
| Toast | 试试「{名称}」/ 这套搭配还没有单品 / 已记录今天穿了「{名称}」/ 今天已经记录过这套 / 记录失败，请重试 |
| 历史行 | {日期} · {件数} 件{ · 场合}{ · 天气} / 查看 |
| 历史兜底 | 已删除搭配 / {n} 件单品 |
| 展开 | 查看全部 / 收起 |
| 天气设置弹层标题 | 设置天气位置 |
| 天气设置说明 | 位置只保存在本机，用于按当地天气筛选套装。天气数据来自 Open-Meteo，无需注册。 |
| 天气设置字段 | 搜索城市（占位：搜索城市，如 杭州）/ 搜索 / 搜索中 / 使用当前位置 / 定位中 / 手动输入经纬度 / 位置名称（可选）/ 纬度 / 经度 / 使用这组坐标 |
| 天气设置错误 | 没有找到这个城市，试试更完整的名称 / 搜索失败，请检查网络 / 请输入有效的纬度（-90~90）和经度（-180~180）/ 定位失败，请手动选择城市 |

### A9 备份模块错误文案

| 场景 | 文案 |
| --- | --- |
| zip 解析失败 | 无法解压，文件可能已损坏 |
| format 不匹配 | 不是有效的衣橱备份文件 |
| version 过高 | 备份来自更新的版本，请先升级应用 |
| 缺少文件 | 备份缺少 {文件名} |

### A10 备份内置说明文件（`README.txt`）

```
这是「衣橱」的备份文件。请勿解压修改。在新设备上用「导入备份」即可恢复。
```

---

## 附录 B：图标 SVG 数据

`src/components/Icon.vue` 内联实现。容器：`viewBox="0 0 24 24"`、`fill="none"`、`stroke="currentColor"`、`stroke-linecap="round"`、`stroke-linejoin="round"`、默认 `stroke-width="1.7"`、默认 `size=22`。

| name | paths（按顺序） |
| --- | --- |
| `grid` | `M4 4h6v6H4z`、`M14 4h6v6h-6z`、`M4 14h6v6H4z`、`M14 14h6v6h-6z` |
| `shirt` | `M9 3l3 1.8L15 3l4.5 2.6-1.8 3.2-2.2-1.1V21H8.5V7.7L6.3 8.8 4.5 5.6z` |
| `sun` | `M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z`、`M12 2v2.2`、`M12 19.8V22`、`M3.6 3.6l1.6 1.6`、`M18.8 18.8l1.6 1.6`、`M2 12h2.2`、`M19.8 12H22`、`M3.6 20.4l1.6-1.6`、`M18.8 5.2l1.6-1.6` |
| `gear` | `M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z`、`M12 2.5v2.6`、`M12 18.9v2.6`、`M4.3 4.3l1.9 1.9`、`M17.8 17.8l1.9 1.9`、`M2.5 12h2.6`、`M18.9 12h2.6`、`M4.3 19.7l1.9-1.9`、`M17.8 6.2l1.9-1.9` |
| `plus` | `M12 5.5v13`、`M5.5 12h13` |
| `camera` | `M4 8.5h3.2L8.6 6h6.8l1.4 2.5H20V19H4z`、`M12 16.2a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z` |
| `photo` | `M4 5.5h16v13H4z`、`M8 12.5l2.8 3 2.2-2.4L17 17`、`M9 9.8a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z` |
| `back` | `M15 5l-7 7 7 7` |
| `trash` | `M4.5 7h15`、`M9.5 7V4.5h5V7`、`M6.5 7l1 13h9l1-13`、`M10.5 11v5.5`、`M13.5 11v5.5` |
| `pencil` | `M4 20h4.2L20 8.2 15.8 4 4 15.8z`、`M14.2 5.6l4.2 4.2` |
| `search` | `M11 17a6 6 0 100-12 6 6 0 000 12z`、`M20 20l-4.7-4.7` |
| `download` | `M12 4v10.5`、`M7.5 10.5L12 15l4.5-4.5`、`M4.5 19.5h15` |
| `upload` | `M12 19.5V9`、`M7.5 13.5L12 9l4.5 4.5`、`M4.5 4.5h15` |
| `close` | `M6 6l12 12`、`M18 6L6 18` |
| `check` | `M5 12.5l4.5 4.5L19 7` |
| `alert` | `M12 8.5v5`、`M12 16.8h.01`、`M12 3.5l9 16H3z` |
| `sparkle` | `M12 3.5l1.7 5L19 10l-5.3 1.5L12 16.5l-1.7-5L5 10l5.3-1.5z` |
| `hanger` | `M12 6.5a2 2 0 100-4 2 2 0 000 4z`、`M12 6.5v3l8 5.5H4z` |
| `pin` | `M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11z`、`M12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z` |
| `refresh` | `M4.5 12a7.5 7.5 0 0112.6-5.5`、`M20 4.5v6h-6`、`M19.5 12a7.5 7.5 0 01-12.6 5.5`、`M4 19.5v-6h6` |

旋转类：`.spin { animation: spin .9s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`。

---

## 附录 C：精确依赖版本

重建时建议**锁定到以下版本**（`npm i pkg@version`），否则次版本差异可能影响行为（Vite 8 / TS 6 生态变化较快）。

### 运行时依赖

| 包 | 版本 | 用途 |
| --- | --- | --- |
| `vue` | 3.5.44 | 框架 |
| `vue-router` | 4.6.4 | 路由（hash 模式） |
| `pinia` | 4.1.0 | 状态管理 |
| `dexie` | 4.4.6 | IndexedDB 封装 |
| `fflate` | 0.8.3 | zip 导出/导入 |
| `@imgly/background-removal` | 1.7.0 | M2 端上抠图（ONNX） |
| `onnxruntime-web` | 1.21.0 | 抠图推理运行时（peer 依赖，勿随意升级） |

### 开发依赖

| 包 | 版本 | 用途 |
| --- | --- | --- |
| `vite` | 8.3.4 | 构建 |
| `@vitejs/plugin-vue` | 6.0.10 | SFC 编译 |
| `typescript` | 6.0.3 | 类型系统（注意 TS 6 弃用 `baseUrl`） |
| `vue-tsc` | 3.3.13 | 模板类型检查 |
| `vite-plugin-pwa` | 2.0.0 | manifest + Workbox |
| `vitest` | 5.0.5 | 测试 |
| `jsdom` | 30.1.3 | 测试环境 |
| `fake-indexeddb` | 6.2.6 | IndexedDB 测试替身 |
| `@vue/test-utils` | 2.5.1 | 组件测试（当前未使用，保留） |
| `@vue/tsconfig` | 0.9.1 | tsconfig 基座 |
| `@types/node` | 24.19.2 | Node 类型（测试里用 `node:buffer`） |
| `sharp` | 0.35.5 | 生成 PWA 图标 |

### 版本敏感点

- `vite.config.ts` 的 `defineConfig` **必须**从 `vitest/config` 导入，否则 `test` 字段类型报错。
- `tsconfig.app.json` 的 `types` 需包含 `node`，因为 `src/test/setup.ts` 引用 `node:buffer`。
- TS 6 下 `baseUrl` 已弃用，`paths` 直接相对 tsconfig 解析。
- `@imgly/background-removal@1.7.0` 的 peer 依赖是 `onnxruntime-web@1.21.0`（非 dev 版本号），换版本可能导致 wasm 加载失败。
- onnxruntime 的 wasm 会被 Vite 打进 `dist/assets`（约 24MB），Cloudflare Pages 单文件上限 25MB，不要升级到更大的 wasm 变体。
- 无 COOP/COEP 时 ORT 会自动从多线程回退单线程（有控制台 warning，属正常）。

---

## 附录 D：隐式实现约定

以下细节文档正文未展开，但影响行为一致性，必须实现。

| # | 约定 | 说明 |
| --- | --- | --- |
| 1 | `useObjectUrl` 生命周期 | `watch(source, ..., { immediate: true })`；每次变更先 `revokeObjectURL` 旧的再创建新的；`onScopeDispose` 时回收 |
| 2 | Toast 单例 | 模块级 `ref` + 单个 `setTimeout` 句柄；新 Toast 覆盖旧的并重置计时 |
| 3 | `toPersistable` | `toRaw` 顶层 + 显式展开 `seasons/styles/tags/colorSecondary/attrs`；**所有** `putItem` 路径都要经过它 |
| 4 | `PhotoField` 两个 input | 相机 input 带 `capture="environment"`，相册 input 不带；`onFile` 后必须 `input.value = ''` 以允许重复选同一文件 |
| 5 | `ChipGroup` 单选 | `multiple=false` 时点击已选项 → 发出 `[]`（可取消选择） |
| 6 | `ColorPicker` 上限 | 副色达到 `maxSecondary` 后点击其他色不产生任何变化（不替换、不报错） |
| 7 | `LevelPicker` 柱高 | `height = 5 + level * 3` px，即 8/11/14/17/20 |
| 8 | 主色背景判定 | 与四角颜色三通道差值**全部 < 42** 视为背景；`alpha < 200` 跳过 |
| 9 | 主色量化 | `key = (r>>4)<<8 | (g>>4)<<4 | (b>>4)`，取像素数最多的桶求平均 |
| 10 | 色板吸附 | RGB 欧氏距离平方最小者；平手时取 `PALETTE` 中靠前者 |
| 11 | ImageBitmap 释放 | `processPhoto` 在 `finally` 中 `src.close()`（仅当为 `ImageBitmap`） |
| 12 | 备份下载回收 | `downloadBlob` 在 10 秒后 `revokeObjectURL` |
| 13 | 导入不清 settings | `replace` 模式只 `clear` items 与 images，保留 settings |
| 14 | 排序 | 列表一律 `createdAt` 倒序（字符串比较，ISO 可直接比） |
| 15 | 时间格式 | `createdAt/updatedAt` = ISO；`lastWornAt/purchaseDate` = `YYYY-MM-DD` |
| 16 | ID 生成 | `crypto.randomUUID()`，不可用时降级 `id-{时间36}-{随机}` |
| 17 | 名称回退 | `name → subcategory → 分类中文名`，空字符串视为缺失 |
| 18 | 编辑器校验顺序 | 先校验照片，再进入保存；`saving` 期间禁用两个保存按钮 |
| 19 | 抠图缩略图覆盖 | 抠图成功后 `item.thumb` 改成透明底缩略图；`images` 表保留 `original` 与 `cutout` 两份 |
| 20 | 换图清旧抠图 | `saveItem` 传了新 `original` 但 `cutout` 为空 → 删除 `images(id:cutout)` 且 `hasCutout=false`，避免旧抠图串味 |
| 21 | 抠图输出格式 | 透明图只能 WebP/PNG；`canvas.toBlob` 返回类型不是 `image/webp` 时必须回退 PNG |
| 22 | 抠图裁边 | alpha < 12 视为透明；裁到非透明包围盒后四周补 4px，再缩放到最长边 ≤1024 |
| 23 | 连拍队列响应式 | 队列项必须用 `reactive()` 包装后再 push，否则 `entry.status` 变更不触发视图更新 |
| 24 | 保存后离页 | 连拍保存成功后置 `saved=true` 再 `replace('/')`，否则会被离开确认拦截 |
| 25 | 后台队列去重 | `enqueue` 对「正在处理 + 排队中」的 id 去重；空闲时开启新批次要重置计数 |

---

## 附录 E：视觉基准

### E1 截图基准（`docs/screenshots/`）

所有截图来自 Chromium，视口 **390×844**，`deviceScaleFactor: 2`，`isMobile: true`，暗色主题。

| 文件 | 对应界面 | 观察重点 |
| --- | --- | --- |
| `01-wardrobe-empty.png` | 空衣柜 | 空态文案与按钮层级 |
| `02-add-item.png` | 添加单品（无照片） | 虚线拍照框、分类 4 列网格 |
| `03-photo-processed.png` | 拍照后 | 棋盘格底、图片 contain、重拍/移除按钮位置 |
| `04-item-detail.png` | 单品详情 | 1:1 大图、操作行、清洁 chips、信息表 |
| `05-wardrobe-grid.png` | 衣柜有数据 | 2 列网格、清洁角标、主色点、FAB 与 Tab 栏间距 |
| `06-settings.png` | 设置页 | 统计卡三列、分布列表、备份卡片 |
| `07-more-info.png` | 更多信息展开 | 色板 8 列、档位柱状、双列字段 |

还原流程：**先套 §10.1 token → 再按 §10.2 布局 → 再逐页与截图并排比对 → 修正间距与字号**。

### E2 关键 CSS（非显而易见，需照抄）

**棋盘格底**

- 全局 `.thumbsize` 仍是 M1 的浅色棋盘格（见下），用于照片尚未加载时的占位。
- M2 下透明抠图需要深色棋盘格，`ItemCard` 与 `ItemDetailView` 用类名覆盖：

```css
background:
  repeating-conic-gradient(
    color-mix(in srgb, var(--text) 6%, transparent) 0% 25%,
    transparent 0% 50%
  ) 0 0 / 22px 22px; /* 卡片用 18px */
```

**浅色棋盘格（`.thumbsize`）**

```css
background-color: #e9eaee;
background-image:
  linear-gradient(45deg, #d6d8de 25%, transparent 25%),
  linear-gradient(-45deg, #d6d8de 25%, transparent 25%),
  linear-gradient(45deg, transparent 75%, #d6d8de 75%),
  linear-gradient(-45deg, transparent 75%, #d6d8de 75%);
background-size: 16px 16px;
background-position: 0 0, 0 8px, 8px -8px, -8px 0;
```

**顶部栏（`topbar`）**

```css
padding: calc(var(--safe-top) + 14px) 16px 12px;
background: color-mix(in srgb, var(--bg) 88%, transparent);
backdrop-filter: blur(14px);
border-bottom: 1px solid var(--border);
```

**底部 Tab**

```css
height: calc(var(--tabbar-h) + var(--safe-bottom));
padding-bottom: var(--safe-bottom);
background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
backdrop-filter: blur(18px);
border-top: 1px solid var(--border);
/* item: flex:1; column; gap:3px; font-size:11px; 未选中 --text-faint，选中 --accent */
```

**FAB**

```css
right: 18px;
bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 18px);
width: 54px; height: 54px; border-radius: 18px;
background: var(--accent-strong); color: #10121a;
box-shadow: 0 10px 24px rgba(111, 131, 255, 0.38);
```

**编辑页底部操作条**

```css
padding: 12px 16px calc(12px + var(--safe-bottom));
background: color-mix(in srgb, var(--bg) 92%, transparent);
backdrop-filter: blur(14px);
border-top: 1px solid var(--border);
/* 页面需预留 padding-bottom: 96px */
```

**衣柜网格**

```css
grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
gap: 14px 12px;
padding: 4px 16px 40px;
```

**搜索框**

```css
/* 容器 margin: 12px 16px 0 */
input { height: 42px; border-radius: 12px; padding: 0 38px; }
/* 图标绝对定位 left:12px；清除按钮 right:10px */
```

**色板**

```css
grid-template-columns: repeat(8, 1fr); gap: 8px;
.swatch { aspect-ratio: 1; border-radius: 50%; border: 2px solid transparent;
          outline: 1px solid var(--border-strong); outline-offset: -1px; }
.swatch--on { border-color: var(--accent); outline-color: var(--accent); }
/* 副色 .swatch--sm { transform: scale(0.82) } */
```

**档位选择器**

```css
.level__btn { height: 46px; border-radius: var(--radius-sm); background: var(--bg-input); }
.level__bar { width: 70%; max-width: 22px; border-radius: 3px; background: currentColor; opacity: .55; }
/* 选中态：背景 --accent-soft，边框 --accent-strong，文字 --accent，bar opacity 1 */
```

**折叠区箭头**

```css
.more__chevron { transform: rotate(-90deg); transition: transform .2s ease; }
.more[open] .more__chevron { transform: rotate(-270deg); }
```

**照片处理遮罩**

```css
background: rgba(10, 11, 16, 0.6);
backdrop-filter: blur(3px);
/* 预览操作按钮：rgba(12,13,18,.72) + blur(6px)，白字，圆角 999px */
```

**Toast**

```css
bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 24px);
max-width: calc(100vw - 48px);
padding: 10px 16px; border-radius: 999px;
background: rgba(30, 33, 43, 0.96); border: 1px solid var(--border-strong);
font-size: 13px; box-shadow: var(--shadow);
```

**页面切换过渡**

```css
.fade-enter-active, .fade-leave-active { transition: opacity .14s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
```

### E3 视觉检查清单

- [ ] 所有卡片圆角 14px，大图圆角 20px，输入框圆角 10px
- [ ] 主按钮底色 `#7c8fff`，文字近黑 `#10121a`
- [ ] 选中 chips：文字 `--accent`、底色 `--accent-soft`、边框 `--accent-strong`
- [ ] 单品图一律 `object-fit: contain` + 棋盘格底，无拉伸
- [ ] 底部固定元素均叠加 `safe-bottom`
- [ ] 无横向滚动条
- [ ] 暗色下无纯白底块，卡片比页面底色高一档

