# Fricless — 飞书 AI 机器人网关

> 类 OpenClaw 网关体验 × Claude Code Harness 架构

**Fricless** 是一个自托管的飞书 AI 机器人网关。它将 **OpenClaw** 的通道网关模式与 **Claude Code** 的 Tool/Command/Harness 架构理念结合，提供飞书 WebSocket 直连 + Claude API 深度集成的对话体验。

---

## 架构亮点

```
Gateway (控制平面)    →    Harness (对话引擎)    →    Provider (AI 模型)
    │                           │
    │                     ┌─────┴─────┐
    ▼                     ▼           ▼
Channel (飞书)         Tools        Commands
(WebSocket 直连)
```

- **Gateway**: 通道生命周期 + 消息路由 + Session 管理（类比 OpenClaw）
- **Harness**: Tool Use 对话循环 + 上下文管理（类比 Claude Code）
- **Tool 系统**: 基于 Zod Schema 的 `defineTool` 构建器 + 权限检查
- **Command 系统**: 斜杠命令（`/ping` `/help` `/clear`）
- **Provider 抽象**: AI 模型统一接口（当前支持 Anthropic Claude）

---

## MVP 功能

| 功能 | 状态 |
|------|------|
| 飞书 WebSocket 长连接（无需公网） | ✅ |
| Claude API 对话 | ✅ |
| 多 Session 隔离（私聊/群聊独立上下文） | ✅ |
| 斜杠命令 (`/ping`, `/help`, `/clear`) | ✅ |
| Tool Use 支持 (calculator) | ✅ |
| 流式输出卡片 (SDK 内置) | 🚧 Phase 2 |
| Web Search Tool | 🚧 Phase 2 |
| 更丰富的 Tool 系统 | 🚧 Phase 3 |

---

## 快速开始

### 前置条件

- Node.js ≥ 20
- 一个[飞书开放平台](https://open.feishu.cn)应用（已启用机器人能力）
- Anthropic API Key

### 安装

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 FEISHU_APP_ID, FEISHU_APP_SECRET, ANTHROPIC_API_KEY

# 3. 启动
npm run dev
```

### 飞书应用配置

1. 在[飞书开放平台](https://open.feishu.cn)创建应用
2. 启用机器人能力，获取 App ID 和 App Secret
3. 配置事件订阅为 **WebSocket 模式**（无需公网 URL）
4. 订阅 `im.message.receive_v1` 事件
5. 开通必要权限（`im:message` 系列、`im:chat` 系列）
6. 发布应用

---

## 项目结构

```
src/
├── index.ts                  # 入口
├── config.ts                 # 配置管理
├── types/                    # 共享类型
├── gateway/
│   ├── Gateway.ts            # 控制平面
│   └── Router.ts             # 消息路由
├── channels/
│   ├── types.ts              # Channel 接口
│   └── feishu/
│       ├── FeishuChannel.ts  # 飞书通道
│       └── types.ts
├── harness/
│   ├── Harness.ts            # 对话循环引擎
│   ├── Tool.ts               # Tool 接口 + 构建器
│   ├── Command.ts            # Command 接口
│   ├── tools/                # 内置 Tool
│   └── commands/             # 内置命令
├── providers/
│   ├── types.ts              # Provider 接口
│   └── AnthropicProvider.ts  # Claude API
└── session/
    ├── Session.ts            # Session 数据模型
    └── SessionStore.ts       # 存储
```

---

## 开发路线图

| Phase | 内容 | 状态 |
|-------|------|------|
| **MVP** | Feishu + Claude + Session + /ping | ✅ **当前** |
| **P2** | 流式卡片 + 更多 Tool + /help /clear | 📋 规划 |
| **P3** | Tool 权限 + SQLite 持久化 | 📋 规划 |
| **P4** | 多模型支持 + Coordinator | 📋 规划 |
| **P5** | Web 控制面板 + Bridge + 插件 | 📋 规划 |

---

## 架构参考

- [OpenClaw](https://github.com/openxjarvis/openclaw-python) — 多通道 AI 网关
- [Claude Code (重构版)](https://github.com/pengchengneo/Claude-Code) — Tool/Command/Harness 架构
- [飞书开放平台](https://open.feishu.cn) — 飞书 Bot API
- [@larksuiteoapi/node-sdk](https://github.com/larksuite/node-sdk) — 飞书官方 Node.js SDK

---

## License

MIT
