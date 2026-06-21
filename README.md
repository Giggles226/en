# 🍺 AI 酒馆竞技场 (AI Tavern Arena)

> 可定制规则的多模型博弈竞技平台 · 裁判Agent主持私人对话淘汰制 · 自动快照暂停恢复 · 上下文压缩还原 · 极光紫蓝磨砂玻璃 UI

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)

---

## 这是什么？

一个让 **2-24 个 AI 大模型同台博弈** 的应用。你自由定义比赛规则，由一个裁判Agent主持：裁判与每个存活模型进行不公开的私人对话，测试其逻辑与规则遵守度，每轮做出淘汰判定并公开发言。支持 OpenAI、Anthropic、Gemini、豆包、文心一言、通义千问、混元、Kimi、智谱、阶跃星辰等所有主流平台。

## 核心能力

| 能力 | 说明 |
|-----|------|
| 🤖 多模型博弈 | 2-24 个模型同时参赛，不限厂商 |
| 📜 自由规则 | 完全自定义比赛规则与淘汰标准，每轮自动注入 |
| 👑 裁判Agent | 裁判与每个模型私人对话 → 淘汰判定 → 公开发言 |
| ⏸️ 智能暂停 | 模型额度耗尽自动暂停，保存全量上下文快照 |
| ▶️ 无缝恢复 | 从快照还原本轮中间状态，自动续跑（不丢进度） |
| 🗜️ 上下文压缩 | 恢复/下一轮时注入历史压缩摘要 + 上轮回顾 |
| 💾 配置持久化 | 模型配置 + 规则 + 快照自动保存（最多 20 个快照） |
| 🎨 磨砂玻璃 UI | 极光紫蓝配色 · 半透明磨砂质感 · 超大圆角 · Android 降级 |
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
点击「游戏规则」旁的「编辑」按钮，自定义比赛规则和淘汰标准

### 4. 开始竞技
输入主题 → 点击「开始游戏」→ 裁判Agent依次与各模型私人对话 → 做出淘汰判定 → 公开发言 → 进入下一轮

### 5. 额度耗尽恢复
某模型额度耗尽时自动暂停并建快照。修复该模型 API Key 后点击「恢复并继续游戏」，从暂停相位无缝续跑。

## 构建桌面 / 移动端

### Windows EXE
```bash
npm run tauri build
# 输出: src-tauri/target/release/bundle/nsis/*.exe
```

### Android APK
> `src-tauri/gen/android` 已初始化，无需再跑 `tauri android init`。

```bash
# debug 包
npx tauri android build --debug
# release 包
npx tauri android build
# 输出: src-tauri/gen/android/app/build/outputs/apk/**/*.apk
```

也可直接推送 main 分支触发 GitHub Actions 自动构建并发布 Release。详细构建步骤见 [SPEC.md](SPEC.md)。

## 项目结构

```
├── src/
│   ├── types/index.ts              ← 类型定义
│   ├── stores/arenaStore.ts        ← 状态管理 + 快照 + 暂停恢复
│   ├── services/
│   │   ├── ai_adapters/universal.ts ← 统一 AI 适配器 + 裁判Agent
│   │   └── apiKeyManager.ts        ← 统一 API Key 管理
│   └── components/
│       ├── Arena.tsx               ← 主游戏循环（相位驱动 + 自驱动）
│       ├── ConfigPanel.tsx         ← 模型配置
│       ├── RuleEditor.tsx          ← 规则编辑器
│       ├── SnapshotPanel.tsx       ← 快照面板（手动/自动存档）
│       ├── QuestionInput.tsx       ← 问题输入 + 游戏控制
│       ├── CompetitorCard.tsx      ← 参赛模型卡片
│       ├── JudgePanel.tsx          ← 裁判点评
│       ├── PublicChat.tsx          ← 公共发言区
│       └── ScoreBoard.tsx          ← 积分榜
├── src-tauri/                      ← Tauri 后端
│   └── src/lib.rs                  ← Tauri 应用入口
└── .github/workflows/build-apk.yml ← Android APK 自动构建 CI
```

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS v4 + Zustand
- **桌面/移动**: Tauri 2.0（Rust）
- **远程 API**: OpenAI / Anthropic / Gemini / 火山引擎 / 百度 / 阿里 / 腾讯 / 月之暗面 / 智谱 / 阶跃星辰

## 相关文档

- [SPEC.md](SPEC.md) — 架构规范与详细设计
- [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) — 应用配置

## License

MIT © 2025
