# 衣橱 · Wardrobe

手机优先的私人衣橱与穿搭管理 PWA。**没有后端、没有账号、没有云同步**，所有单品数据和照片都保存在浏览器的 IndexedDB 里。

> 完整的设计规格、数据模型、交互细节、待开发功能设计与从零重建步骤见 [docs/DESIGN.md](docs/DESIGN.md)。

## 已实现（M1 + M2 + M3）

- 手机拍照 / 相册导入，自动压缩（1600px）并生成缩略图
- 从照片自动识别主色并预填到调色板
- 单品录入：分类、子类、季节、风格，以及可折叠的颜色/图案/材质/正式度/保暖度/品牌/价格/存放位置/清洁状态等
- 衣柜网格：按分类和清洁状态筛选、关键词搜索
- 单品详情：查看大图、标记「今天穿了」、切换清洁状态、编辑、删除
- 设置页：衣橱统计、存储用量、持久化存储申请
- 备份：导出 `.wardrobe`（zip：JSON + 图片），支持合并导入 / 覆盖导入
- 端上抠图：WebGPU 优先、失败回退 CPU，自动裁边补边并生成透明底缩略图；失败不阻断保存，可重试
- 连续拍摄队列 `/capture`：连拍多件、批量分类入库，保存后加入后台抠图队列
- 后台抠图队列：串行执行、任意页面显示进度；设置页可「重新抠图全部」
- 搭配：7 个槽位（外套/上装/内搭/下装/鞋/箱包/配饰）自由选衣组合，配饰可多件，保存后可复用
- 叠穿预览：按槽位自动缩放叠放，保存时用 Canvas 生成封面
- 分享长图：预览 + 名称 + 单品清单 + 日期，优先调用系统分享，降级为下载
- 备份包含搭配、套内单品与封面，换机后可完整恢复

今天（M4）目前是占位页，规则推荐计划在 M5 实现。

## 技术栈

Vue 3 + TypeScript + Vite，Pinia、Vue Router、Dexie（IndexedDB）、fflate（备份打包）、`@imgly/background-removal`（端上抠图）、vite-plugin-pwa。

## 开发

```bash
npm install
npm run dev        # 本地开发
npm run typecheck  # 类型检查
npm test           # 单元测试（vitest + fake-indexeddb）
npm run build      # 生产构建，产物在 dist/
npm run icons      # 由 public/favicon.svg 重新生成 PWA 图标
```

## 部署与安装

`dist/` 是纯静态文件，无服务端逻辑。部署到任意静态托管（Cloudflare Pages / Vercel / Netlify）即可，数据不会上传。

- iPhone：Safari 打开后「分享 → 添加到主屏幕」
- Android：Chrome 菜单「安装应用」
- 从主屏图标启动可获得独立窗口，本地存储也更稳定

## 数据与备份

- 只存在当前设备，换机或双机共用请用「导出备份 / 导入备份」
- 首次使用建议在设置页申请持久化存储，并定期导出
- 备份文件 `.wardrobe` 内含 `manifest.json`、`items.json`、`outfits.json`、`outfitItems.json`、`settings.json`、`thumbs/`、`images/`、`covers/`

## 路线图

| 里程碑 | 内容 |
| --- | --- |
| M1 ✅ | 衣柜、拍照录入、本地存储、备份 |
| M2 ✅ | 端上抠图（@imgly/background-removal）、连续拍摄队列 |
| M3 ✅ | 槽位搭配、叠穿预览、分享长图 |
| M4 | 今日穿搭、穿着记录 |
| M5 | 规则筛选推荐、成本穿着比、久未穿统计 |
