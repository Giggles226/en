# 🍺 AI 酒馆竞技场 (AI Tavern Arena)

可定制规则的多模型博弈竞技平台。支持远程 API 和本地 Ollama/llama.cpp 模型混合参赛，自动快照暂停恢复，上下文压缩还原。

## 核心特性

| 特性 | 说明 |
|-----|------|
| 🤖 **多模型竞技** | 2-24 个模型同时参赛，支持 OpenAI/Anthropic/Gemini/豆包/文心/通义/混元/Kimi/智谱/阶跃星辰 |
| 🖥️ **本地 LLM** | 内嵌 Ollama 支持，可运行本地开源模型参赛 |
| 📜 **自由规则** | 完全自定义比赛规则，每轮自动注入规则提示给所有模型 |
| 👑 **裁判机制** | 指定任一模型为裁判，按规则评判 + 规则遵守度评分 |
| ⏸️ **快照暂停** | 模型额度耗尽自动暂停，保存全量上下文，修复后一键恢复 |
| 🗜️ **上下文压缩** | 恢复时压缩历史回合摘要 + 当前轮完整上下文，节省 token |
| 💾 **配置持久化** | 模型配置 + 规则 + 快照自动保存到本地存储 |
| 📱 **跨平台** | Web / Windows exe / Android apk |

## 快速开始 - Web 版本

```bash
cd ai-tavern-arena
npm install
npm run dev
# 访问 http://localhost:1420
```

## 本地 LLM 使用

### 安装 Ollama

```bash
# Linux/Mac
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# 下载安装: https://ollama.com/download/windows
```

### 拉取模型

```bash
ollama pull qwen2.5:7b
ollama pull llama3.2:3b
```

### 在应用中添加本地模型

1. 添加模型时 API 类型选择「本地模型 (Ollama/llama.cpp)」
2. 模型名称填入 `qwen2.5:7b`
3. 点击「检测」按钮确认 Ollama 连接正常

## 游戏规则定制

左侧面板点击「编辑」按钮，可自定义：

- **规则名称**：如「辩论赛」
- **比赛规则**：每轮发送给参赛模型的规则文本
- **裁判评分标准**：告诉裁判如何评分
- **最大轮次**：1-10 轮
- **提问模板**：支持 `{rules}` `{question}` 占位符

## 快照与恢复

1. **自动暂停**：某模型返回 429/402/额度错误时自动触发
2. **保存快照**：完整模型配置 + 所有轮次记录 + 压缩摘要
3. **一键恢复**：修复模型后点击「恢复」按钮，上下文压缩后注入模型

## 构建 Windows EXE

```bash
# 前提：Windows 10+, Rust, Node.js, VS Build Tools
cd ai-tavern-arena
npm install
npm run tauri build
# 输出: src-tauri/target/release/bundle/nsis/*.exe
```

## 构建 Android APK

```bash
# 前提：Android Studio, SDK 34, NDK 26.3, Rust, JDK 17+
rustup target add aarch64-linux-android
cd ai-tavern-arena
npx tauri android init
npx tauri build
# 输出: src-tauri/target/release/bundle/android/*.apk
```

Android 端优化：优先使用远程 API 保证稳定性，本地推理时自动降速保证连接可靠。

## 项目结构

```
ai-tavern-arena/
├── src/
│   ├── types/index.ts                ← 类型定义（规则/快照/OVM/LLM状态）
│   ├── stores/arenaStore.ts          ← Zustand（快照管理+暂停恢复+持久化）
│   ├── services/ai_adapters/
│   │   └── universal.ts              ← 统一适配器（规则注入+额度检测+本地LLM）
│   └── components/
│       ├── Arena.tsx                 ← 主界面（规则注入流+额度检测+压缩恢复）
│       ├── ConfigPanel.tsx           ← 模型配置（本地LLM检测+状态监控）
│       ├── RuleEditor.tsx            ← 规则编辑器
│       ├── SnapshotPanel.tsx         ← 快照存档面板
│       ├── QuestionInput.tsx         ← 问题输入（含暂停/恢复）
│       ├── CompetitorCard.tsx        ← 答题卡片（状态标签）
│       ├── JudgePanel.tsx            ← 裁判点评
│       └── ScoreBoard.tsx            ← 积分榜
└── src-tauri/
    ├── tauri.conf.json
    ├── capabilities/
    └── src/lib.rs                    ← 本地LLM进程管理
```

## License

MIT