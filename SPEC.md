# AI 酒馆竞技场 v2 规范

## 架构设计

### 核心流程

```
用户配置模型 → 编辑规则 → 输入问题 → 开始游戏
  ↓
每轮注入规则到所有参赛模型 → 并行调用 → 收集回答
  ↓
检测额度错误 → 如有则自动暂停/保存快照
  ↓
裁判模型评分（含规则遵守度） → 展示结果
  ↓
下一轮 或 暂停 → 用户修复 → 恢复 → 上下文压缩注入
```

### 数据模型

```
AIConfig {
  runStatus: 'active' | 'quota_exhausted' | 'error' | 'paused'
}

GameRule {
  rules, judgeCriteria, maxRounds, roundPromptTemplate
}

RoundRecord {
  round, question, ruleReminder, answers, scores, judgeComment
}

GameSnapshot {
  competitors, judgeModel, gameRule, rounds, totalScores,
  compressedSummary, pausedModelId, pausedReason
}
```

### 快照恢复机制

1. 暂停时：深拷贝所有状态 → 持久化到 localStorage
2. 恢复时：还原完整状态 + 所有 runStatus 重置为 active
3. 下一轮开始时：检测 roundHistory 有数据 → 构建压缩上下文
4. 注入给模型：压缩摘要 + 上轮回顾 + 本轮规则 + 问题

### 额度检测

- HTTP 429 / 402 → 自动标记 quota_exhausted
- 响应体包含 quota/billing/balance 关键词 → 自动标记
- 活跃模型 < 2 → 自动暂停并保存快照

### 本地 LLM

- 前端：API 类型选择 'local' → 请求走 Ollama 端点
- 后端(Tauri)：管理 Ollama 进程生命周期（start/stop/status）
- Android：优先远程 API，本地推理降速保稳