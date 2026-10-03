# 知途

知途是一款把学习投入、日记和回顾串成一条流程的本地优先原型。这次在原项目基础上整理 UI，保留 v5 本机数据、旧版迁移、计时和设备预览运行时。

## 当前体验

- 今日路线：先安排，再进入单独的专注阶段。任务排序、成果和继续点沿用原数据。
- 每日回声：先写日记，再回看事实、回声和更长周期的观察。次要内容收在「更多回顾」。
- 我的印迹册：日历、周回顾、月度、我的印章册各自独立。日期卡只展示图片；鼠标悬停解释、点击打开说明。
- 我的印章册：时间印迹、坚持章、探索章、突破章、成长章；展示含义、出现方式、获得状态、首次日期和可展开的原始证据。
- 印章插画：17 款分别生成的彩色手绘图样，未获得保留柔和色彩。网页使用无损 WebP，原始 PNG 与完整提示词一并保留，见 [素材记录](docs/stamp-artwork.md)。
- 个性化设置：专注方式、提醒、模型配置、收藏导入与授权、动效和本机数据管理。
- 固定导航：今日、足迹、回响、我的。品牌入口仍保留，今天的流程条可切换安排、投入、回声和印迹。

现已接入可配置的国内文本/绘图模型服务，以及知乎、小红书收藏导入。真实 API Key 尚未填写，模型流程已通过模拟接口验证。账号收藏自动同步与联网搜索尚未启用。详见 [模型与收藏接入说明](docs/ai-integration.md)。

## 本地运行

```bash
npm install
npm run dev
```

构建与验证：

```bash
npm run check:runtime
npx tsc --noEmit
npm run build
npm run test:sites
npm run test:runtime
```

本机没有 Playwright 自带的 Chromium 时，可以使用已安装的 Edge。PowerShell：

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:runtime
```

若已在 4173 运行预览，可复用该服务运行测试，避免 Windows npm 子进程退出等待：

```powershell
$env:MOBILE_RUNTIME_TEST_PORT='4173'
$env:MOBILE_RUNTIME_REUSE_SERVER='1'
npm run test:runtime
```

## 目录

- `src/Prototype.tsx`：产品页面和交互状态。
- `src/prototype.css`：产品视觉样式。
- `src/stampBook.ts`：印迹册数据聚合和版本迁移。
- `src/stampDefinitions.ts`：统一印章定义、获得条件与真实证据派生。
- `src/CalendarStamp.tsx`：日历印章交互，鼠标悬停和点击共用元数据。
- `src/StampCollection.tsx`：独立分类图鉴与详情。
- `src/ReferenceArt.tsx`：按场景选择 9 款独立透明插画，六种小狗姿态和书茶、远山、嫩芽。
- `src/TimeDistribution.tsx`、`src/activityColors.ts`：按活动汇总的时间圆环、图例高亮与统一颜色。
- `src/WelcomeTransition.tsx`：约 2 秒入场转场，可跳过，在「我的 → 显示 → 重看入场动画」重播。
- `src/echoAgent.ts`：每日回声与每周回声的 Agent 接口边界。
- `public/assets/`：设备运行时素材和知途插图。
- `docs/`：Agent 调用方案、流程图、产品计划书和海报源文件。

印章图鉴只从真实 FocusLog 与相关记录判断获得，不把旧版累计时长伪装成可核对的首次获得记录。日历继续保留旧数据原有的时间和数量。

本轮进一步完善颜色与流程：今日杏桃、专注雾蓝、回声淡紫、印迹草木绿；原素材板仅保存在 `artwork/reference/` 作为设计参考，页面不再裁切它。印章册新增全部／已获得／未获得筛选；保存日记后可直接查看对应日期。所有新增插画的完整提示词、原始文件和来源见 [companion-artwork.json](docs/companion-artwork.json)。

最新细节更新：时间分布改为活动圆环，阅读、数学、写作、运动等各有固定颜色，与今日任务旁的色点一致；同一活动跨日期合并，点击图例可突出查看。新标签页第一次进入时播放欢迎转场，本次会话内刷新不重复；正在专注或开启减少动效时直接进入。增加日期签、真实任务进度细线、路线连接、导航选中指示和折叠反馈。详见 [验收记录](design-qa.md)。
