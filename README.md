# 迹向

迹向是一款把学习投入、日记和回顾串成一条流程的本地优先原型。

## 当前体验

- 今日路线：任务排序、专注投入、成果记录和同源进度。
- 每日回声：写日记、生成回声草稿、确认闪耀瞬间和明日小实验。
- 我的印迹册：按月份浏览日期纸卡，进入日期查看有来源的时间印章、成果和便签。
- 个性化设置：专注方式、提醒、日记分析、知乎匹配、动效和本机数据管理。
- 迹向入口：点击左上角品牌标识，在四个主要入口之间切换。

当前版本只保存本机数据。大模型和知乎连接保留接口与空状态，页面不会用写死的内容冒充真实分析结果。

## 本地运行

```bash
npm install
npm run dev
```

构建与验证：

```bash
npm run check:runtime
npm run build
npm run test:sites
npm run test:runtime
```

## 目录

- `src/Prototype.tsx`：产品页面和交互状态。
- `src/prototype.css`：产品视觉样式。
- `src/stampBook.ts`：印迹册数据聚合和版本迁移。
- `src/echoAgent.ts`：每日回声与每周回声的 Agent 接口边界。
- `public/assets/`：设备运行时素材和迹向插图。
- `docs/`：Agent 调用方案、流程图、产品计划书和海报源文件。
