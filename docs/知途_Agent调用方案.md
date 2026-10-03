# 知途大模型 Agent 调用方案

版本：2026-10-02  | 适用项目：`jixiang-prototype`

## 一、先把边界说清楚

当前原型已经预留 `EchoAgentAdapter`，但没有网络客户端，也没有接入真实大模型、知乎 OAuth 或小红书接口。当前页面点击“生成这一天的回声”只会写入一个空草稿 `emptyDailyEcho("draft")`，并明确提示接口等待接入。下面的调用形式是下一阶段的可实现方案，不是当前已上线能力。

Agent 只负责理解和整理“回声”草稿，不能参与以下事实计算：计时、任务状态、日期、投入毫秒数、每 10 分钟印章数量、印章样式或本机记录写入。所有结果都必须回指本机证据，最后由用户确认或隐藏。

## 二、推荐调用链

```text
用户保存日记
  ↓
用户点击生成回声（显式触发）
  ↓
前端本地组装 DailyEchoInput
  ↓
隐私与授权门（includeDiaryInAI、授权书签、schema）
  ↓
调用 1：理解当天
  ├─ facts / signals / sparkle / quiet
  └─ 每项带 evidenceRefs
  ↓
仅当 signal.needsExternal 且有授权材料
  ├─ 读取白名单 authorisedBookmarks
  └─ 调用 2：证据适配与明日小实验
      └─ externalMatches / tomorrowExperiments
  ↓
本地 schema、去重、证据日期和置信度校验
  ↓
展示草稿 → 用户确认 / 隐藏
  ↓
写回 dailyEchoes / experiments；日期详情与印迹册继续只读事实
```

## 三、两个接口

### 1. 每日回声

沿用当前 `src/echoAgent.ts` 的接口：

```ts
type EchoAgentAdapter = {
  generateDailyEcho(input: DailyEchoInput): Promise<DailyEchoDraft>;
  generateWeeklyEcho(input: {
    rangeStart: string;
    rangeEnd: string;
    days: DailyEchoInput[];
  }): Promise<WeeklyEchoDraft>;
};
```

建议服务端端点（规划）：

```text
POST /api/echo/daily
POST /api/echo/weekly
```

服务端不接收整份 localStorage，只接收经过前端裁剪和用户授权的数据；生产环境再补充登录态、限流、超时和审计日志。

### 2. 输入最小化

`DailyEchoInput` 应只包含当前这一天真正需要的字段：

```json
{
  "dateKey": "2026-10-02",
  "timezone": "Asia/Shanghai",
  "diaryText": "今天读论文比预计慢，但终于写下了一个核心问题。",
  "tasks": [
    {
      "id": "task-reading",
      "title": "读完论文摘要",
      "status": "active",
      "plannedMinutes": 25,
      "actualMinutes": 18,
      "outcomeId": null
    }
  ],
  "outcomes": [
    {
      "id": "outcome-physics",
      "body": "独立完成两道物理题，写下受力方向的收获。",
      "classification": "completed",
      "evidenceRefs": [
        {"id": "outcome-physics", "dateKey": "2026-10-01", "kind": "outcome"}
      ]
    }
  ],
  "blockers": [],
  "authorisedBookmarks": []
}
```

当 `includeDiaryInAI=false` 时，`diaryText` 应为空字符串；当用户没有授权书签时，`authorisedBookmarks` 必须为空数组。不要把未授权的收藏、全部历史日记或身份信息带给模型。

## 四、调用 1：理解当天

模型目标是整理事实，不是替用户下判断。建议输出 JSON Schema：

- `status`: `draft | confirmed | hidden`，首次只能为 `draft`
- `quiet`: 今天没有足够信号时为 `true`
- `facts[]`: 只改写输入事实，保留 `evidenceRefs`
- `signals[]`: `friction | startup | interest | question | progress`，带 `confidence` 与 `needsExternal`
- `sparkle`: 一个可为空的具体进展，带证据
- `externalMatches`: 第一次调用保持空数组
- `tomorrowExperiments`: 第一次调用可以为空，避免跳过证据适配

系统提示应包含：

1. 不要发明用户没有提供的经历、来源或结果。
2. 不把“实际投入更久”自动解释为更努力或更有效。
3. 不把未完成解释为失败；暂停、卡点和安静的一天都是合法状态。
4. 每条输出必须能通过 `evidenceRefs` 回到任务、成果、便签、日记或书签。
5. 置信度低于阈值时宁可输出 `quiet=true`。

## 五、调用 2：证据适配与明日小实验

只有同时满足下面两个条件才触发：

- 调用 1 至少有一个 `needsExternal=true` 的信号；
- 用户主动授权并提供 `authorisedBookmarks` 或后续明确允许的候选材料。

第二次调用只接收候选摘要、来源标签、收藏时间和白名单 URL。输出：

```json
{
  "externalMatches": [
    {
      "bookmarkId": "bookmark-01",
      "whyRelevant": "它讨论了把论文阅读拆成问题清单，和今天的启动卡点相似。",
      "excerpt": "候选摘要片段",
      "savedAt": 1780300800000,
      "url": "https://example.com/allowed",
      "evidenceRefs": [
        {"id": "bookmark-01", "dateKey": "2026-10-02", "kind": "bookmark"}
      ]
    }
  ],
  "tomorrowExperiments": [
    {
      "id": "experiment-01",
      "title": "先写出论文要解决的问题",
      "why": "把启动动作缩小到十分钟内。",
      "stopCondition": "十分钟后仍无法定位问题，就先保存卡点，不继续扩展范围。",
      "evidenceRefs": []
    }
  ]
}
```

`whyRelevant` 说明“为什么与今天有关”，`stopCondition` 说明“什么时候停”，两者缺失时不展示外部经验卡。

## 六、每周回声

本地先做门槛，再调用模型：

- 当前周期有日记的日期少于 3 天：不生成规律，只展示事实。
- 每条观察至少要有 2 个不同 `evidenceDates`。
- 没有记录的日期属于未知，不解释为失败。

`generateWeeklyEcho` 只负责把满足门槛的日期事实整理成自然语言，不能自行补齐缺失日期或制造趋势。

## 七、失败、限流与回滚

- schema 不通过：保留原始日记与任务，返回可读错误，不覆盖已有草稿。
- 超时或模型不可用：显示“暂时没有生成回声”，不把失败写成空洞结论。
- 外部材料无匹配：回到本机事实卡，不生成“有人也这样走过”。
- 用户点击隐藏：只保存 `status="hidden"`，下次可重新生成。
- 用户点击确认：才写回 `dailyEchoes` 与 `experiments`；不能自动改变任务状态或印迹册。

## 八、落地顺序

1. 先实现本地 `assembleDailyEchoInput`、schema 校验和 mock adapter，保持页面交互不变。
2. 再接一个受控模型提供方，固定 JSON 输出和超时；保留空草稿回退。
3. 加入授权书签的候选适配，所有来源保留白名单 URL 和用户可见出处。
4. 最后实现每周回声和“经验适配卡”，用真实用户确认记录做回归测试。

验收标准不是“模型能说很多话”，而是每条回声都能解释来自哪里、为什么与今天有关、用户是否同意把它带到明天。
