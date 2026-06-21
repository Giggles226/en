# AI 酒馆竞技场 规范

## 架构设计

### 核心流程（裁判Agent 私人对话淘汰制）

```
用户配置模型 → 编辑规则 → 输入主题 → 开始游戏
  ↓
裁判读取规则（judge_reading_rules）
  ↓
私人对话（private_conversations）：裁判依次与每个存活模型
  进行最多 N 轮不公开对话，测试逻辑/策略/规则遵守度
  ↓
淘汰判定（judge_deliberation）：裁判汇总所有私人对话，决定本轮淘汰
  ↓
公开发言（public_announcement）：裁判宣布淘汰结果 + 规则提醒
  ↓
本轮收尾（round_end）：写入 RoundRecord + 自动存档快照
  ↓
下一轮 或 游戏结束（存活 ≤1 或达最大轮次）
```

> 全程由 `Arena.tsx` 的自驱动 async 循环（`runRound`）按相位推进，
> 不依赖 React effect 重触发，避免私人对话阶段死锁。
> 任一 AI 调用额度耗尽 → `pauseGame` → 循环中止。

### 数据模型

```
AIConfig {
  runStatus: 'active' | 'quota_exhausted' | 'error' | 'paused' | 'eliminated'
}

GameRule {
  rules, judgeCriteria, maxRounds, roundPromptTemplate,
  eliminationRules, maxPrivateTurns   // 私人对话最大回合数
}

PrivateChat { competitorId, messages: ChatMessage[], isActive }

RoundRecord {
  round, question, ruleReminder,
  privateChats, publicMessages,    // 本轮私人对话 + 公共发言
  eliminatedThisRound,             // 本轮增量淘汰列表
  answers, scores, judgeComment, timestamp
}

GameSnapshot {
  competitors, judgeModel, gameRule, rounds, totalScores,
  currentRound, compressedSummary, pausedModelId, pausedReason,
  eliminatedModels,
  // 恢复接续所需的本轮中间状态
  phase, question, privateChats, publicMessages,
  currentConversationId, eliminationReasons, judgeComment, scores
}
```

### 快照与暂停恢复机制

1. **快照时机**：额度耗尽暂停时自动建（`pauseGame`）、每轮结束时自动建（`finalizeRound`）、SnapshotPanel 手动建（📸 存档）。最多保留 20 个，超限删最旧；私人对话消息截断 500 字控制体积。
2. **暂停**：`callAI` 返回 `isQuotaError` → 经 `judgeAgent*` 冒泡为 `quotaError` → `handleQuotaPause` 调 `updateModelStatus(quota_exhausted)` + `pauseGame`（status→paused、phase→paused、建快照）。
3. **恢复**：`resumeGame` 从最新快照还原**全部中间状态**（phase/privateChats/publicMessages 等）+ 所有 runStatus 重置为 active，并设 status→'loading' 触发主循环**自动续跑**，从保存的相位接续。未修好 Key 会再次触发暂停（自纠正）。
4. **手动读档**：`restoreSnapshot` 还原到存档点但 status→'idle'（不自动续跑，用户手动开始）。

### 上下文压缩还原

`buildRestoreContext(compressedSummary, lastRound, rule)` 在每轮私人对话/判定/发言前计算一次，注入裁判与参赛模型的 system prompt：

- 历史回合压缩摘要（`compressRounds` 生成）
- 上一轮回顾（问题 + 裁判点评）
- 规则遵守提示

第一轮（无历史）返回空串，自动跳过。

### 额度检测

- HTTP 429 / 402 → `isQuotaError = true`
- 响应体包含 quota/billing/balance/rate limit 等关键词 → `isQuotaError = true`
- `judgeAgentPrivateChat` 区分裁判/参赛模型哪个额度耗尽（`quotaError.role`）
- 触发 `pauseGame` 暂停 + 建快照

### 统一 API Key 管理

CC Switch 风格：全局按平台配置 API Key（`apiKeyManager`），所有该平台模型共享；模型自带 Key 可覆盖全局。`resolveApiCredentials(apiType, modelKey, modelEndpoint)` 统一解析凭证。

### 支持平台

OpenAI / Anthropic / Google(Gemini) / 火山引擎(豆包) / 百度(文心) / 阿里(通义) / 腾讯(混元) / 月之暗面(Kimi) / 智谱 / 阶跃星辰 / 自定义。Google 端点支持 `{model}` 占位符替换。

## 构建

### 前端
```bash
npm install
npm run build   # tsc + vite build
```

### Android APK
`src-tauri/gen/android` 已初始化。推送 main 分支触发 `.github/workflows/build-apk.yml` 自动构建 debug APK 并发布 Release；或本地：
```bash
npx tauri android build --debug
# 输出: src-tauri/gen/android/app/build/outputs/apk/**/*.apk
```

## UI 设计

极光紫蓝配色 · 半透明磨砂玻璃质感（`backdrop-filter: blur`）· 超大圆角（主卡 2.5rem / 子卡 2rem / 输入 1.25rem / 按钮胶囊）。Android WebView 不支持 `backdrop-filter` 时自动降级提高背景不透明度补偿；移动端下调 blur 强度减少掉帧。
