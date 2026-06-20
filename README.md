# 🍺 AI 酒馆竞技场 (AI Tavern Arena)

> 可定制规则的多模型博弈竞技平台 · 远程 API + 本地 Ollama/llama.cpp 混合参赛 · 自动快照暂停恢复 · 上下文压缩还原

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)

---

## 这是什么？

一个让 **2-24 个 AI 大模型同台竞技** 的应用。你可以自由定义比赛规则，让不同厂商的模型互相较量，由裁判模型评判胜负。支持 OpenAI、Anthropic、Gemini、豆包、文心一言、通义千问、混元、Kimi、智谱、阶跃星辰等所有主流平台，也可接入本地 Ollama/llama.cpp 运行的开源模型。

## 核心能力

| 能力 | 说明 |
|-----|------|
| 🤖 多模型竞技 | 2-24 个模型同时参赛，不限厂商 |
| 📜 自由规则 | 完全自定义比赛规则，每轮自动注入给所有模型 |
| 👑 裁判评分 | 指定任一模型为裁判，含规则遵守度评分 |
| 🖥️ 本地 LLM | 内嵌 Ollama 支持，可运行本地开源模型 |
| ⏸️ 智能暂停 | 模型额度耗尽自动暂停，保存全量上下文快照 |
| 🗜️ 上下文压缩 | 恢复时压缩历史摘要 + 当前轮完整上下文 |
| 💾 配置持久化 | 模型配置 + 规则 + 快照自动保存 |
| 📱 跨平台 | Web / Windows exe / Android apk |

## 快速开始

```bash
git clone https://github.com/Giggles226/en.git
cd en
npm install
npm run dev
# 浏览器打开 http://localhost:1420
```

## 使用指南

### 1. 添加模型
左侧面板点击「+ 添加」→ 填写 API Key / 模型名称 → 保存

### 2. 设置裁判
点击模型卡片上的 👑 图标，将其设为裁判

### 3. 编辑规则（可选）
点击「游戏规则」旁的「编辑」按钮，自定义比赛规则和评分标准

### 4. 开始竞技
输入问题 → 点击「开始游戏」→ 所有模型同时回答 → 裁判评分

## 构建桌面 / 移动端

### Windows EXE
```bash
npm run tauri build
# 输出: src-tauri/target/release/bundle/nsis/*.exe
```

### Android APK
```bash
npx tauri android init
npx tauri build
# 输出: src-tauri/target/release/bundle/android/*.apk
```

详细构建步骤见 [SPEC.md](SPEC.md)。

## 项目结构

```
├── src/
│   ├── types/index.ts              ← 类型定义
│   ├── stores/arenaStore.ts        ← 状态管理 + 快照
│   ├── services/ai_adapters/
│   │   └── universal.ts            ← 统一适配器
│   └── components/
│       ├── Arena.tsx               ← 主流程
│       ├── ConfigPanel.tsx         ← 模型配置
│       ├── RuleEditor.tsx          ← 规则编辑器
│       ├── SnapshotPanel.tsx       ← 快照面板
│       ├── QuestionInput.tsx       ← 问题输入
│       ├── CompetitorCard.tsx      ← 答题卡片
│       ├── JudgePanel.tsx          ← 裁判点评
│       └── ScoreBoard.tsx          ← 积分榜
└── src-tauri/                      ← Tauri 后端
    └── src/lib.rs                  ← 本地 LLM 进程管理
```

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Zustand
- **桌面/移动**: Tauri 2.0（Rust）
- **本地 LLM**: Ollama / llama.cpp
- **远程 API**: OpenAI / Anthropic / Gemini / 火山引擎 / 百度 / 阿里 / 腾讯 / 月之暗面 / 智谱 / 阶跃星辰

## 相关文档

- [SPEC.md](SPEC.md) — 架构规范与详细设计
- [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) — 应用配置

## License

MIT © 2025